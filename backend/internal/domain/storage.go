package domain

import (
	"context"
	"time"
)

// UploadTarget represents parameters needed by the mobile client to perform direct POST upload to S3
type UploadTarget struct {
	URL      string            `json:"url"`
	FormData map[string]string `json:"form_data"`
	Key      string            `json:"key"`
}

// ObjectInfo holds S3 file metadata verified via StatObject
type ObjectInfo struct {
	SizeBytes   int64
	ContentType string
}

// ObjectData contains a bounded object body read by the backend.
type ObjectData struct {
	Bytes       []byte
	ContentType string
}

// FileStorage defines the port for S3-compatible object storage
type FileStorage interface {
	PresignUpload(ctx context.Context, key string, maxBytes int64, contentType string) (UploadTarget, error)
	PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error)
	StatObject(ctx context.Context, key string) (ObjectInfo, error)
	ReadObject(ctx context.Context, key string, maxBytes int64) (ObjectData, error)
	PublicURL(key string) string
	Delete(ctx context.Context, key string) error
}
