package media

import (
	"reflect"
	"testing"
)

func TestIsOwnedKey(t *testing.T) {
	tests := []struct {
		name string
		key  string
		want bool
	}{
		{name: "owned", key: "avatars/42/photo.webp", want: true},
		{name: "other owner", key: "avatars/7/photo.webp", want: false},
		{name: "prefix collision", key: "avatars/420/photo.webp", want: false},
		{name: "legacy", key: "avatars/photo.webp", want: false},
		{name: "public URL", key: "https://cdn.example/avatars/42/photo.webp", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsOwnedKey(tt.key, "avatars", 42); got != tt.want {
				t.Fatalf("IsOwnedKey() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRemovedOwnedKeys(t *testing.T) {
	old := []string{
		"listings/42/removed.jpg",
		"listings/42/kept.jpg",
		"listings/7/foreign.jpg",
		"listings/legacy.jpg",
		"listings/42/removed.jpg",
	}
	current := []string{"listings/42/kept.jpg", "listings/42/new.jpg"}
	want := []string{"listings/42/removed.jpg"}

	if got := RemovedOwnedKeys(old, current, "listings", 42); !reflect.DeepEqual(got, want) {
		t.Fatalf("RemovedOwnedKeys() = %#v, want %#v", got, want)
	}
}
