package ucaller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

var fourDigitCode = regexp.MustCompile(`^[0-9]{4}$`)

type Config struct {
	APIURL    string
	APIKey    string
	ServiceID string
	Enabled   bool
	Timeout   time.Duration
}

type Client struct {
	cfg        Config
	httpClient *http.Client
}

func NewClient(cfg Config) *Client {
	if cfg.APIURL == "" {
		cfg.APIURL = "https://api.ucaller.ru"
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 10 * time.Second
	}
	return &Client{cfg: cfg, httpClient: &http.Client{Timeout: cfg.Timeout}}
}

type APIError struct {
	Code    int
	Message string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("ucaller error: code=%d, message=%s", e.Code, e.Message)
}

type initCallRequest struct {
	Phone  int64  `json:"phone"`
	Code   string `json:"code,omitempty"`
	Client string `json:"client,omitempty"`
	Unique string `json:"unique"`
	Voice  bool   `json:"voice,omitempty"`
}

func (c *Client) StartCall(ctx context.Context, req domain.PhoneCallRequest) (domain.PhoneCallResult, error) {
	if !fourDigitCode.MatchString(req.Code) {
		return domain.PhoneCallResult{}, errors.New("ucaller code must contain exactly four digits")
	}
	if !c.cfg.Enabled {
		return domain.PhoneCallResult{
			Provider:           "mock",
			ProviderDeliveryID: "mock-" + req.IdempotencyID,
			Code:               req.Code,
			Mode:               req.Mode,
		}, nil
	}

	body := initCallRequest{
		Phone:  0,
		Code:   req.Code,
		Client: req.Client,
		Unique: req.IdempotencyID,
		Voice:  req.Mode == domain.PhoneDeliveryModeVoice,
	}
	phoneDigits := strings.TrimPrefix(req.Phone, "+")
	phoneNumber, err := strconv.ParseInt(phoneDigits, 10, 64)
	if err != nil {
		return domain.PhoneCallResult{}, fmt.Errorf("parse ucaller phone: %w", err)
	}
	body.Phone = phoneNumber
	payload, err := json.Marshal(body)
	if err != nil {
		return domain.PhoneCallResult{}, fmt.Errorf("marshal ucaller request: %w", err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(c.cfg.APIURL, "/")+"/v1.0/initCall", bytes.NewReader(payload))
	if err != nil {
		return domain.PhoneCallResult{}, fmt.Errorf("create ucaller request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.cfg.APIKey+"."+c.cfg.ServiceID)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return domain.PhoneCallResult{}, fmt.Errorf("call ucaller: %w", err)
	}
	defer resp.Body.Close()

	var decoded struct {
		Status    bool            `json:"status"`
		UCallerID int64           `json:"ucaller_id"`
		Code      json.RawMessage `json:"code"`
		Exists    bool            `json:"exists"`
		Error     string          `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return domain.PhoneCallResult{}, fmt.Errorf("decode ucaller response: %w", err)
	}
	if resp.StatusCode != http.StatusOK || !decoded.Status {
		var errorCode int
		_ = json.Unmarshal(decoded.Code, &errorCode)
		return domain.PhoneCallResult{}, &APIError{Code: errorCode, Message: decoded.Error}
	}
	// The response is authoritative; leading zeroes must be preserved.
	var effectiveCode string
	if err := json.Unmarshal(decoded.Code, &effectiveCode); err != nil || !fourDigitCode.MatchString(effectiveCode) {
		return domain.PhoneCallResult{}, errors.New("ucaller returned an invalid effective code")
	}
	return domain.PhoneCallResult{
		Provider:           "ucaller",
		ProviderDeliveryID: fmt.Sprintf("%d", decoded.UCallerID),
		Code:               effectiveCode,
		Mode:               req.Mode,
		Reused:             decoded.Exists,
	}, nil
}
