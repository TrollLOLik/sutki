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
	ETag        string
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
	// PutObject writes bytes produced server-side (video covers, moderation
	// frames). Client uploads still go through PresignUpload — this is only for
	// content the backend generates itself.
	PutObject(ctx context.Context, key string, data []byte, contentType string) error
	// CopyObjectIfMatch snapshots a client upload under a key clients cannot
	// write. The source ETag closes the metadata-check/copy race.
	CopyObjectIfMatch(ctx context.Context, sourceKey, destinationKey, sourceETag string) (ObjectInfo, error)
	PublicURL(key string) string
	Delete(ctx context.Context, key string) error
}
