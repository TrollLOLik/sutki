package moderation

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

// prefilterHit is a rule-based flag raised before any LLM call.
type prefilterHit struct {
	Category string
	Reason   string
	Decision string // "reject" or "review"
}

var (
	// Reuses the same shapes as llm.ScrubPII but adds messengers and links —
	// channels commonly used to move deals off-platform.
	phoneRe     = regexp.MustCompile(`(?i)(?:\+?7|8)[\s\-\(]*\d{3}[\s\-\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}`)
	emailRe     = regexp.MustCompile(`(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}`)
	messengerRe = regexp.MustCompile(`(?i)(?:t\.me/|telegram\.me/|wa\.me/|viber://|whatsapp|вотсап|ватсап|телеграм[\s:@]|тг[\s:@])`)
	urlRe       = regexp.MustCompile(`(?i)(?:https?://|www\.)[^\s]+`)
	letterRe    = regexp.MustCompile(`[a-zA-Zа-яА-ЯёЁ]`)
)

// stopWords are unambiguous prohibited-content markers. Deliberately short
// and conservative: anything subtle is the LLM's job, not the prefilter's.
var stopWords = []string{
	// drugs
	"наркотик", "мефедрон", "амфетамин", "гашиш", "марихуан", "закладк",
	// weapons
	"оружие продам", "продам оружие", "боеприпас",
	// sex services
	"эскорт", "интим услуг", "проститу",
	// documents fraud
	"поддельн документ", "купить справк",
}

// runPrefilter checks the free-text bundle of a listing. It returns hits in
// priority order; an empty slice means the text passed to the LLM stage.
// Contact details are a review flag, not an auto-reject: per product policy
// the final call on off-platform contacts is a human/business decision.
func runPrefilter(text string) []prefilterHit {
	var hits []prefilterHit
	lower := strings.ToLower(text)

	for _, w := range stopWords {
		if strings.Contains(lower, w) {
			hits = append(hits, prefilterHit{
				Category: "prohibited",
				Reason:   "Стоп-слово в тексте объявления: «" + w + "»",
				Decision: "reject",
			})
			break // one prohibited hit is enough
		}
	}

	if phoneRe.MatchString(text) || emailRe.MatchString(text) {
		hits = append(hits, prefilterHit{
			Category: "contacts",
			Reason:   "Контактные данные (телефон/email) в тексте объявления",
			Decision: "review",
		})
	} else if messengerRe.MatchString(text) {
		hits = append(hits, prefilterHit{
			Category: "contacts",
			Reason:   "Ссылка на мессенджер в тексте объявления",
			Decision: "review",
		})
	}

	if urlRe.MatchString(text) {
		hits = append(hits, prefilterHit{
			Category: "external_link",
			Reason:   "Внешняя ссылка в тексте объявления",
			Decision: "review",
		})
	}

	return hits
}

// runPrefilterHouse checks all structured fields of a listing (price, description length)
// as well as text-based regex patterns before any LLM stage.
func runPrefilterHouse(h domain.ModerationHouse) []prefilterHit {
	var hits []prefilterHit

	// 1. Check for unreasonably low price (anti-test/anti-scam)
	if h.Price < 150 {
		hits = append(hits, prefilterHit{
			Category: "scam",
			Reason:   fmt.Sprintf("Аномально низкая цена: %d ₽ за сутки (минимальная разрешённая цена 150 ₽)", h.Price),
			Decision: "reject",
		})
	}

	// 2. Check for too short or gibberish description (anti-spam/anti-draft)
	trimmedDesc := strings.TrimSpace(h.Description)
	if len(trimmedDesc) == 0 {
		hits = append(hits, prefilterHit{
			Category: "spam",
			Reason:   "Описание пустое",
			Decision: "reject",
		})
	} else if !letterRe.MatchString(trimmedDesc) {
		hits = append(hits, prefilterHit{
			Category: "spam",
			Reason:   "Описание не содержит букв (нечитаемый мусор)",
			Decision: "reject",
		})
	} else if len(trimmedDesc) < 5 {
		hits = append(hits, prefilterHit{
			Category: "spam",
			Reason:   "Описание слишком короткое (менее 5 символов)",
			Decision: "reject",
		})
	}

	// 3. Run standard text-based prefilter checks
	text := moderatedText(h)
	hits = append(hits, runPrefilter(text)...)

	return hits
}
