package auth

import "testing"

func TestNormalizePhone(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    string
		wantErr bool
	}{
		{"valid +7 format", "+79991234567", "+79991234567", false},
		{"valid 8 format", "89991234567", "+79991234567", false},
		{"valid 7 format", "79991234567", "+79991234567", false},
		{"spaces and dashes", "+7 999 123-45-67", "+79991234567", false},
		{"parentheses", "8 (999) 123-4567", "+79991234567", false},
		{"too short", "+7999123", "", true},
		{"too long", "899912345678", "", true},
		{"invalid country code", "+380991234567", "", true},
		{"invalid characters", "+7999123456a", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizePhone(tt.raw)
			if (err != nil) != tt.wantErr {
				t.Errorf("NormalizePhone() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("NormalizePhone() = %v, want %v", got, tt.want)
			}
		})
	}
}
