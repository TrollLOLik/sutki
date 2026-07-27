package http

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"strings"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/media"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/imagemoderation"
)

// MediaHandler serves avatar and listing uploads. Chat attachments are NOT
// handled here — they go through the chat service, which additionally gates
// video and animation on account standing.
type MediaHandler struct {
	publicStorage  domain.FileStorage
	imageModerator domain.ImageModerator
}

func NewMediaHandler(publicStorage domain.FileStorage, imageModerator domain.ImageModerator) *MediaHandler {
	return &MediaHandler{
		publicStorage:  publicStorage,
		imageModerator: imageModerator,
	}
}

type presignMediaRequest struct {
	FileName    string `json:"file_name"`
	Size        int64  `json:"size"`
	ContentType string `json:"content_type"`
	Type        string `json:"type"` // white list: "avatar" | "listing"
}

func (h *MediaHandler) PresignUpload(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req presignMediaRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.FileName == "" || req.Size <= 0 || req.ContentType == "" || req.Type == "" {
		writeError(w, http.StatusBadRequest, "missing required fields (file_name, size, content_type, type)")
		return
	}

	uploadType := strings.ToLower(strings.TrimSpace(req.Type))
	// "chat" is deliberately not accepted here. This route is a second way to
	// mint an attachment key, and it never ran the checks the chat route does —
	// most importantly canSendMotionMedia, which is what stops a fresh
	// unverified account from uploading GIFs and video. Two routes minting
	// interchangeable keys means the weaker one defines the security of both.
	// Chat uploads go through POST /api/v1/chat/attachments/presign.
	if uploadType != "avatar" && uploadType != "listing" {
		writeError(w, http.StatusBadRequest, "invalid upload type (must be 'avatar' or 'listing')")
		return
	}

	contentType := strings.ToLower(strings.TrimSpace(req.ContentType))

	// 1. Size and MIME validation based on type. The per-type limit is also
	// passed to PresignUpload as the POST policy's content-length-range upper
	// bound, so S3 enforces it authoritatively regardless of the client-
	// claimed size (which picker libraries often misreport).
	var maxSize int64
	switch uploadType {
	case "avatar":
		maxSize = 5 * 1024 * 1024
		if req.Size > maxSize {
			writeError(w, http.StatusBadRequest, "avatar size exceeds 5MB limit")
			return
		}
		if !isImageMime(contentType) {
			writeError(w, http.StatusBadRequest, "only images (jpeg, png, webp) are allowed for avatars")
			return
		}
	case "listing":
		maxSize = 10 * 1024 * 1024
		if req.Size > maxSize {
			writeError(w, http.StatusBadRequest, "listing image size exceeds 10MB limit")
			return
		}
		if !isImageMime(contentType) {
			writeError(w, http.StatusBadRequest, "only images (jpeg, png, webp) are allowed for listing photos")
			return
		}
	}

	// 2. Generate secure random key path
	uuid, err := generateMediaRandomHex(16)
	if err != nil {
		writeInternalError(w, r, err, "failed to generate secure name")
		return
	}
	// Clamped, not raw: an unbounded or exotic extension ends up inside the
	// object key, and one containing "${" can reach the POST policy and turn a
	// pinned key into a prefix match.
	ext := media.SafeExt(req.FileName)

	// Both remaining kinds live in the public bucket; the indirection that used
	// to pick between buckets went with the chat branch.
	var key string
	switch uploadType {
	case "avatar":
		key = media.OwnerPrefix("avatars", userID) + uuid + ext
	case "listing":
		key = media.OwnerPrefix("listings", userID) + uuid + ext
	}

	// 3. Generate S3 presigned POST target (size capped by maxSize via policy)
	target, err := h.publicStorage.PresignUpload(r.Context(), key, maxSize, contentType)
	if err != nil {
		// Log the full error server-side; never leak storage internals to the client.
		log.Printf("[Media] PresignUpload error (type=%s): %v", uploadType, err)
		writeInternalError(w, r, err, "internal error")
		return
	}

	log.Printf("[Media] PresignUpload OK (type=%s) key=%q", uploadType, target.Key)
	writeJSON(w, http.StatusOK, target)
}

