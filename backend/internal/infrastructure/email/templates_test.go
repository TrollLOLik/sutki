package email

import "testing"

func TestAllEmailTemplatesParse(t *testing.T) {
	if _, err := newRenderer(); err != nil {
		t.Fatalf("newRenderer() error = %v", err)
	}
}
