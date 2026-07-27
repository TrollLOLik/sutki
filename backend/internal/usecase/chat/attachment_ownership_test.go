package chat

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

// MEDIA-02. A chat attachment key used to be accepted on the strength of its
// shape plus the object existing in the bucket. Neither says anything about who
// uploaded it, so a participant could lift a key out of a presigned URL they
// legitimately received and:
//
//   - attach it to a message in a different conversation, serving the owner's
//     private photo to a third party who was never in the original chat; and
//   - delete that message inside the 60-minute window, which destroyed the
//     owner's object and left their own message permanently broken.
//
// The key now carries its owner, and every path that accepts or deletes one
// checks it against the caller.

const (
	aliceID int32 = 11
	bobID   int32 = 22
)

func TestOwnsAttachmentKey(t *testing.T) {
	aliceKey := attachmentKey(aliceID, "0123456789abcdef0123456789abcdef", ".jpg")

	cases := []struct {
		name string
		key  string
		user int32
		want bool
	}{
		{"own key", aliceKey, aliceID, true},
		{"own key, no extension", attachmentKey(aliceID, "0123456789abcdef0123456789abcdef", ""), aliceID, true},

		// The attack: Bob presents Alice's key.
		{"another user's key", aliceKey, bobID, false},

		// Legacy keys name no owner, so they belong to nobody.
		{"legacy key", "chat/uploads/0123456789abcdef0123456789abcdef.jpg", aliceID, false},

		// Prefix confusion: user 1 must not reach user 11's objects.
		{"owner id is not a prefix match", attachmentKey(11, "0123456789abcdef0123456789abcdef", ".jpg"), 1, false},

		// Shapes that are not ours at all.
		{"traversal", "chat/uploads/11/../22/0123456789abcdef0123456789abcdef.jpg", aliceID, false},
		{"other namespace", "listings/11/0123456789abcdef0123456789abcdef.jpg", aliceID, false},
		{"nested deeper", "chat/uploads/11/11/0123456789abcdef0123456789abcdef.jpg", aliceID, false},
		{"short hex", "chat/uploads/11/0123456789abcdef.jpg", aliceID, false},
		{"uppercase hex", "chat/uploads/11/0123456789ABCDEF0123456789ABCDEF.jpg", aliceID, false},
		{"absolute url", "https://example.com/chat/uploads/11/0123456789abcdef0123456789abcdef.jpg", aliceID, false},
		{"empty", "", aliceID, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ownsAttachmentKey(tc.key, tc.user); got != tc.want {
				t.Fatalf("ownsAttachmentKey(%q, %d) = %v, want %v", tc.key, tc.user, got, tc.want)
			}
		})
	}
}

func TestOwnsStoredAttachmentKeyAcceptsOnlyOwnersSealedSnapshot(t *testing.T) {
	key := "chat/approved/11/sealed-" + strings.Repeat("a", 64) + "-" + strings.Repeat("b", 64) + ".jpg"
	if !ownsStoredAttachmentKey(key, aliceID) {
		t.Fatalf("owner cannot clean up sealed key %q", key)
	}
	if ownsStoredAttachmentKey(key, bobID) {
		t.Fatalf("another user can claim sealed key %q", key)
	}
}

func TestAttachmentKey_IsOwnerScoped(t *testing.T) {
	key := attachmentKey(aliceID, "0123456789abcdef0123456789abcdef", ".jpg")
	if !strings.HasPrefix(key, "chat/uploads/11/") {
		t.Fatalf("key = %q, want it scoped under the owner", key)
	}
	if !deliveryAttachmentKeyPattern.MatchString(key) {
		t.Fatalf("freshly minted key %q does not match the accepted pattern", key)
	}
	if isLegacyAttachmentKey(key) {
		t.Fatalf("freshly minted key %q reads as legacy", key)
	}
}

// Old conversations have to keep rendering: presignAttachment gates on the
// shape pattern, which must still accept keys minted before the owner segment
// existed — while ownsAttachmentKey (used for attaching and deleting) must not.
func TestLegacyKeys_ReadableButNotAttachable(t *testing.T) {
	legacy := "chat/uploads/0123456789abcdef0123456789abcdef.jpg"

	if !deliveryAttachmentKeyPattern.MatchString(legacy) {
		t.Fatal("legacy key no longer presignable; existing conversations would show broken images")
	}
	if !isLegacyAttachmentKey(legacy) {
		t.Fatal("legacy key not recognised as legacy")
	}
	for _, uid := range []int32{aliceID, bobID, 0} {
		if ownsAttachmentKey(legacy, uid) {
			t.Fatalf("legacy key claimed by user %d; it records no owner and must belong to nobody", uid)
		}
	}
}

