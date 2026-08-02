package email

import (
	"net/mail"
	"strings"
	"testing"
)

func TestAllEmailTemplatesParse(t *testing.T) {
	if _, err := newRenderer(); err != nil {
		t.Fatalf("newRenderer() error = %v", err)
	}
}

func TestOTPEmailUsesCurrentBrand(t *testing.T) {
	r, err := newRenderer()
	if err != nil {
		t.Fatalf("newRenderer() error = %v", err)
	}

	data := struct {
		commonData
		Code       string
		TTLMinutes int
	}{Code: "123456", TTLMinutes: 10}

	textBody, htmlBody, err := r.render(EventOTPCode, data)
	if err != nil {
		t.Fatalf("render() error = %v", err)
	}
	for name, body := range map[string]string{"text": textBody, "html": htmlBody} {
		if !strings.Contains(body, brandName) {
			t.Errorf("%s body does not contain %q", name, brandName)
		}
		if strings.Contains(body, "ДомРядом") || strings.Contains(body, "Дом Рядом") {
			t.Errorf("%s body contains the previous brand", name)
		}
	}
}

func TestBuildMessageUsesBrandedSender(t *testing.T) {
	msg, err := buildMessage(
		&mail.Address{Name: brandName, Address: "notifications@wigaj.ru"},
		"user@example.com",
		"Код подтверждения для приложения ВИГАЖ",
		"Код: 123456",
		"",
	)
	if err != nil {
		t.Fatalf("buildMessage() error = %v", err)
	}
	if !strings.Contains(msg, "From: =?utf-8?b?") || !strings.Contains(msg, " <notifications@wigaj.ru>") {
		t.Fatalf("message has no MIME-encoded branded sender: %q", msg)
	}
}
