package auth

import (
	"errors"
	"strings"
)

var ErrInvalidPhone = errors.New("invalid phone number")

func NormalizePhone(raw string) (string, error) {
	var sb strings.Builder
	for _, r := range raw {
		if (r >= '0' && r <= '9') || r == '+' {
			sb.WriteRune(r)
		}
	}
	cleaned := sb.String()

	if strings.HasPrefix(cleaned, "+7") {
		if len(cleaned) != 12 {
			return "", ErrInvalidPhone
		}
		return cleaned, nil
	}

	if strings.HasPrefix(cleaned, "7") {
		if len(cleaned) != 11 {
			return "", ErrInvalidPhone
		}
		return "+7" + cleaned[1:], nil
	}

	if strings.HasPrefix(cleaned, "8") {
		if len(cleaned) != 11 {
			return "", ErrInvalidPhone
		}
		return "+7" + cleaned[1:], nil
	}

	return "", ErrInvalidPhone
}
