package media

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

var sealedNamePattern = regexp.MustCompile(`^sealed-[0-9a-f]{64}-[0-9a-f]{64}(\.[A-Za-z0-9]{1,10})?$`)

var ErrInvalidMediaSize = errors.New("invalid media size")

// SealedObject is an immutable server-side snapshot of a client upload.
type SealedObject struct {
	SourceKey string
	Key       string
	Info      domain.ObjectInfo
	Created   bool
}

// IsSealedOwnedKey recognizes the backend-only part of an owner's namespace.
// Presign handlers never mint names with this shape.
func IsSealedOwnedKey(key, kind string, ownerID int32) bool {
	trimmed := strings.TrimSpace(key)
	prefix := OwnerPrefix(kind, ownerID)
	if !strings.HasPrefix(trimmed, prefix) {
		return false
	}
	return sealedNamePattern.MatchString(trimmed[len(prefix):])
}

// SealOwnedObject snapshots the ETag observed during validation. Moderation
// and serving must use the returned key, never the replayable SourceKey.
func SealOwnedObject(
	ctx context.Context,
	storage domain.FileStorage,
	key, sourceKind, sealedKind string,
	ownerID int32,
	maxBytes int64,
	allowedContentTypes map[string]bool,
) (SealedObject, error) {
	if storage == nil {
		return SealedObject{}, errors.New("media storage is unavailable")
	}
	key = strings.TrimSpace(key)
	if ownerID <= 0 || key == "" {
		return SealedObject{}, errors.New("invalid media owner or key")
	}

	if IsSealedOwnedKey(key, sealedKind, ownerID) {
		info, err := storage.StatObject(ctx, key)
		if err != nil {
			return SealedObject{}, fmt.Errorf("stat sealed media %q: %w", key, err)
		}
		if err := validateSealedObjectInfo(info, maxBytes, allowedContentTypes); err != nil {
			return SealedObject{}, err
		}
		return SealedObject{SourceKey: key, Key: key, Info: info}, nil
	}
	if !IsOwnedKey(key, sourceKind, ownerID) {
		return SealedObject{}, errors.New("media key is outside the owner's upload scope")
	}

	info, err := storage.StatObject(ctx, key)
	if err != nil {
		return SealedObject{}, fmt.Errorf("stat media %q: %w", key, err)
	}
	if err := validateSealedObjectInfo(info, maxBytes, allowedContentTypes); err != nil {
		return SealedObject{}, err
	}
	if strings.TrimSpace(info.ETag) == "" {
		return SealedObject{}, errors.New("object storage did not return an ETag")
	}

	sourceHash := sha256.Sum256([]byte(key))
	etagHash := sha256.Sum256([]byte(strings.TrimSpace(info.ETag)))
	name := "sealed-" + hex.EncodeToString(sourceHash[:]) + "-" + hex.EncodeToString(etagHash[:]) + SafeExt(key)
	sealedKey := OwnerPrefix(sealedKind, ownerID) + name

	copied, err := storage.CopyObjectIfMatch(ctx, key, sealedKey, info.ETag)
	if err != nil {
		return SealedObject{}, err
	}
	if err := validateSealedObjectInfo(copied, maxBytes, allowedContentTypes); err != nil {
		_ = storage.Delete(ctx, sealedKey)
		return SealedObject{}, fmt.Errorf("validate sealed media: %w", err)
	}
	if strings.TrimSpace(copied.ETag) == "" {
		_ = storage.Delete(ctx, sealedKey)
		return SealedObject{}, errors.New("sealed object storage did not return an ETag")
	}
	if copied.SizeBytes != info.SizeBytes ||
		!strings.EqualFold(strings.TrimSpace(copied.ContentType), strings.TrimSpace(info.ContentType)) {
		_ = storage.Delete(ctx, sealedKey)
		return SealedObject{}, errors.New("sealed object metadata does not match its source")
	}

	return SealedObject{
		SourceKey: key,
		Key:       sealedKey,
		Info:      copied,
		Created:   true,
	}, nil
}

func validateSealedObjectInfo(info domain.ObjectInfo, maxBytes int64, allowedContentTypes map[string]bool) error {
	if info.SizeBytes <= 0 || (maxBytes > 0 && info.SizeBytes > maxBytes) {
		return ErrInvalidMediaSize
	}
	contentType := strings.ToLower(strings.TrimSpace(info.ContentType))
	if len(allowedContentTypes) > 0 && !allowedContentTypes[contentType] {
		return errors.New("invalid media content type")
	}
	return nil
}
