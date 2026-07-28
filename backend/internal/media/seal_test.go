package media

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type sealTestObject struct {
	data        []byte
	contentType string
	etag        string
}

type sealTestStorage struct {
	objects          map[string]sealTestObject
	mutateBeforeCopy bool
}

func (s *sealTestStorage) PresignUpload(context.Context, string, int64, string) (domain.UploadTarget, error) {
	return domain.UploadTarget{}, errors.New("not implemented")
}

func (s *sealTestStorage) PresignGet(context.Context, string, time.Duration) (string, error) {
	return "", errors.New("not implemented")
}

func (s *sealTestStorage) StatObject(_ context.Context, key string) (domain.ObjectInfo, error) {
	object, ok := s.objects[key]
	if !ok {
		return domain.ObjectInfo{}, errors.New("not found")
	}
	return domain.ObjectInfo{
		SizeBytes:   int64(len(object.data)),
		ContentType: object.contentType,
		ETag:        object.etag,
	}, nil
}

func (s *sealTestStorage) ReadObject(_ context.Context, key string, maxBytes int64) (domain.ObjectData, error) {
	object, ok := s.objects[key]
	if !ok {
		return domain.ObjectData{}, errors.New("not found")
	}
	if int64(len(object.data)) > maxBytes {
		return domain.ObjectData{}, errors.New("too large")
	}
	return domain.ObjectData{Bytes: append([]byte(nil), object.data...), ContentType: object.contentType}, nil
}

func (s *sealTestStorage) PutObject(_ context.Context, key string, data []byte, contentType string) error {
	s.objects[key] = sealTestObject{data: append([]byte(nil), data...), contentType: contentType, etag: `"put"`}
	return nil
}

func (s *sealTestStorage) CopyObjectIfMatch(_ context.Context, sourceKey, destinationKey, sourceETag string) (domain.ObjectInfo, error) {
	source, ok := s.objects[sourceKey]
	if !ok {
		return domain.ObjectInfo{}, errors.New("not found")
	}
	if s.mutateBeforeCopy {
		source.data = []byte("replayed malicious bytes")
		source.etag = `"attacker-version"`
		s.objects[sourceKey] = source
	}
	if normalizeTestETag(source.etag) != normalizeTestETag(sourceETag) {
		return domain.ObjectInfo{}, errors.New("copy precondition failed")
	}
	copied := sealTestObject{
		data:        append([]byte(nil), source.data...),
		contentType: source.contentType,
		etag:        source.etag,
	}
	s.objects[destinationKey] = copied
	return domain.ObjectInfo{
		SizeBytes:   int64(len(copied.data)),
		ContentType: copied.contentType,
		ETag:        copied.etag,
	}, nil
}

func (s *sealTestStorage) PublicURL(key string) string { return "https://media.invalid/" + key }

func (s *sealTestStorage) Delete(_ context.Context, key string) error {
	delete(s.objects, key)
	return nil
}

func TestSealOwnedObjectReplayCannotChangeSnapshot(t *testing.T) {
	const sourceKey = "listings/42/0123456789abcdef0123456789abcdef.jpg"
	storage := &sealTestStorage{objects: map[string]sealTestObject{
		sourceKey: {
			data:        []byte("approved benign bytes"),
			contentType: "image/jpeg",
			etag:        `"approved-version"`,
		},
	}}

	sealed, err := SealOwnedObject(
		context.Background(),
		storage,
		sourceKey,
		"listings",
		"listings",
		42,
		1024,
		map[string]bool{"image/jpeg": true},
	)
	if err != nil {
		t.Fatalf("seal: %v", err)
	}
	if !sealed.Created || sealed.Key == sourceKey || !IsSealedOwnedKey(sealed.Key, "listings", 42) {
		t.Fatalf("unexpected sealed object: %+v", sealed)
	}

	// The same presigned form is replayed after approval and overwrites the
	// original key. Public/listing DTOs retain sealed.Key, not sourceKey.
	storage.objects[sourceKey] = sealTestObject{
		data:        []byte("malicious replacement"),
		contentType: "image/jpeg",
		etag:        `"attacker-version"`,
	}

	got, err := storage.ReadObject(context.Background(), sealed.Key, 1024)
	if err != nil {
		t.Fatalf("read sealed: %v", err)
	}
	if !bytes.Equal(got.Bytes, []byte("approved benign bytes")) {
		t.Fatalf("sealed bytes changed after source replay: %q", got.Bytes)
	}
}

func TestSealOwnedObjectRejectsHeadCopyRace(t *testing.T) {
	const sourceKey = "avatars/42/0123456789abcdef0123456789abcdef.png"
	storage := &sealTestStorage{
		objects: map[string]sealTestObject{
			sourceKey: {
				data:        []byte("approved benign bytes"),
				contentType: "image/png",
				etag:        `"approved-version"`,
			},
		},
		mutateBeforeCopy: true,
	}

	if _, err := SealOwnedObject(
		context.Background(),
		storage,
		sourceKey,
		"avatars",
		"avatars",
		42,
		1024,
		map[string]bool{"image/png": true},
	); err == nil {
		t.Fatal("ETag change between stat and copy was accepted")
	}
	for key := range storage.objects {
		if IsSealedOwnedKey(key, "avatars", 42) {
			t.Fatalf("race left a trusted snapshot behind: %q", key)
		}
	}
}

func normalizeTestETag(etag string) string {
	if len(etag) >= 2 && etag[0] == '"' && etag[len(etag)-1] == '"' {
		return etag[1 : len(etag)-1]
	}
	return etag
}
