package moderation

import (
	"regexp"
	"strings"
)

// prefilterHit is a rule-based flag raised before any LLM call.
type prefilterHit struct {
	Category string
	Reason   string
}

var (
	// Reuses the same shapes as llm.ScrubPII but adds messengers and links —
	// channels commonly used to move deals off-platform.
	phoneRe     = regexp.MustCompile(`(?i)(?:\+?7|8)[\s\-\(]*\d{3}[\s\-\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}`)
	emailRe     = regexp.MustCompile(`(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}`)
	messengerRe = regexp.MustCompile(`(?i)(?:t\.me/|telegram\.me/|wa\.me/|viber://|whatsapp|вотсап|ватсап|телеграм[\s:@]|тг[\s:@])`)
	urlRe       = regexp.MustCompile(`(?i)(?:https?://|www\.)[^\s]+`)
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
			})
			break // one prohibited hit is enough
		}
	}

	if phoneRe.MatchString(text) || emailRe.MatchString(text) {
		hits = append(hits, prefilterHit{
			Category: "contacts",
			Reason:   "Контактные данные (телефон/email) в тексте объявления",
		})
	} else if messengerRe.MatchString(text) {
		hits = append(hits, prefilterHit{
			Category: "contacts",
			Reason:   "Ссылка на мессенджер в тексте объявления",
		})
	}

	if urlRe.MatchString(text) {
		hits = append(hits, prefilterHit{
			Category: "external_link",
			Reason:   "Внешняя ссылка в тексте объявления",
		})
	}

	return hits
}