func TestAttachmentKeyPattern_AcceptsBothGenerations(t *testing.T) {
	for _, key := range []string{
		"chat/uploads/0123456789abcdef0123456789abcdef.jpg",    // legacy
		"chat/uploads/11/0123456789abcdef0123456789abcdef.jpg", // owner-scoped
		"chat/uploads/0123456789abcdef0123456789abcdef",        // legacy, no extension
		"chat/uploads/11/0123456789abcdef0123456789abcdef",     // scoped, no extension
	} {
		if !deliveryAttachmentKeyPattern.MatchString(key) {
			t.Errorf("pattern rejects %q, which the service mints or already stores", key)
		}
	}
	for _, key := range []string{
		"chat/uploads/",
		"chat/uploads/notahexstring.jpg",
		"chat/uploads/11/",
		"chat/uploads/-1/0123456789abcdef0123456789abcdef.jpg",
		"../chat/uploads/0123456789abcdef0123456789abcdef.jpg",
		"chat/uploads/0123456789abcdef0123456789abcdef.jpg/../../secret",
	} {
		if deliveryAttachmentKeyPattern.MatchString(key) {
			t.Errorf("pattern accepts %q, which the service never mints", key)
		}
	}
}

// The extension clamp itself lives in internal/media (media.SafeExt) and is
// tested there; what matters here is that the chat mint site actually applies
// it — see TestPresignUpload_DropsAnUnusableExtension below.

// The mint sites are what the whole fix rests on: reverting either of them to
// an unscoped key passes every ownership test above while quietly restoring the
// bug. These pin the shape they actually produce.
func TestPresignUpload_MintsAnOwnerScopedKey(t *testing.T) {
	storage := &keyCapturingStorage{}
	svc := &Service{repo: &fakeChatRepo{}, storage: storage}

	if _, err := svc.PresignUpload(context.Background(), aliceID, "photo.jpg", 1024, "image/jpeg"); err != nil {
		t.Fatalf("presign: %v", err)
	}
	if !ownsAttachmentKey(storage.key, aliceID) {
		t.Fatalf("minted key %q is not owned by its uploader", storage.key)
	}
	if ownsAttachmentKey(storage.key, bobID) {
		t.Fatalf("minted key %q is claimable by another user", storage.key)
	}
	if isLegacyAttachmentKey(storage.key) {
		t.Fatalf("minted key %q has no owner segment", storage.key)
	}
}

func TestPresignUpload_RejectsNonPositiveUserID(t *testing.T) {
	// OwnerPrefix formats with %d, so a non-positive id would mint
	// "chat/uploads/-1/…" — a key its own uploader could neither attach nor
	// read. Fail at the source instead.
	svc := &Service{repo: &fakeChatRepo{}, storage: &keyCapturingStorage{}}
	for _, uid := range []int32{0, -1} {
		if _, err := svc.PresignUpload(context.Background(), uid, "photo.jpg", 1024, "image/jpeg"); !errors.Is(err, ErrInvalidAttachment) {
			t.Fatalf("uid %d: got %v, want ErrInvalidAttachment", uid, err)
		}
	}
}

func TestPresignUpload_DropsAnUnusableExtension(t *testing.T) {
	storage := &keyCapturingStorage{}
	svc := &Service{repo: &fakeChatRepo{}, storage: storage}

	if _, err := svc.PresignUpload(context.Background(), aliceID, "photo."+strings.Repeat("a", 300), 1024, "image/jpeg"); err != nil {
		t.Fatalf("presign: %v", err)
	}
	if !ownsAttachmentKey(storage.key, aliceID) {
		t.Fatalf("key %q is not a key we would accept back", storage.key)
	}
	if len(storage.key) > 64 {
		t.Fatalf("key %q is %d chars; the client's file name is leaking into it unbounded", storage.key, len(storage.key))
	}
}

// ---------------------------------------------------------------------------
// The video cover
// ---------------------------------------------------------------------------

