package chat

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

const (
	attachmentSniffBytes       = 4096
	maxOOXMLContentTypesBytes  = 256 * 1024
	maxOOXMLEntries            = 4096
	legacyOfficeContainerType  = "application/x-ole-storage"
	genericZIPContainerType    = "application/zip"
	docxContentTypeDeclaration = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
	xlsxContentTypeDeclaration = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
)

// detectStoredAttachmentType verifies the bytes of an immutable chat object.
// S3 Content-Type is user-controlled metadata and is deliberately ignored when
// deciding whether the object is media that requires moderation.
func detectStoredAttachmentType(
	ctx context.Context,
	storage domain.FileStorage,
	key string,
	info domain.ObjectInfo,
	declaredType string,
) (string, error) {
	reader, ok := storage.(domain.ObjectPrefixReader)
	if !ok {
		return "", errors.New("object storage does not support content sniffing")
	}
	prefix, err := reader.ReadObjectPrefix(ctx, key, attachmentSniffBytes)
	if err != nil {
		return "", fmt.Errorf("read attachment signature: %w", err)
	}
	if len(prefix.Bytes) == 0 {
		return "", fmt.Errorf("%w: empty object", ErrFileContentNotAllowed)
	}

	declaredType = normalizeContentType(declaredType)
	detectedType := detectAttachmentPrefix(prefix.Bytes)
	switch detectedType {
	case legacyOfficeContainerType:
		// Legacy DOC and XLS share the same OLE Compound File signature. Without
		// a heavyweight parser they cannot be distinguished reliably, but the
		// signature still proves that an image/video was not disguised as one.
		if declaredType != "application/msword" && declaredType != "application/vnd.ms-excel" {
			return "", contentTypeMismatch(declaredType, detectedType)
		}
		detectedType = declaredType
	case genericZIPContainerType:
		if info.SizeBytes <= 0 || info.SizeBytes > maxAttachmentBytes {
			return "", fmt.Errorf("%w: invalid OOXML object size", ErrFileContentNotAllowed)
		}
		object, readErr := storage.ReadObject(ctx, key, info.SizeBytes)
		if readErr != nil {
			return "", fmt.Errorf("read OOXML attachment: %w", readErr)
		}
		detectedType, err = detectOOXMLType(object.Bytes)
		if err != nil {
			return "", err
		}
	}

	if !allowedUploadTypes[detectedType] {
		return "", fmt.Errorf("%w: detected unsupported type %q", ErrFileContentNotAllowed, detectedType)
	}
	if declaredType != detectedType {
		return "", contentTypeMismatch(declaredType, detectedType)
	}
	return detectedType, nil
}

func normalizeContentType(contentType string) string {
	contentType = strings.ToLower(strings.TrimSpace(contentType))
	if idx := strings.IndexByte(contentType, ';'); idx >= 0 {
		contentType = strings.TrimSpace(contentType[:idx])
	}
	return contentType
}

func contentTypeMismatch(declaredType, detectedType string) error {
	return fmt.Errorf(
		"%w: declared %q, detected %q",
		ErrFileContentNotAllowed,
		declaredType,
		detectedType,
	)
}

func detectAttachmentPrefix(data []byte) string {
	if len(data) >= 12 && bytes.Equal(data[4:8], []byte("ftyp")) {
		return detectISOBaseMediaType(data)
	}
	if len(data) >= 8 && bytes.Equal(data[:8], []byte{0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1}) {
		return legacyOfficeContainerType
	}

	detected := normalizeContentType(http.DetectContentType(data))
	switch detected {
	case "image/jpeg",
		"image/png",
		"image/gif",
		"image/webp",
		"application/pdf",
		"text/plain":
		return detected
	case "application/zip":
		return genericZIPContainerType
	default:
		return detected
	}
}

func detectISOBaseMediaType(data []byte) string {
	brands := make([]string, 0, 8)
	for offset := 8; offset+4 <= len(data) && offset < 40; offset += 4 {
		brands = append(brands, string(data[offset:offset+4]))
	}
	for _, brand := range brands {
		if brand == "qt  " {
			return "video/quicktime"
		}
	}
	for _, brand := range brands {
		switch brand {
		case "isom", "iso2", "iso3", "iso4", "iso5", "iso6",
			"mp41", "mp42", "M4V ", "M4A ", "avc1", "dash", "MSNV",
			"3gp4", "3gp5", "3gp6":
			return "video/mp4"
		}
	}
	return "application/octet-stream"
}

func detectOOXMLType(data []byte) (string, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("%w: invalid ZIP container", ErrFileContentNotAllowed)
	}
	if len(reader.File) == 0 || len(reader.File) > maxOOXMLEntries {
		return "", fmt.Errorf("%w: invalid OOXML entry count", ErrFileContentNotAllowed)
	}

	var (
		hasRootRelationships bool
		hasWordDocument      bool
		hasExcelWorkbook     bool
		contentTypesFile     *zip.File
	)
	for _, file := range reader.File {
		switch file.Name {
		case "[Content_Types].xml":
			contentTypesFile = file
		case "_rels/.rels":
			hasRootRelationships = true
		case "word/document.xml":
			hasWordDocument = true
		case "xl/workbook.xml":
			hasExcelWorkbook = true
		}
	}
	if contentTypesFile == nil || !hasRootRelationships || hasWordDocument == hasExcelWorkbook {
		return "", fmt.Errorf("%w: malformed OOXML package", ErrFileContentNotAllowed)
	}

	contentTypes, err := readZIPEntry(contentTypesFile, maxOOXMLContentTypesBytes)
	if err != nil {
		return "", fmt.Errorf("%w: invalid OOXML content types", ErrFileContentNotAllowed)
	}
	switch {
	case hasWordDocument && bytes.Contains(contentTypes, []byte(docxContentTypeDeclaration)):
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document", nil
	case hasExcelWorkbook && bytes.Contains(contentTypes, []byte(xlsxContentTypeDeclaration)):
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nil
	default:
		return "", fmt.Errorf("%w: unsupported or macro-enabled OOXML package", ErrFileContentNotAllowed)
	}
}

func readZIPEntry(file *zip.File, maxBytes int64) ([]byte, error) {
	if file.UncompressedSize64 > uint64(maxBytes) {
		return nil, errors.New("ZIP entry is too large")
	}
	reader, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	data, err := io.ReadAll(io.LimitReader(reader, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBytes {
		return nil, errors.New("ZIP entry is too large")
	}
	return data, nil
}
