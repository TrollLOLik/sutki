package chat

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type contentSniffStorage struct {
	domain.FileStorage
	data        []byte
	contentType string
}

func (s *contentSniffStorage) ReadObjectPrefix(_ context.Context, _ string, maxBytes int64) (domain.ObjectData, error) {
	data := s.data
	if int64(len(data)) > maxBytes {
		data = data[:maxBytes]
	}
	return domain.ObjectData{Bytes: data, ContentType: s.contentType}, nil
}

func (s *contentSniffStorage) ReadObject(_ context.Context, _ string, maxBytes int64) (domain.ObjectData, error) {
	if int64(len(s.data)) > maxBytes {
		return domain.ObjectData{}, errors.New("object exceeds read limit")
	}
	return domain.ObjectData{Bytes: s.data, ContentType: s.contentType}, nil
}

func (s *fakeAttachmentStorage) ReadObjectPrefix(_ context.Context, _ string, maxBytes int64) (domain.ObjectData, error) {
	data := s.objectBytes
	if len(data) == 0 {
		data = sampleAttachmentBytes(s.normalizedContentType())
	}
	if int64(len(data)) > maxBytes {
		data = data[:maxBytes]
	}
	return domain.ObjectData{Bytes: data, ContentType: s.normalizedContentType()}, nil
}

func (s *fakeAttachmentStorage) ReadObject(_ context.Context, _ string, maxBytes int64) (domain.ObjectData, error) {
	data := s.objectBytes
	if len(data) == 0 {
		data = sampleAttachmentBytes(s.normalizedContentType())
	}
	if int64(len(data)) > maxBytes {
		return domain.ObjectData{}, errors.New("object exceeds read limit")
	}
	return domain.ObjectData{Bytes: data, ContentType: s.normalizedContentType()}, nil
}

func (s *fakeAttachmentStorage) normalizedContentType() string {
	if s.contentType == "" {
		return "image/jpeg"
	}
	return s.contentType
}

func (s *keyAndObjectStorage) ReadObjectPrefix(_ context.Context, _ string, maxBytes int64) (domain.ObjectData, error) {
	data := sampleAttachmentBytes("image/jpeg")
	if int64(len(data)) > maxBytes {
		data = data[:maxBytes]
	}
	return domain.ObjectData{Bytes: data, ContentType: "image/jpeg"}, nil
}

func (s *imageChatStorage) ReadObjectPrefix(_ context.Context, _ string, maxBytes int64) (domain.ObjectData, error) {
	data := sampleAttachmentBytes("image/jpeg")
	if int64(len(data)) > maxBytes {
		data = data[:maxBytes]
	}
	return domain.ObjectData{Bytes: data, ContentType: "image/jpeg"}, nil
}