// thumbnail_url used to be stored verbatim from client JSON and handed back
// signed. coverKeyFor is what closes that, and it has two plausible-looking
// wrong implementations:
//
//   - return the stored value once it "looks like" a cover key — which keeps
//     whatever the sender wrote, whitespace and all; and
//   - accept any string ending in ".cover.jpg" — which lets Bob's own message
//     row name the cover of Alice's video, and the server signs it for him.
//
// Neither is caught by asserting only on the happy path, so this asserts the
// property instead: whatever comes in, what comes out is this attachment's own
// cover or nothing.
func TestCoverKeyFor_OnlyEverReturnsTheDerivedKey(t *testing.T) {
	alice := attachmentKey(aliceID, strings.Repeat("a", 32), ".mp4")
	bob := attachmentKey(bobID, strings.Repeat("b", 32), ".mp4")
	want := bob + ".cover.jpg"

	for _, stored := range []string{
		"",
		"   ",
		want,
		alice + ".cover.jpg", // the cross-user leak
		"chat/uploads/22/" + strings.Repeat("c", 32) + ".mp4.cover.jpg",
		"listings/22/" + strings.Repeat("d", 32) + ".cover.jpg",
		"../../secret.cover.jpg",
		"https://attacker.example/beacon.cover.jpg",
		"https://attacker.example/beacon.gif",
		strings.ToUpper(bob) + ".COVER.JPG",
		bob,
		bob + ".cover.jpg.evil",
		bob + "/../" + alice + ".cover.jpg",
	} {
		if got := coverKeyFor(bob, stored); got != "" && got != want {
			t.Fatalf("coverKeyFor(%q, %q) = %q: that is not this attachment's own cover", bob, stored, got)
		}
	}

	// Alice's attachment must not pick up Bob's cover either, in either direction.
	if got := coverKeyFor(alice, want); got != "" {
		t.Fatalf("coverKeyFor(alice, bob's cover) = %q, want \"\"", got)
	}

	// The legitimate case has to keep working, or covers silently stop loading
	// for every video in the app.
	if got := coverKeyFor(bob, want); got != want {
		t.Fatalf("coverKeyFor rejected the cover the worker actually writes: got %q", got)
	}
	// Trimmed, not echoed: a stored value carrying whitespace must still resolve
	// to the exact key, never to the untrimmed string (which would be signed as
	// a key that does not exist).
	if got := coverKeyFor(bob, " \t"+want+"\n "); got != want {
		t.Fatalf("coverKeyFor(%q, padded) = %q, want the exact derived key", bob, got)
	}
}

// Every early return in presignAttachment used to hand back the row's stored
// thumbnail. The transient one — PresignGet failing — is reachable in normal
// operation, so this is not theoretical.
func TestPresignAttachment_NeverEchoesAStoredThumbnail(t *testing.T) {
	const poison = "https://attacker.example/beacon.gif"
	key := attachmentKey(aliceID, strings.Repeat("a", 32), ".mp4")

	cases := []struct {
		name    string
		att     domain.MessageAttachment
		storage domain.FileStorage
	}{
		{"no key at all", domain.MessageAttachment{URL: "", ThumbnailURL: poison}, &fakeAttachmentStorage{}},
		{"already an absolute url", domain.MessageAttachment{URL: "https://cdn.example/a.mp4", ThumbnailURL: poison}, &fakeAttachmentStorage{}},
		{"key fails the shape check", domain.MessageAttachment{URL: "chat/uploads/not-a-key", ThumbnailURL: poison}, &fakeAttachmentStorage{}},
		{"storage is down", domain.MessageAttachment{URL: key, ThumbnailURL: poison}, &presignErrorStorage{}},
		{"only the cover fails", domain.MessageAttachment{URL: key, ThumbnailURL: key + ".cover.jpg"},
			&presignErrorStorage{failOn: func(k string) bool { return strings.HasSuffix(k, ".cover.jpg") }}},
		{"stored cover is another user's", domain.MessageAttachment{
			URL:          key,
			ThumbnailURL: attachmentKey(bobID, strings.Repeat("b", 32), ".mp4") + ".cover.jpg",
		}, &fakeAttachmentStorage{}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := &Service{storage: tc.storage}
			got := svc.presignAttachment(context.Background(), tc.att)
			if got.ThumbnailURL != "" {
				t.Fatalf("thumbnail_url = %q; the stored value reached the client", got.ThumbnailURL)
			}
		})
	}

	// And the cover the worker wrote is still served, signed.
	svc := &Service{storage: &fakeAttachmentStorage{}}
	got := svc.presignAttachment(context.Background(), domain.MessageAttachment{
		URL: key, ThumbnailURL: key + ".cover.jpg",
	})
	if !strings.Contains(got.ThumbnailURL, key+".cover.jpg") {
		t.Fatalf("thumbnail_url = %q; the legitimate cover stopped being served", got.ThumbnailURL)
	}
}

// ---------------------------------------------------------------------------
// SendMessage, end to end
// ---------------------------------------------------------------------------

