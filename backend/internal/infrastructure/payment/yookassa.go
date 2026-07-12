package payment

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type YookassaConfig struct {
	APIURL  string
	ShopID  string
	Secret  string
	Timeout time.Duration
}

type YookassaProvider struct {
	apiURL string
	shopID string
	secret string
	client *http.Client
}

func NewYookassaProvider(cfg YookassaConfig) (*YookassaProvider, error) {
	if cfg.APIURL == "" {
		cfg.APIURL = "https://api.yookassa.ru/v3"
	}
	if cfg.ShopID == "" || cfg.Secret == "" {
		return nil, fmt.Errorf("yookassa shop id and secret are required")
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 15 * time.Second
	}
	return &YookassaProvider{
		apiURL: strings.TrimRight(cfg.APIURL, "/"), shopID: cfg.ShopID, secret: cfg.Secret,
		client: &http.Client{Timeout: cfg.Timeout},
	}, nil
}

func (p *YookassaProvider) Name() string { return "yookassa" }

type yooMoney struct {
	Value    string `json:"value"`
	Currency string `json:"currency"`
}

type yooReceipt struct {
	Customer domain.ReceiptCustomer `json:"customer"`
	Items    []yooReceiptItem       `json:"items"`
}

type yooReceiptItem struct {
	Description    string   `json:"description"`
	Quantity       string   `json:"quantity"`
	Amount         yooMoney `json:"amount"`
	VATCode        int16    `json:"vat_code"`
	PaymentSubject string   `json:"payment_subject"`
	PaymentMode    string   `json:"payment_mode"`
}

type yooPayment struct {
	ID                  string            `json:"id"`
	Status              string            `json:"status"`
	Paid                bool              `json:"paid"`
	Amount              yooMoney          `json:"amount"`
	Metadata            map[string]string `json:"metadata"`
	ReceiptRegistration string            `json:"receipt_registration"`
	Confirmation        struct {
		ConfirmationURL string `json:"confirmation_url"`
	} `json:"confirmation"`
}

type yooRefund struct {
	ID                  string   `json:"id"`
	PaymentID           string   `json:"payment_id"`
	Status              string   `json:"status"`
	Amount              yooMoney `json:"amount"`
	ReceiptRegistration string   `json:"receipt_registration"`
}

func (p *YookassaProvider) CreatePayment(ctx context.Context, in domain.ProviderCreatePayment) (domain.ProviderPayment, error) {
	body := struct {
		Amount       yooMoney          `json:"amount"`
		Capture      bool              `json:"capture"`
		Confirmation map[string]string `json:"confirmation"`
		Description  string            `json:"description"`
		Metadata     map[string]string `json:"metadata"`
		Receipt      *yooReceipt       `json:"receipt,omitempty"`
	}{
		Amount:  yooMoney{Value: formatKopecks(in.Money.AmountKopecks), Currency: in.Money.Currency},
		Capture: in.Capture, Confirmation: map[string]string{"type": "redirect", "return_url": in.ReturnURL},
		Description: in.Description, Metadata: in.Metadata, Receipt: toYooReceipt(in.Receipt),
	}
	var out yooPayment
	if err := p.do(ctx, http.MethodPost, "/payments", in.IdempotencyKey, body, &out); err != nil {
		return domain.ProviderPayment{}, err
	}
	return fromYooPayment(out)
}

func (p *YookassaProvider) GetPayment(ctx context.Context, id string) (domain.ProviderPayment, error) {
	var out yooPayment
	if err := p.do(ctx, http.MethodGet, "/payments/"+id, "", nil, &out); err != nil {
		return domain.ProviderPayment{}, err
	}
	return fromYooPayment(out)
}

func (p *YookassaProvider) CreateRefund(ctx context.Context, in domain.ProviderCreateRefund) (domain.ProviderRefund, error) {
	body := struct {
		PaymentID   string      `json:"payment_id"`
		Amount      yooMoney    `json:"amount"`
		Description string      `json:"description"`
		Receipt     *yooReceipt `json:"receipt,omitempty"`
	}{
		PaymentID:   in.PaymentID,
		Amount:      yooMoney{Value: formatKopecks(in.Money.AmountKopecks), Currency: in.Money.Currency},
		Description: in.Description,
		Receipt:     toYooReceipt(in.Receipt),
	}
	var out yooRefund
	if err := p.do(ctx, http.MethodPost, "/refunds", in.IdempotencyKey, body, &out); err != nil {
		return domain.ProviderRefund{}, err
	}
	return fromYooRefund(out)
}