type moderateListingMediaRequest struct {
	Keys []string `json:"keys"`
}

type moderateListingMediaItem struct {
	Key        string  `json:"key"`
	Decision   string  `json:"decision"`
	Category   string  `json:"category,omitempty"`
	Reason     string  `json:"reason,omitempty"`
	Confidence float32 `json:"confidence"`
}

// ModerateListingImages checks newly uploaded listing photos before the app
// may show them on the final publication preview. The durable listing worker
// still repeats this check and remains the authoritative publication gate.
func (h *MediaHandler) ModerateListingImages(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req moderateListingMediaRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if len(req.Keys) == 0 || len(req.Keys) > 10 {
		writeError(w, http.StatusBadRequest, "between 1 and 10 listing image keys are required")
		return
	}
	if h.publicStorage == nil || h.imageModerator == nil {
		writeError(w, http.StatusServiceUnavailable, "image moderation is temporarily unavailable")
		return
	}

	seen := make(map[string]struct{}, len(req.Keys))
	items := make([]moderateListingMediaItem, 0, len(req.Keys))
	sealedObjects := make([]media.SealedObject, 0, len(req.Keys))
	cleanupNewSeals := func() {
		for _, item := range sealedObjects {
			if item.Created {
				_ = h.publicStorage.Delete(r.Context(), item.Key)
			}
		}
	}
	for _, rawKey := range req.Keys {
		key := strings.TrimSpace(rawKey)
		if !media.IsOwnedKey(key, "listings", userID) {
			cleanupNewSeals()
			writeError(w, http.StatusBadRequest, "listing image key is outside the user's media scope")
			return
		}
		if _, exists := seen[key]; exists {
			cleanupNewSeals()
			writeError(w, http.StatusBadRequest, "duplicate listing image key")
			return
		}
		seen[key] = struct{}{}

		sealed, err := media.SealOwnedObject(
			r.Context(),
			h.publicStorage,
			key,
			"listings",
			"listings",
			userID,
			10*1024*1024,
			map[string]bool{"image/jpeg": true, "image/png": true, "image/webp": true},
		)
		if err != nil {
			log.Printf("[Media] listing image sealing error key=%q: %v", key, err)
			cleanupNewSeals()
			writeError(w, http.StatusServiceUnavailable, "image moderation is temporarily unavailable")
			return
		}
		sealedObjects = append(sealedObjects, sealed)

		result, err := imagemoderation.ModerateStoredImages(r.Context(), h.imageModerator, h.publicStorage, []string{sealed.Key}, "listing_preview", 10*1024*1024)
		if err != nil {
			log.Printf("[Media] listing image moderation error key=%q: %v", sealed.Key, err)
			cleanupNewSeals()
			writeError(w, http.StatusServiceUnavailable, "image moderation is temporarily unavailable")
			return
		}
		items = append(items, moderateListingMediaItem{
			Key: sealed.Key, Decision: result.Decision, Category: result.Category,
			Reason: result.Reason, Confidence: result.Confidence,
		})
		if result.Decision != domain.ImageModerationApprove && sealed.Created {
			if err := h.publicStorage.Delete(r.Context(), sealed.Key); err != nil {
				log.Printf("[Media] delete rejected listing image key=%q: %v", sealed.Key, err)
			}
		}
	}

	for _, sealed := range sealedObjects {
		if !sealed.Created {
			continue
		}
		if err := h.publicStorage.Delete(r.Context(), sealed.SourceKey); err != nil {
			log.Printf("[Media] delete sealed listing upload source key=%q: %v", sealed.SourceKey, err)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func isImageMime(mime string) bool {
	return mime == "image/jpeg" || mime == "image/png" || mime == "image/webp"
}

func generateMediaRandomHex(n int) (string, error) {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