// The helpers above can all be correct while the call site skips them. These
// go through SendMessage itself.
func TestSendMessage_RejectsAKeyTheSenderWasNotIssued(t *testing.T) {
	aliceKey := attachmentKey(aliceID, strings.Repeat("a", 32), ".jpg")
	legacyKey := "chat/uploads/" + strings.Repeat("a", 32) + ".jpg"

	for _, tc := range []struct{ name, key string }{
		{"another participant's key", aliceKey},
		{"a legacy key with no owner", legacyKey},
		{"a key from another namespace", "listings/22/" + strings.Repeat("a", 32) + ".jpg"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeChatRepo{}
			storage := &fakeAttachmentStorage{}
			svc := &Service{repo: repo, storage: storage}

			_, err := svc.SendMessage(context.Background(), bobID, 1, nil, nil,
				[]domain.MessageAttachment{{URL: tc.key}})
			if !errors.Is(err, ErrInvalidAttachment) {
				t.Fatalf("got %v, want ErrInvalidAttachment", err)
			}
			// Ownership is decided from the key alone, before the object is
			// touched: existence in the bucket was exactly the check that was
			// not good enough.
			if storage.statCalls != 0 {
				t.Errorf("StatObject called %d times on a key the sender does not own", storage.statCalls)
			}
			if len(repo.persisted) != 0 {
				t.Error("message persisted despite a rejected attachment")
			}
		})
	}

	// The sender's own key still works, or chat is broken.
	repo := &fakeChatRepo{}
	svc := &Service{repo: repo, storage: &fakeAttachmentStorage{}}
	if _, err := svc.SendMessage(context.Background(), aliceID, 1, nil, nil,
		[]domain.MessageAttachment{{URL: aliceKey}}); err != nil {
		t.Fatalf("Alice sending her own attachment: %v", err)
	}
	if len(repo.persisted) != 1 {
		t.Fatalf("persisted %d attachments, want 1", len(repo.persisted))
	}
}

func TestSendMessage_RejectsAnUnregisteredOwnerShapedKey(t *testing.T) {
	key := attachmentKey(aliceID, strings.Repeat("a", 32), ".jpg")
	repo := &fakeChatRepo{enforceUploads: true}
	storage := &fakeAttachmentStorage{}
	svc := &Service{repo: repo, storage: storage}

	_, err := svc.SendMessage(context.Background(), aliceID, 1, nil, nil,
		[]domain.MessageAttachment{{URL: key}})
	if !errors.Is(err, ErrInvalidAttachment) {
		t.Fatalf("got %v, want ErrInvalidAttachment", err)
	}
	if storage.statCalls != 0 {
		t.Fatalf("StatObject called %d times for a key the server never issued", storage.statCalls)
	}
	if len(repo.persisted) != 0 {
		t.Fatal("message persisted with an unregistered attachment")
	}
}

func TestPresignedUploadCanBeAttachedOnlyByItsRegisteredOwner(t *testing.T) {
	repo := &fakeChatRepo{enforceUploads: true}
	storage := &keyAndObjectStorage{}
	svc := &Service{repo: repo, storage: storage}

	target, err := svc.PresignUpload(context.Background(), aliceID, "photo.jpg", 1024, "image/jpeg")
	if err != nil {
		t.Fatalf("presign: %v", err)
	}

	if _, err := svc.SendMessage(context.Background(), bobID, 1, nil, nil,
		[]domain.MessageAttachment{{URL: target.Key}}); !errors.Is(err, ErrInvalidAttachment) {
		t.Fatalf("Bob attaching Alice's upload: got %v, want ErrInvalidAttachment", err)
	}

	if _, err := svc.SendMessage(context.Background(), aliceID, 1, nil, nil,
		[]domain.MessageAttachment{{URL: target.Key}}); err != nil {
		t.Fatalf("Alice attaching her registered upload: %v", err)
	}
}

