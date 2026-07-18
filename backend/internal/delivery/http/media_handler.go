package http

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/media"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/imagemoderation"
)

type MediaHandler struct {
	privateStorage domain.FileStorage
	publicStorage  domain.FileStorage
	imageModerator domain.ImageModerator
}

func NewMediaHandler(privateStorage domain.FileStorage, publicStorage domain.FileStorage, imageModerator domain.ImageModerator) *MediaHandler {
	return &MediaHandler{
		privateStorage: privateStorage,
		publicStorage:  publicStorage,
		imageModerator: imageModerator,
	}
}

type presignMediaRequest struct {
	FileName    string `json:"file_name"`
	Size        int64  `json:"size"`
	ContentType string `json:"content_type"`
	Type        string `json:"type"` // white list: "avatar" | "listing" | "chat"
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
	if uploadType != "avatar" && uploadType != "listing" && uploadType != "chat" {
		writeError(w, http.StatusBadRequest, "invalid upload type (must be 'avatar', 'listing', or 'chat')")
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
	case "chat":
		maxSize = 15 * 1024 * 1024
		if req.Size > maxSize {
			writeError(w, http.StatusBadRequest, "chat attachment size exceeds 15MB limit")
			return
		}
		if !isAllowedChatMime(contentType) {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("file type %s is not allowed for chat attachments", contentType))
			return
		}
	}

	// 2. Generate secure random key path
	uuid, err := generateMediaRandomHex(16)
	if err != nil {
		writeInternalError(w, r, err, "failed to generate secure name")
		return
	}
	ext := filepath.Ext(req.FileName)

	var targetStorage domain.FileStorage
	var key string

	switch uploadType {
	case "avatar":
		targetStorage = h.publicStorage
		key = media.OwnerPrefix("avatars", userID) + uuid + ext
	case "listing":
		targetStorage = h.publicStorage
		key = media.OwnerPrefix("listings", userID) + uuid + ext
	case "chat":
		targetStorage = h.privateStorage
		key = fmt.Sprintf("chat/uploads/%s%s", uuid, ext)
	}

	// 3. Generate S3 presigned POST target (size capped by maxSize via policy)
	target, err := targetStorage.PresignUpload(r.Context(), key, maxSize, contentType)
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
	for _, rawKey := range req.Keys {
		key := strings.TrimSpace(rawKey)
		if !media.IsOwnedKey(key, "listings", userID) {
			writeError(w, http.StatusBadRequest, "listing image key is outside the user's media scope")
			return
		}
		if _, exists := seen[key]; exists {
			writeError(w, http.StatusBadRequest, "duplicate listing image key")
			return
		}
		seen[key] = struct{}{}

		result, err := imagemoderation.ModerateStoredImages(r.Context(), h.imageModerator, h.publicStorage, []string{key}, "listing_preview", 10*1024*1024)
		if err != nil {
			log.Printf("[Media] listing image moderation error key=%q: %v", key, err)
			writeError(w, http.StatusServiceUnavailable, "image moderation is temporarily unavailable")
			return
		}
		items = append(items, moderateListingMediaItem{
			Key: key, Decision: result.Decision, Category: result.Category,
			Reason: result.Reason, Confidence: result.Confidence,
		})
		if result.Decision != domain.ImageModerationApprove {
			if err := h.publicStorage.Delete(r.Context(), key); err != nil {
				log.Printf("[Media] delete rejected listing image key=%q: %v", key, err)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func isImageMime(mime string) bool {
	return mime == "image/jpeg" || mime == "image/png" || mime == "image/webp"
}

func isAllowedChatMime(mime string) bool {
	allowedTypes := []string{
		"image/jpeg", "image/png", "image/webp", "image/gif",
		"application/pdf", "text/plain",
		"application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	}
	for _, t := range allowedTypes {
		if mime == t {
			return true
		}
	}
	return false
}

func generateMediaRandomHex(n int) (string, error) {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
