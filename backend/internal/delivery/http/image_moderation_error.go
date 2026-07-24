package http

import (
	"errors"
	"strings"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func unsafeImagePublicMessage(err error) string {
	var violation *domain.UnsafeImageError
	if !errors.As(err, &violation) {
		return "Изображение не прошло модерацию. Выберите другое фото."
	}
	if violation.Decision == domain.ImageModerationReview {
		return "Фото не удалось однозначно проверить. Выберите другое изображение."
	}

	switch strings.ToLower(strings.TrimSpace(violation.Category)) {
	case "sexual":
		return "На фото обнаружен откровенный или сексуальный контент."
	case "minor_safety":
		return "Фото содержит недопустимый контент с участием несовершеннолетних."
	case "violence":
		return "На фото обнаружены сцены жестокого насилия."
	case "drugs":
		return "На фото обнаружена демонстрация наркотических веществ."
	case "weapons":
		return "На фото обнаружена демонстрация оружия."
	case "extremism":
		return "На фото обнаружены запрещённые экстремистские материалы."
	case "personal_data":
		return "На фото видны чувствительные персональные данные."
	case "illegal":
		return "На фото обнаружено незаконное содержимое."
	case "invalid_image":
		return "Файл повреждён или имеет неподдерживаемый формат изображения."
	default:
		return "Содержимое фото нарушает правила сервиса. Выберите другое изображение."
	}
}