// size_bytes, mime_type, thumbnail_url and duration_seconds all arrive in the
// same client JSON as the key. The first two are overwritten from StatObject;
// the last two have no server-side source at send time and must be cleared —
// thumbnail_url especially, since the recipient's device fetches it.
func TestSendMessage_DropsClientSuppliedMediaMetadata(t *testing.T) {
	repo := &fakeChatRepo{}
	svc := &Service{repo: repo, storage: &fakeAttachmentStorage{contentType: "video/mp4"}}

	lie := int32(999999)
	key := attachmentKey(aliceID, strings.Repeat("a", 32), ".mp4")
	msg, err := svc.SendMessage(context.Background(), aliceID, 1, nil, nil, []domain.MessageAttachment{{
		URL:             key,
		ThumbnailURL:    "https://attacker.example/beacon.gif",
		DurationSeconds: &lie,
		MimeType:        "text/plain",
		SizeBytes:       1,
	}})
	if err != nil {
		t.Fatalf("send: %v", err)
	}
	if len(repo.persisted) != 1 {
		t.Fatalf("persisted %d attachments, want 1", len(repo.persisted))
	}

	stored := repo.persisted[0]
	if stored.ThumbnailURL != "" {
		t.Errorf("stored thumbnail_url = %q; the sender chose a URL the recipient's device will fetch", stored.ThumbnailURL)
	}
	if stored.DurationSeconds != nil {
		t.Errorf("stored duration_seconds = %d; it comes from ffprobe, not from the sender", *stored.DurationSeconds)
	}
	if stored.MimeType != "video/mp4" {
		t.Errorf("stored mime_type = %q, want the type StatObject reported", stored.MimeType)
	}
	if stored.SizeBytes != fakeObjectSize {
		t.Errorf("stored size_bytes = %d, want the size StatObject reported", stored.SizeBytes)
	}

	// The response is the other half: it is what the sender's own client renders.
	if len(msg.Attachments) != 1 {
		t.Fatalf("response carries %d attachments, want 1", len(msg.Attachments))
	}
	if strings.Contains(msg.Attachments[0].ThumbnailURL, "attacker.example") {
		t.Errorf("response thumbnail_url = %q", msg.Attachments[0].ThumbnailURL)
	}
}

// One upload, one row. Nothing in the app repeats a key, and each repeat used
// to buy another moderation job for the same bytes — for video that is frame
// extraction plus a vision call per frame, the most expensive work this server
// does, at ten times the cost of the single upload that paid for it.
func TestSendMessage_RejectsDuplicateAttachmentKeys(t *testing.T) {
	key := attachmentKey(aliceID, strings.Repeat("a", 32), ".mp4")
	repo := &fakeChatRepo{}
	queue := &countingModerationQueue{}
	svc := &Service{repo: repo, storage: &fakeAttachmentStorage{contentType: "video/mp4"}, attachmentQueue: queue}

	dup := make([]domain.MessageAttachment, 0, 10)
	for i := 0; i < 10; i++ {
		dup = append(dup, domain.MessageAttachment{URL: key})
	}

	if _, err := svc.SendMessage(context.Background(), aliceID, 1, nil, nil, dup); !errors.Is(err, ErrInvalidAttachment) {
		t.Fatalf("got %v, want ErrInvalidAttachment", err)
	}
	if len(repo.persisted) != 0 {
		t.Errorf("persisted %d rows for one object", len(repo.persisted))
	}
	if queue.jobs != 0 {
		t.Errorf("queued %d moderation jobs for one uploaded object", queue.jobs)
	}
}

// PresignUpload signs video with a 50 MB POST policy, so S3 accepts a 20 MB
// clip — which is what the app's own picker allows. SendMessage then measured
// every attachment against the 15 MB photo limit and DELETED anything above it,
// so the upload the server had just accepted was destroyed at the finish line.
func TestSendMessage_SizeLimitMatchesTheOneItSigned(t *testing.T) {
	cases := []struct {
		name        string
		contentType string
		size        int64
		wantErr     bool
	}{
		{"20 MB video is accepted", "video/mp4", 20 << 20, false},
		{"50 MB video is accepted", "video/mp4", maxVideoBytes, false},
		{"above the video ceiling is refused", "video/mp4", maxVideoBytes + 1, true},
		{"15 MB photo is accepted", "image/jpeg", maxAttachmentBytes, false},
		{"20 MB photo is refused", "image/jpeg", 20 << 20, true},
		{"20 MB document is refused", "application/pdf", 20 << 20, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			key := attachmentKey(aliceID, strings.Repeat("a", 32), "")
			repo := &fakeChatRepo{}
			storage := &fakeAttachmentStorage{contentType: tc.contentType, size: tc.size}
			svc := &Service{repo: repo, storage: storage}

			_, err := svc.SendMessage(context.Background(), aliceID, 1, nil, nil,
				[]domain.MessageAttachment{{URL: key}})

			switch {
			case tc.wantErr && !errors.Is(err, ErrAttachmentTooLarge):
				t.Fatalf("got %v, want ErrAttachmentTooLarge", err)
			case !tc.wantErr && err != nil:
				t.Fatalf("unexpected error: %v", err)
			}
			if !tc.wantErr {
				if len(storage.deleted) != 1 || storage.deleted[0] != key {
					t.Fatalf("deleted %v; only the replayable upload source should be removed", storage.deleted)
				}
				if len(repo.persisted) != 1 || repo.persisted[0].URL == key {
					t.Fatalf("message did not retain an immutable snapshot: %+v", repo.persisted)
				}
			}
		})
	}

	// PresignUpload and SendMessage have to agree, or the disagreement is
	// exactly the file-eating bug above.
	for _, ct := range []string{"video/mp4", "video/quicktime", "image/jpeg", "image/gif", "application/pdf"} {
		storage := &limitCapturingStorage{}
		svc := &Service{storage: storage, repo: &alwaysAllowedMediaRepo{}}
		if _, err := svc.PresignUpload(context.Background(), aliceID, "f.bin", 1024, ct); err != nil {
			t.Fatalf("presign %s: %v", ct, err)
		}
		if storage.maxBytes != attachmentSizeLimit(ct) {
			t.Errorf("%s: policy signs %d bytes but SendMessage accepts %d", ct, storage.maxBytes, attachmentSizeLimit(ct))
		}
	}
}