func (p *YookassaProvider) GetRefund(ctx context.Context, id string) (domain.ProviderRefund, error) {
	var out yooRefund
	if err := p.do(ctx, http.MethodGet, "/refunds/"+id, "", nil, &out); err != nil {
		return domain.ProviderRefund{}, err
	}
	return fromYooRefund(out)
}

func (p *YookassaProvider) ParseWebhook(body []byte) (domain.ProviderWebhook, error) {
	var payload struct {
		Type   string          `json:"type"`
		Event  string          `json:"event"`
		Object json.RawMessage `json:"object"`
	}
	if err := json.Unmarshal(body, &payload); err != nil || payload.Type != "notification" || payload.Event == "" {
		return domain.ProviderWebhook{}, domain.ErrInvalidWebhook
	}
	var object struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(payload.Object, &object); err != nil || object.ID == "" {
		return domain.ProviderWebhook{}, domain.ErrInvalidWebhook
	}
	return domain.ProviderWebhook{Event: payload.Event, ObjectID: object.ID, Raw: append([]byte(nil), body...)}, nil
}

func (p *YookassaProvider) do(ctx context.Context, method, path, idempotencyKey string, body, out any) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, p.apiURL+path, reader)
	if err != nil {
		return err
	}
	req.SetBasicAuth(p.shopID, p.secret)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if idempotencyKey != "" {
		req.Header.Set("Idempotence-Key", idempotencyKey)
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("%w: request: %v", domain.ErrPaymentProviderFailed, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return domain.ErrPaymentNotFound
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		limited, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		var providerErr struct {
			Code        string `json:"code"`
			Description string `json:"description"`
		}
		_ = json.Unmarshal(limited, &providerErr)
		message := strings.TrimSpace(providerErr.Code + " " + providerErr.Description)
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return fmt.Errorf("%w: status=%d: %s", domain.ErrPaymentProviderFailed, resp.StatusCode, message)
	}
	if out == nil {
		return nil
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(out); err != nil {
		return fmt.Errorf("%w: decode response: %v", domain.ErrPaymentProviderFailed, err)
	}
	return nil
}

func toYooReceipt(in *domain.Receipt) *yooReceipt {
	if in == nil {
		return nil
	}
	out := &yooReceipt{Customer: in.Customer, Items: make([]yooReceiptItem, 0, len(in.Items))}
	for _, item := range in.Items {
		out.Items = append(out.Items, yooReceiptItem{
			Description: item.Description, Quantity: item.Quantity,
			Amount:  yooMoney{Value: formatKopecks(item.AmountKopecks), Currency: item.Currency},
			VATCode: item.VATCode, PaymentSubject: item.PaymentSubject, PaymentMode: item.PaymentMode,
		})
	}
	return out
}

func fromYooPayment(in yooPayment) (domain.ProviderPayment, error) {
	amount, err := parseKopecks(in.Amount.Value)
	if err != nil {
		return domain.ProviderPayment{}, err
	}
	return domain.ProviderPayment{
		ID: in.ID, Status: in.Status, Paid: in.Paid,
		Money:           domain.Money{AmountKopecks: amount, Currency: in.Amount.Currency},
		ConfirmationURL: in.Confirmation.ConfirmationURL, Metadata: in.Metadata,
		ReceiptRegistration: in.ReceiptRegistration,
	}, nil
}

func fromYooRefund(in yooRefund) (domain.ProviderRefund, error) {
	amount, err := parseKopecks(in.Amount.Value)
	if err != nil {
		return domain.ProviderRefund{}, err
	}
	return domain.ProviderRefund{
		ID: in.ID, PaymentID: in.PaymentID, Status: in.Status,
		Money:               domain.Money{AmountKopecks: amount, Currency: in.Amount.Currency},
		ReceiptRegistration: in.ReceiptRegistration,
	}, nil
}

var _ domain.PaymentProvider = (*YookassaProvider)(nil)
var _ domain.PaymentProvider = (*MockProvider)(nil)
