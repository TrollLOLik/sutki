package review

import (
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"sort"
	"strings"
	"unicode"
)

type textInspection struct {
	Categories []string
	MaskedBody string
}

var profanityPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)[б6b][\s*._-]*[лl][\s*._-]*[яa]`),
	regexp.MustCompile(`(?i)[хx][\s*._-]*[уy][\s*._-]*[йеяю]`),
	regexp.MustCompile(`(?i)[пn][\s*._-]*[иi1][\s*._-]*[з3][\s*._-]*д`),
	regexp.MustCompile(`(?i)[еёe][\s*._-]*[б6b][\s*._-]*[аaуy]`),
	regexp.MustCompile(`(?i)с[\s*._-]*у[\s*._-]*к[\s*._-]*[аa]`),
	regexp.MustCompile(`(?i)д[\s*._-]*о[\s*._-]*л[\s*._-]*б[\s*._-]*о`),
	regexp.MustCompile(`(?i)м[\s*._-]*у[\s*._-]*д[\s*._-]*а`),
}

var reviewPhone = regexp.MustCompile(`(?i)(?:\+?7|8)[\s\-()]*\d{3}[\s\-)]*\d{3}[\s-]*\d{2}[\s-]*\d{2}`)
var reviewEmail = regexp.MustCompile(`(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}`)
var reviewURL = regexp.MustCompile(`(?i)(?:https?://|www\.|t\.me/|wa\.me/)\S+`)

func inspectText(body string) textInspection {
	type span struct{ start, end int }
	var spans []span
	categories := map[string]bool{}
	for _, pattern := range profanityPatterns {
		for _, index := range pattern.FindAllStringIndex(body, -1) {
			spans = append(spans, span{index[0], index[1]})
			categories["profanity"] = true
		}
	}
	if reviewPhone.MatchString(body) || reviewEmail.MatchString(body) {
		categories["contacts"] = true
	}
	if reviewURL.MatchString(body) {
		categories["external_link"] = true
	}
	letters := 0
	for _, r := range body {
		if unicode.IsLetter(r) {
			letters++
		}
	}
	if letters < 2 {
		categories["gibberish"] = true
	}

	result := body
	if len(spans) > 0 {
		sort.Slice(spans, func(i, j int) bool { return spans[i].start < spans[j].start })
		merged := spans[:1]
		for _, current := range spans[1:] {
			last := &merged[len(merged)-1]
			if current.start <= last.end {
				if current.end > last.end {
					last.end = current.end
				}
			} else {
				merged = append(merged, current)
			}
		}
		var b strings.Builder
		cursor := 0
		for _, s := range merged {
			b.WriteString(body[cursor:s.start])
			b.WriteString("***")
			cursor = s.end
		}
		b.WriteString(body[cursor:])
		result = b.String()
	}
	list := make([]string, 0, len(categories))
	for category := range categories {
		list = append(list, category)
	}
	sort.Strings(list)
	return textInspection{Categories: list, MaskedBody: result}
}

func reviewContentHash(kind, body string) string {
	normalized := strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(body))), " ")
	sum := sha256.Sum256([]byte(kind + "\x00" + normalized))
	return hex.EncodeToString(sum[:])
}