// width/height are a layout hint from the picker, but they are consumed on the
// RECIPIENT's device, which derives a view height from height/width. Only the
// sender can delete the message, and only for an hour, so an implausible pair
// is a wedge the recipient cannot clear.
func TestSendMessage_DropsImplausibleDimensions(t *testing.T) {
	dim := func(v int32) *int32 { return &v }

	cases := []struct {
		name          string
		width, height *int32
		wantW, wantH  *int32
	}{
		{"real photo survives", dim(4032), dim(3024), dim(4032), dim(3024)},
		{"int32 max is dropped", dim(1), dim(2147483647), dim(1), nil},
		{"negative is dropped", dim(-1), dim(-1), nil, nil},
		{"zero is dropped", dim(0), dim(0), nil, nil},
		{"absent stays absent", nil, nil, nil, nil},
		{"one bad, one good", dim(100), dim(999999), dim(100), nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeChatRepo{}
			svc := &Service{repo: repo, storage: &fakeAttachmentStorage{}}
			_, err := svc.SendMessage(context.Background(), aliceID, 1, nil, nil, []domain.MessageAttachment{{
				URL:    attachmentKey(aliceID, strings.Repeat("a", 32), ".jpg"),
				Width:  tc.width,
				Height: tc.height,
			}})
			if err != nil {
				t.Fatalf("send: %v", err)
			}
			if len(repo.persisted) != 1 {
				t.Fatalf("persisted %d rows", len(repo.persisted))
			}
			got := repo.persisted[0]
			if !sameDim(got.Width, tc.wantW) || !sameDim(got.Height, tc.wantH) {
				t.Fatalf("persisted %s × %s, want %s × %s",
					fmtDim(got.Width), fmtDim(got.Height), fmtDim(tc.wantW), fmtDim(tc.wantH))
			}
		})
	}
}

func sameDim(a, b *int32) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func fmtDim(v *int32) string {
	if v == nil {
		return "nil"
	}
	return strconv.Itoa(int(*v))
}

// The other half of the same bug: a message row may name a key its sender does
// not own — every row written before ownership was enforced can — and deleting
// the message used to delete that object, destroying a file still referenced by
// a conversation the deleter is not part of.
func TestDeleteMessage_OnlyDeletesObjectsTheDeleterOwns(t *testing.T) {
	ownKey := attachmentKey(bobID, strings.Repeat("b", 32), ".jpg")
	foreignKey := attachmentKey(aliceID, strings.Repeat("a", 32), ".jpg")
	legacyKey := "chat/uploads/" + strings.Repeat("c", 32) + ".jpg"

	deletes := make(chan string, 8)
	// Bob's own key goes last: the cleanup loop is sequential, so seeing it
	// means the two keys before it have already been decided.
	repo := &deletingChatRepo{keys: []string{foreignKey, legacyKey, ownKey}}
	svc := &Service{repo: repo, storage: &channelDeleteStorage{deletes: deletes}}

	if _, err := svc.DeleteMessage(context.Background(), bobID, 41); err != nil {
		t.Fatalf("delete: %v", err)
	}

	var got []string
	deadline := time.After(5 * time.Second)
	for {
		select {
		case key := <-deletes:
			got = append(got, key)
			if key == ownKey {
				if len(got) != 1 {
					t.Fatalf("deleted %v; only the deleter's own object may be removed", got)
				}
				return
			}
		case <-deadline:
			t.Fatalf("cleanup never reached the deleter's own object; deleted %v", got)
		}
	}
}

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

// keyCapturingStorage records the key PresignUpload asks for. Only the two
// methods that path touches are meaningful.
type keyCapturingStorage struct {
	domain.FileStorage
	key string
}

