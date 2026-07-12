package payment

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

func TestYookassaCreatePaymentContract(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/payments" {
			t.Fatalf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		user, pass, ok := r.BasicAuth()
		if !ok || user != "shop" || pass != "secret" {
			t.Fatal("missing basic auth")
		}
		if got := r.Header.Get("Idempotence-Key"); got != "idem" {
			t.Fatalf("idempotence key=%q", got)
		}
		var body struct {
			Amount   yooMoney          `json:"amount"`
			Receipt  *yooReceipt       `json:"receipt"`
			Metadata map[string]string `json:"metadata"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.Amount.Value != "199.00" || body.Amount.Currency != "RUB" {
			t.Fatalf("bad amount: %+v", body.Amount)
		}
		if body.Receipt == nil || len(body.Receipt.Items) != 1 || body.Receipt.Items[0].VATCode != 1 {
			t.Fatalf("bad receipt: %+v", body.Receipt)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"pay-1","status":"pending","paid":false,"amount":{"value":"199.00","currency":"RUB"},"confirmation":{"confirmation_url":"https://checkout"},"metadata":{"local_payment_id":"42"}}`))
	}))
	defer server.Close()
	p, err := NewYookassaProvider(YookassaConfig{APIURL: server.URL, ShopID: "shop", Secret: "secret", Timeout: time.Second})
	if err != nil {
		t.Fatal(err)
	}
	out, err := p.CreatePayment(context.Background(), domain.ProviderCreatePayment{
		IdempotencyKey: "idem", Money: domain.Money{AmountKopecks: 19900, Currency: "RUB"},
		ReturnURL: "domryadom://payment/return", Metadata: map[string]string{"local_payment_id": "42"},
		Receipt: &domain.Receipt{Customer: domain.ReceiptCustomer{Email: "a@example.com"}, Items: []domain.ReceiptItem{{Description: "Публикация", Quantity: "1.00", AmountKopecks: 19900, Currency: "RUB", VATCode: 1, PaymentSubject: "service", PaymentMode: "full_payment"}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if out.ID != "pay-1" || out.ConfirmationURL != "https://checkout" {
		t.Fatalf("unexpected result: %+v", out)
	}
}

func TestYookassaWebhookShape(t *testing.T) {
	p := &YookassaProvider{}
	event, err := p.ParseWebhook([]byte(`{"type":"notification","event":"payment.succeeded","object":{"id":"pay-1","status":"succeeded"}}`))
	if err != nil {
		t.Fatal(err)
	}
	if event.Event != "payment.succeeded" || event.ObjectID != "pay-1" {
		t.Fatalf("unexpected event: %+v", event)
	}
}
