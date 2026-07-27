package media

import (
	"reflect"
	"strings"
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

		// The owner segment is only meaningful if the rest of the key cannot
		// walk out of it. ModerateListingImages deletes what it rejects, so a
		// key that passes this check and names another user's object is a
		// cross-user delete.
		{name: "escapes with ..", key: "avatars/42/../99/photo.webp", want: false},
		{name: "escapes into another kind", key: "avatars/42/../../listings/99/x.jpg", want: false},
		{name: "nested segment", key: "avatars/42/99/photo.webp", want: false},
		{name: "backslash segment", key: `avatars/42/..\99\photo.webp`, want: false},
		{name: "prefix only", key: "avatars/42/", want: false},
		{name: "bare dot", key: "avatars/42/.", want: false},
		{name: "bare dotdot", key: "avatars/42/..", want: false},

		// Still accepted: the cover the moderation worker writes next to a video.
		{name: "derived cover", key: "avatars/42/photo.mp4.cover.jpg", want: true},
		{name: "surrounding whitespace", key: "  avatars/42/photo.webp  ", want: true},
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

// SafeExt is the only thing standing between a client-supplied file name and
// the object key we mint from it. filepath.Ext alone returns whatever followed
// the last dot — unbounded, any bytes — and that string ends up both in the key
// and in the presigned POST policy.
func TestSafeExt(t *testing.T) {
	cases := []struct{ fileName, want string }{
		{"photo.jpg", ".jpg"},
		{"photo.JPEG", ".JPEG"},
		{"archive.tar.gz", ".gz"},
		{"noextension", ""},
		{"trailing.", ""},
		{"", ""},
		{".gitignore", ".gitignore"}, // harmless: bounded and alphanumeric

		// Unbounded length.
		{"x." + strings.Repeat("a", 200), ""},
		{"x." + strings.Repeat("a", 11), ""},
		{"x." + strings.Repeat("a", 10), "." + strings.Repeat("a", 10)},

		// Non-ASCII and separators have no business in a key.
		{"photo.jpég", ""},
		{"photo.jp g", ""},
		{"файл.рф", ""},
		{"weird.js/../../etc", ""},
		// A newline in the name is fine as long as it is not in the result:
		// Ext takes everything after the last dot, which here is ".evil".
		{"photo.jpg\n.evil", ".evil"},

		// "${" reaching the POST policy is how a pinned key becomes a prefix
		// match, which would let the client choose where the object lands.
		{"photo.${filename}", ""},
		{"photo.a${x}", ""},
	}
	for _, tc := range cases {
		if got := SafeExt(tc.fileName); got != tc.want {
			t.Errorf("SafeExt(%q) = %q, want %q", tc.fileName, got, tc.want)
		}
	}
}

// Whatever SafeExt returns is concatenated straight onto a key, so the result
// must never contain something that changes the key's shape.
func TestSafeExt_OutputIsAlwaysKeySafe(t *testing.T) {
	for _, fileName := range []string{
		"a.jpg", "a.", "a", "a.b/c", "a.b\\c", "a.b c", "a." + strings.Repeat("z", 64),
		"a.${x}", "a.b\nc", "a.b\tc", "a..", "a..b", "..", "/", ".",
	} {
		got := SafeExt(fileName)
		if got == "" {
			continue
		}
		if !strings.HasPrefix(got, ".") || len(got) > 11 {
			t.Errorf("SafeExt(%q) = %q: not a bounded dot-extension", fileName, got)
		}
		if strings.ContainsAny(got, "/\\ \t\n\r$&?#%") {
			t.Errorf("SafeExt(%q) = %q: contains a character that must not reach an object key", fileName, got)
		}
	}
}

func TestOwnerPrefix_EndsWithSeparator(t *testing.T) {
	// Without the trailing slash, user 1's prefix is a prefix of user 11's key.
	if got := OwnerPrefix("chat/uploads", 1); got != "chat/uploads/1/" {
		t.Fatalf("OwnerPrefix = %q", got)
	}
	if IsOwnedKey("chat/uploads/11/deadbeef", "chat/uploads", 1) {
		t.Fatal("user 1 claims user 11's key")
	}
	if !IsOwnedKey("chat/uploads/11/deadbeef", "chat/uploads", 11) {
		t.Fatal("user 11 does not claim their own key")
	}
}