func (s *keyCapturingStorage) PresignUpload(_ context.Context, key string, _ int64, _ string) (domain.UploadTarget, error) {
	s.key = key
	return domain.UploadTarget{Key: key}, nil
}

// limitCapturingStorage records the content-length-range ceiling that goes into
// the POST policy — the value S3 enforces at upload time.
type limitCapturingStorage struct {
	domain.FileStorage
	maxBytes int64
}

func (s *limitCapturingStorage) PresignUpload(_ context.Context, key string, maxBytes int64, _ string) (domain.UploadTarget, error) {
	s.maxBytes = maxBytes
	return domain.UploadTarget{Key: key}, nil
}

type keyAndObjectStorage struct {
	domain.FileStorage
}

func (s *keyAndObjectStorage) PresignUpload(_ context.Context, key string, _ int64, _ string) (domain.UploadTarget, error) {
	return domain.UploadTarget{Key: key}, nil
}

func (s *keyAndObjectStorage) StatObject(_ context.Context, _ string) (domain.ObjectInfo, error) {
	return domain.ObjectInfo{SizeBytes: 1024, ContentType: "image/jpeg", ETag: `"object"`}, nil
}

func (s *keyAndObjectStorage) CopyObjectIfMatch(context.Context, string, string, string) (domain.ObjectInfo, error) {
	return domain.ObjectInfo{SizeBytes: 1024, ContentType: "image/jpeg", ETag: `"sealed"`}, nil
}

func (s *keyAndObjectStorage) PresignGet(_ context.Context, key string, _ time.Duration) (string, error) {
	return "https://signed.example/" + key, nil
}

func (s *keyAndObjectStorage) Delete(context.Context, string) error { return nil }

// alwaysAllowedMediaRepo passes the account-standing gate on video uploads.
type alwaysAllowedMediaRepo struct {
	domain.ChatRepository
}

func (r *alwaysAllowedMediaRepo) GetUserMediaStanding(_ context.Context, _ int32) (domain.UserMediaStanding, error) {
	verified := time.Now().Add(-30 * 24 * time.Hour)
	return domain.UserMediaStanding{PhoneVerifiedAt: &verified, CreatedAt: verified}, nil
}

func (r *alwaysAllowedMediaRepo) RegisterChatUpload(context.Context, domain.ChatUpload) error {
	return nil
}

// countingModerationQueue counts the jobs a single message produces.
type countingModerationQueue struct {
	jobs int
}

func (q *countingModerationQueue) Enqueue(_ context.Context, _ domain.AttachmentModerationJob) error {
	q.jobs++
	return nil
}

const fakeObjectSize int64 = 4096

// fakeAttachmentStorage reports every object as present and signs any key.
type fakeAttachmentStorage struct {
	domain.FileStorage
	contentType string
	size        int64 // 0 means fakeObjectSize
	statCalls   int
	deleted     []string
}

func (s *fakeAttachmentStorage) StatObject(_ context.Context, key string) (domain.ObjectInfo, error) {
	s.statCalls++
	ct := s.contentType
	if ct == "" {
		ct = "image/jpeg"
	}
	size := s.size
	if size == 0 {
		size = fakeObjectSize
	}
	etag := `"source"`
	if strings.HasPrefix(key, sealedAttachmentKeyKind+"/") {
		etag = `"sealed"`
	}
	return domain.ObjectInfo{SizeBytes: size, ContentType: ct, ETag: etag}, nil
}

func (s *fakeAttachmentStorage) CopyObjectIfMatch(_ context.Context, _, _ string, _ string) (domain.ObjectInfo, error) {
	ct := s.contentType
	if ct == "" {
		ct = "image/jpeg"
	}
	size := s.size
	if size == 0 {
		size = fakeObjectSize
	}
	return domain.ObjectInfo{SizeBytes: size, ContentType: ct, ETag: `"sealed"`}, nil
}

func (s *fakeAttachmentStorage) PresignGet(_ context.Context, key string, _ time.Duration) (string, error) {
	return "https://signed.example/" + key + "?sig=x", nil
}

func (s *fakeAttachmentStorage) Delete(_ context.Context, key string) error {
	s.deleted = append(s.deleted, key)
	return nil
}

// presignErrorStorage fails signing, either for every key or for the ones
// failOn selects.
type presignErrorStorage struct {
	domain.FileStorage
	failOn func(key string) bool
}

func (s *presignErrorStorage) PresignGet(_ context.Context, key string, _ time.Duration) (string, error) {
	if s.failOn == nil || s.failOn(key) {
		return "", errors.New("storage unavailable")
	}
	return "https://signed.example/" + key + "?sig=x", nil
}

