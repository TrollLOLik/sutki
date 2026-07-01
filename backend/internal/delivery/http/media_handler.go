package http

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type MediaHandler struct {
	privateStorage domain.FileStorage
	publicStorage  domain.FileStorage
}

func NewMediaHandler(privateStorage domain.FileStorage, publicStorage domain.FileStorage) *MediaHandler {
	return &MediaHandler{
		privateStorage: privateStorage,
		publicStorage:  publicStorage,
	}
}

type presignMediaRequest struct {
	FileName    string `json:"file_name"`
	Size        int64  `json:"size"`
	ContentType string `json:"content_type"`
	Type        string `json:"type"` // white list: "avatar" | "listing" | "chat"
}

func (h *MediaHandler) PresignUpload(w http.ResponseWriter, r *http.Request) {
	_, ok := userIDFromContext(r.Context())
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

	// 1. Size and MIME validation based on type
	switch uploadType {
	case "avatar":
		if req.Size > 5*1024*1024 {
			writeError(w, http.StatusBadRequest, "avatar size exceeds 5MB limit")
			return
		}
		if !isImageMime(contentType) {
			writeError(w, http.StatusBadRequest, "only images (jpeg, png, webp) are allowed for avatars")
			return
		}
	case "listing":
		if req.Size > 10*1024*1024 {
			writeError(w, http.StatusBadRequest, "listing image size exceeds 10MB limit")
			return
		}
		if !isImageMime(contentType) {
			writeError(w, http.StatusBadRequest, "only images (jpeg, png, webp) are allowed for listing photos")
			return
		}
	case "chat":
		if req.Size > 15*1024*1024 {
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
		writeError(w, http.StatusInternalServerError, "failed to generate secure name")
		return
	}
	ext := filepath.Ext(req.FileName)

	var targetStorage domain.FileStorage
	var key string

	switch uploadType {
	case "avatar":
		targetStorage = h.publicStorage
		key = fmt.Sprintf("avatars/%s%s", uuid, ext)
	case "listing":
		targetStorage = h.publicStorage
		key = fmt.Sprintf("listings/%s%s", uuid, ext)
	case "chat":
		targetStorage = h.privateStorage
		key = fmt.Sprintf("chat/uploads/%s%s", uuid, ext)
	}

	// 3. Generate S3 presigned upload target
	target, err := targetStorage.PresignUpload(r.Context(), key, req.Size, contentType)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, target)
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