func TestDetectStoredAttachmentType(t *testing.T) {
	docx := sampleAttachmentBytes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	xlsx := sampleAttachmentBytes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	arbitraryZIP := makeZIP(map[string]string{"payload.bin": "not an office document"})

	tests := []struct {
		name     string
		declared string
		data     []byte
		want     string
		wantErr  bool
	}{
		{"jpeg", "image/jpeg", sampleAttachmentBytes("image/jpeg"), "image/jpeg", false},
		{"png", "image/png", sampleAttachmentBytes("image/png"), "image/png", false},
		{"animated gif", "image/gif", sampleAttachmentBytes("image/gif"), "image/gif", false},
		{"webp", "image/webp", sampleAttachmentBytes("image/webp"), "image/webp", false},
		{"mp4", "video/mp4", sampleAttachmentBytes("video/mp4"), "video/mp4", false},
		{"quicktime", "video/quicktime", sampleAttachmentBytes("video/quicktime"), "video/quicktime", false},
		{"pdf", "application/pdf", sampleAttachmentBytes("application/pdf"), "application/pdf", false},
		{"plain text", "text/plain", sampleAttachmentBytes("text/plain"), "text/plain", false},
		{"legacy word", "application/msword", sampleAttachmentBytes("application/msword"), "application/msword", false},
		{"legacy excel", "application/vnd.ms-excel", sampleAttachmentBytes("application/vnd.ms-excel"), "application/vnd.ms-excel", false},
		{"docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", false},
		{"xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", false},
		{"jpeg disguised as pdf", "application/pdf", sampleAttachmentBytes("image/jpeg"), "", true},
		{"mp4 disguised as pdf", "application/pdf", sampleAttachmentBytes("video/mp4"), "", true},
		{"html disguised as text", "text/plain", []byte("<!doctype html><script>alert(1)</script>"), "", true},
		{"random bytes disguised as pdf", "application/pdf", []byte{0x00, 0x01, 0x02, 0x03}, "", true},
		{"arbitrary zip disguised as docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", arbitraryZIP, "", true},
		{"docx declared as xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", docx, "", true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			storage := &contentSniffStorage{data: tc.data, contentType: tc.declared}
			got, err := detectStoredAttachmentType(
				context.Background(),
				storage,
				"chat/approved/7/test",
				domain.ObjectInfo{SizeBytes: int64(len(tc.data)), ContentType: tc.declared},
				tc.declared,
			)
			if tc.wantErr {
				if !errors.Is(err, ErrFileContentNotAllowed) {
					t.Fatalf("got %v, want ErrFileContentNotAllowed", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("detect: %v", err)
			}
			if got != tc.want {
				t.Fatalf("detected %q, want %q", got, tc.want)
			}
		})
	}
}

func TestSendMessageRejectsMediaDisguisedAsDocument(t *testing.T) {
	repo := &fakeChatRepo{defaultMimeType: "application/pdf"}
	storage := &fakeAttachmentStorage{
		contentType: "application/pdf",
		objectBytes: sampleAttachmentBytes("image/jpeg"),
	}
	service := &Service{
		repo:            repo,
		storage:         storage,
		attachmentQueue: &countingModerationQueue{},
	}
	key := attachmentKey(aliceID, strings.Repeat("a", 32), ".pdf")

	_, err := service.SendMessage(
		context.Background(),
		aliceID,
		1,
		nil,
		nil,
		[]domain.MessageAttachment{{URL: key, FileName: "invoice.pdf"}},
	)
	if !errors.Is(err, ErrFileContentNotAllowed) {
		t.Fatalf("got %v, want ErrFileContentNotAllowed", err)
	}
	if len(repo.persisted) != 0 {
		t.Fatal("message with disguised media was persisted")
	}
	if len(repo.sealedKeys) != 0 {
		t.Fatal("rejected immutable object was persisted in chat_upload")
	}
	if len(storage.deleted) != 2 {
		t.Fatalf("deleted %v, want immutable copy and replayable source", storage.deleted)
	}
}

func sampleAttachmentBytes(contentType string) []byte {
	switch contentType {
	case "image/jpeg":
		return append([]byte{0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10}, []byte("JFIF\x00test-image")...)
	case "image/png":
		return []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 'I', 'H', 'D', 'R'}
	case "image/gif":
		return []byte("GIF89a\x01\x00\x01\x00\x00\x00\x00")
	case "image/webp":
		return []byte("RIFF\x10\x00\x00\x00WEBPVP8 \x00\x00\x00\x00")
	case "video/mp4":
		return []byte{0x00, 0x00, 0x00, 0x18, 'f', 't', 'y', 'p', 'm', 'p', '4', '2', 0, 0, 0, 0, 'm', 'p', '4', '2', 'i', 's', 'o', 'm'}
	case "video/quicktime":
		return []byte{0x00, 0x00, 0x00, 0x14, 'f', 't', 'y', 'p', 'q', 't', ' ', ' ', 0, 0, 0, 0, 'q', 't', ' ', ' '}
	case "application/pdf":
		return []byte("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n")
	case "text/plain":
		return []byte("Plain UTF-8 text file.\n")
	case "application/msword", "application/vnd.ms-excel":
		return []byte{0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00, 0x00, 0x00}
	case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		return makeOOXML("word/document.xml", docxContentTypeDeclaration)
	case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		return makeOOXML("xl/workbook.xml", xlsxContentTypeDeclaration)
	default:
		return []byte{0x00}
	}
}

func makeOOXML(mainPart, mainContentType string) []byte {
	return makeZIP(map[string]string{
		"[Content_Types].xml": `<Types><Override PartName="/` + mainPart + `" ContentType="` + mainContentType + `"/></Types>`,
		"_rels/.rels":         `<Relationships/>`,
		mainPart:              `<root/>`,
	})
}

func makeZIP(files map[string]string) []byte {
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for name, content := range files {
		entry, err := writer.Create(name)
		if err != nil {
			panic(err)
		}
		if _, err := entry.Write([]byte(content)); err != nil {
			panic(err)
		}
	}
	if err := writer.Close(); err != nil {
		panic(err)
	}
	return buffer.Bytes()
}
