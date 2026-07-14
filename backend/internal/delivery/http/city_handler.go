package http

import (
	"bytes"
	"io"
	"net/http"
	"strings"
)

// CityHandler handles proxy requests to the Dadata API.
type CityHandler struct {
	apiKey string
}

func NewCityHandler(apiKey string) *CityHandler {
	return &CityHandler{apiKey: apiKey}
}

// Suggest proxies the address/city autocomplete search request to Dadata.
func (h *CityHandler) Suggest(w http.ResponseWriter, r *http.Request) {
	if h.apiKey == "" {
		writeJSON(w, http.StatusOK, map[string]any{"suggestions": []any{}})
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}

	req, err := http.NewRequestWithContext(r.Context(), "POST", "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", bytes.NewReader(bodyBytes))
	if err != nil {
		writeInternalError(w, r, err, "failed to create proxy request")
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Token "+h.apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		if r.Context().Err() != nil {
			return
		}
		writeError(w, http.StatusBadGateway, "dadata request failed")
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// IPLocate determines the client's city via Dadata iplocate method using their IP address.
func (h *CityHandler) IPLocate(w http.ResponseWriter, r *http.Request) {
	if h.apiKey == "" {
		writeJSON(w, http.StatusOK, map[string]any{"location": nil})
		return
	}

	// Chi RealIP middleware resolves X-Real-IP or X-Forwarded-For
	ip := r.Header.Get("X-Real-IP")
	if ip == "" {
		ip = r.Header.Get("X-Forwarded-For")
	}
	if ip == "" {
		ip = r.RemoteAddr
		if idx := strings.LastIndex(ip, ":"); idx != -1 {
			ip = ip[:idx]
		}
	}

	url := "https://suggestions.dadata.ru/suggestions/api/4_1/rs/iplocate/address"
	// Only append IP query param if it's a valid public IPv4/IPv6 address
	if ip != "" && ip != "127.0.0.1" && ip != "::1" && !strings.HasPrefix(ip, "10.") && !strings.HasPrefix(ip, "192.168.") && !strings.HasPrefix(ip, "172.16.") {
		url += "?ip=" + ip
	}

	req, err := http.NewRequestWithContext(r.Context(), "GET", url, nil)
	if err != nil {
		writeInternalError(w, r, err, "failed to create proxy request")
		return
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Token "+h.apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		if r.Context().Err() != nil {
			return
		}
		writeError(w, http.StatusBadGateway, "dadata request failed")
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}