// fakeChatRepo answers only what SendMessage asks of it and snapshots the
// attachments handed to CreateMessage — that snapshot is the row as it would
// be written.
type fakeChatRepo struct {
	domain.ChatRepository
	persisted      []domain.MessageAttachment
	uploads        map[string]int32
	sealedKeys     map[string]string
	sealedETags    map[string]string
	enforceUploads bool
}

func (r *fakeChatRepo) CheckParticipantExists(_ context.Context, _ int64, _ int32) (bool, error) {
	return true, nil
}

func (r *fakeChatRepo) IsOtherParticipantDeleted(_ context.Context, _ int64, _ int32) (bool, error) {
	return false, nil
}

func (r *fakeChatRepo) GetOtherParticipantID(_ context.Context, _ int64, _ int32) (int32, error) {
	return bobID, nil
}

func (r *fakeChatRepo) RegisterChatUpload(_ context.Context, upload domain.ChatUpload) error {
	if r.uploads == nil {
		r.uploads = make(map[string]int32)
	}
	r.uploads[upload.ObjectKey] = upload.OwnerID
	return nil
}

func (r *fakeChatRepo) GetChatUploads(_ context.Context, userID int32, keys []string) ([]domain.ChatUpload, error) {
	uploads := make([]domain.ChatUpload, 0, len(keys))
	for _, key := range keys {
		ownerID := userID
		if r.enforceUploads {
			ownerID = r.uploads[key]
			if ownerID != userID {
				continue
			}
		}
		uploads = append(uploads, domain.ChatUpload{
			ObjectKey:   key,
			OwnerID:     ownerID,
			SealedKey:   r.sealedKeys[key],
			ContentETag: r.sealedETags[key],
		})
	}
	return uploads, nil
}

func (r *fakeChatRepo) SealChatUpload(_ context.Context, userID int32, objectKey, sealedKey, contentETag string) error {
	if r.enforceUploads && r.uploads[objectKey] != userID {
		return domain.ErrChatUploadNotOwned
	}
	if r.sealedKeys == nil {
		r.sealedKeys = make(map[string]string)
		r.sealedETags = make(map[string]string)
	}
	if existing := r.sealedKeys[objectKey]; existing != "" && existing != sealedKey {
		return domain.ErrChatUploadNotOwned
	}
	r.sealedKeys[objectKey] = sealedKey
	r.sealedETags[objectKey] = contentETag
	return nil
}

func (r *fakeChatRepo) CheckChatUploadOwnership(_ context.Context, userID int32, keys []string) (bool, error) {
	if !r.enforceUploads {
		return true, nil
	}
	for _, key := range keys {
		if r.uploads[key] != userID {
			return false, nil
		}
	}
	return true, nil
}

// channelDeleteStorage reports every Delete on a channel so the background
// cleanup can be observed without a sleep.
type channelDeleteStorage struct {
	domain.FileStorage
	deletes chan string
}

func (s *channelDeleteStorage) Delete(_ context.Context, key string) error {
	s.deletes <- key
	return nil
}

// deletingChatRepo authorises one delete by bobID and hands back keys.
type deletingChatRepo struct {
	domain.ChatRepository
	keys []string
}

func (r *deletingChatRepo) GetMessageForMutation(_ context.Context, messageID int64, _ int32) (domain.MessageMutationInfo, error) {
	sender := bobID
	return domain.MessageMutationInfo{
		ID:             messageID,
		ConversationID: 1,
		SenderID:       &sender,
		Kind:           domain.MessageKindUser,
		CreatedAt:      time.Now(),
	}, nil
}

func (r *deletingChatRepo) SoftDeleteMessage(_ context.Context, messageID int64, _ int32, _ time.Duration) (domain.Message, []string, bool, error) {
	sender := bobID
	now := time.Now()
	return domain.Message{ID: messageID, ConversationID: 1, SenderID: &sender, DeletedAt: &now}, r.keys, true, nil
}

func (r *deletingChatRepo) GetOtherParticipantID(_ context.Context, _ int64, _ int32) (int32, error) {
	return aliceID, nil
}

func (r *fakeChatRepo) CreateMessage(_ context.Context, convID int64, senderID int32, body *string, replyTo *int64, attachments []domain.MessageAttachment) (domain.Message, error) {
	r.persisted = append(r.persisted, attachments...)
	return domain.Message{
		ID:               1,
		ConversationID:   convID,
		SenderID:         &senderID,
		Body:             body,
		ReplyToMessageID: replyTo,
		Attachments:      append([]domain.MessageAttachment(nil), attachments...),
	}, nil
}
