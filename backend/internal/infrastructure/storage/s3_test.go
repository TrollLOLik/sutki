package storage

import "testing"

func TestPublicURLIncludesBucketForPathStyleEndpoint(t *testing.T) {
	storage := &S3Storage{
		bucket:       "public-bucket",
		publicURL:    "https://s3.example.test",
		endpoint:     "https://s3.example.test/",
		usePathStyle: true,
	}

	got := storage.PublicURL("/listings/42/photo.jpg")
	want := "https://s3.example.test/public-bucket/listings/42/photo.jpg"
	if got != want {
		t.Fatalf("PublicURL() = %q, want %q", got, want)
	}
}

func TestPublicURLKeepsCustomPublicDomain(t *testing.T) {
	storage := &S3Storage{
		bucket:       "public-bucket",
		publicURL:    "https://media.example.test",
		endpoint:     "https://s3.example.test",
		usePathStyle: true,
	}

	got := storage.PublicURL("listings/42/photo.jpg")
	want := "https://media.example.test/listings/42/photo.jpg"
	if got != want {
		t.Fatalf("PublicURL() = %q, want %q", got, want)
	}
}

func TestPublicURLDoesNotDuplicateBucketAlreadyInBase(t *testing.T) {
	storage := &S3Storage{
		bucket:       "public-bucket",
		publicURL:    "https://s3.example.test/public-bucket",
		endpoint:     "https://s3.example.test",
		usePathStyle: true,
	}

	got := storage.PublicURL("listings/42/photo.jpg")
	want := "https://s3.example.test/public-bucket/listings/42/photo.jpg"
	if got != want {
		t.Fatalf("PublicURL() = %q, want %q", got, want)
	}
}
