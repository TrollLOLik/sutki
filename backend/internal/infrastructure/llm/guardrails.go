package llm

import (
	"log"
	"regexp"
)

var (
	emailRegex = regexp.MustCompile(`(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}`)
	// Matches most RU and international phone formats.
	// E.g. +7 999 123-45-67, 8-999-123-45-67, +7(999)1234567, etc.
	phoneRegex = regexp.MustCompile(`(?i)(?:\+?7|8)[\s\-\(]*\d{3}[\s\-\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}`)
)

// ScrubPII removes emails and phone numbers from user inputs (like reviews text)
func ScrubPII(input string) string {
	scrubbed := emailRegex.ReplaceAllString(input, "[EMAIL_REDACTED]")
	scrubbed = phoneRegex.ReplaceAllString(scrubbed, "[PHONE_REDACTED]")
	return scrubbed
}

// LogPrompt logs the prompt content only if debug/development logs are enabled.
func LogPrompt(debug bool, name string, systemPrompt, userPrompt string) {
	if debug {
		log.Printf("[LLM PROMPT: %s]\nSystem: %s\nUser: %s\n", name, systemPrompt, userPrompt)
	}
}
