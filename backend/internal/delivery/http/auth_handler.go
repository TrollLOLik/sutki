package http

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

// AuthHandler serves the email-code authentication API.
type AuthHandler struct {
	svc *auth.Service
}

func NewAuthHandler(svc *auth.Service) *AuthHandler {
	return &AuthHandler{svc: svc}
}

// Routes registers the public auth endpoints.
func (h *AuthHandler) Routes(r chi.Router) {
	r.Post("/email/request", h.requestCode)
	r.Post("/email/verify", h.verifyCode)
	r.Post("/refresh", h.refresh)
	r.Post("/logout", h.logout)
}

type userDTO struct {
	ID            int32   `json:"id"`
	Email         string  `json:"email"`
	Name          string  `json:"name"`
	Phone         string  `json:"phone"`
	City          string  `json:"city"`
	AvatarURL     string  `json:"avatar_url"`
	IsVerified    bool    `json:"is_verified"`
	Birthday      *string `json:"birthday"`
	ListingsCount int32   `json:"listings_count"`
	Rating        float64 `json:"rating"`
}

func toUserDTO(u domain.User) userDTO {
	var bdayStr *string
	if u.Birthday != nil {
		s := u.Birthday.Format("2006-01-02")
		bdayStr = &s
	}
	return userDTO{
		ID:            u.ID,
		Email:         u.Email,
		Name:          u.Name,
		Phone:         u.Phone,
		City:          u.City,
		AvatarURL:     u.AvatarURL,
		IsVerified:    u.IsVerified,
		Birthday:      bdayStr,
		ListingsCount: u.ListingsCount,
		Rating:        u.Rating,
	}
}

type authResponse struct {
	TokenType    string  `json:"token_type"`
	AccessToken  string  `json:"access_token"`
	RefreshToken string  `json:"refresh_token"`
	ExpiresIn    int64   `json:"expires_in"`
	User         userDTO `json:"user"`
}

func toAuthResponse(res auth.AuthResult) authResponse {
	return authResponse{
		TokenType:    "Bearer",
		AccessToken:  res.AccessToken,
		RefreshToken: res.RefreshToken,
		ExpiresIn:    res.ExpiresIn,
		User:         toUserDTO(res.User),
	}
}

func (h *AuthHandler) requestCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	res, err := h.svc.RequestCode(r.Context(), body.Email)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	resp := map[string]any{"sent": true, "expires_in": res.ExpiresIn}
	if res.Exposed {
		resp["dev_code"] = res.Code
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) verifyCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	res, err := h.svc.VerifyCode(r.Context(), body.Email, body.Code)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toAuthResponse(res))
}

func (h *AuthHandler) refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	res, err := h.svc.Refresh(r.Context(), body.RefreshToken)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toAuthResponse(res))
}

func (h *AuthHandler) logout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if err := h.svc.Logout(r.Context(), body.RefreshToken); err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Me returns the authenticated user (requires AuthMiddleware).
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	user, err := h.svc.GetUser(r.Context(), userID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, toUserDTO(user))
}

// UpdateMe updates the authenticated user's profile (requires AuthMiddleware).
func (h *AuthHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	// Pointer fields distinguish "omitted" (nil, left unchanged) from "set to
	// empty" so PATCH does not clobber fields the client didn't send.
	var body struct {
		Name         *string `json:"name"`
		Phone        *string `json:"phone"`
		City         *string `json:"city"`
		Birthday     *string `json:"birthday"`
		AvatarURL    *string `json:"avatar_url"`
		VKID         *string `json:"vk_id"`
		VKIDDoNull   *bool   `json:"vk_id_do_null"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	var bday *time.Time
	if body.Birthday != nil && *body.Birthday != "" {
		t, err := time.Parse("2006-01-02", *body.Birthday)
		if err != nil {
			// fallback to DD.MM.YYYY
			t, err = time.Parse("02.01.2006", *body.Birthday)
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid birthday format (expected YYYY-MM-DD)")
			return
		}
		bday = &t
	}
	user, err := h.svc.UpdateProfile(r.Context(), userID, body.Name, body.Phone, body.City, body.AvatarURL, bday, body.VKID, body.VKIDDoNull)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, toUserDTO(user))
}

// DeleteMe deletes the authenticated user's account (requires AuthMiddleware).
func (h *AuthHandler) DeleteMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := h.svc.DeleteUser(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrInvalidEmail):
		writeError(w, http.StatusBadRequest, "invalid email")
	case errors.Is(err, domain.ErrCodeInvalid):
		writeError(w, http.StatusBadRequest, "invalid code")
	case errors.Is(err, domain.ErrCodeExpired):
		writeError(w, http.StatusBadRequest, "code expired")
	case errors.Is(err, domain.ErrTooManyAttempts):
		writeError(w, http.StatusTooManyRequests, "too many attempts")
	case errors.Is(err, domain.ErrCodeRequestTooSoon):
		writeError(w, http.StatusTooManyRequests, "please wait before requesting a new code")
	case errors.Is(err, domain.ErrTokenInvalid):
		writeError(w, http.StatusUnauthorized, "invalid token")
	default:
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}

func (h *AuthHandler) RequestOldEmailCode(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	res, err := h.svc.RequestOldEmailCode(r.Context(), userID)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	resp := map[string]any{"sent": true, "expires_in": res.ExpiresIn}
	if res.Exposed {
		resp["dev_code"] = res.Code
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) VerifyOldEmailCode(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body struct {
		Code string `json:"code"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	token, err := h.svc.VerifyOldEmailCode(r.Context(), userID, body.Code)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"temp_token": token})
}

func (h *AuthHandler) RequestNewEmailCode(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body struct {
		TempToken string `json:"temp_token"`
		NewEmail  string `json:"new_email"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	res, err := h.svc.RequestNewEmailCode(r.Context(), userID, body.TempToken, body.NewEmail)
	if err != nil {
		if errors.Is(err, domain.ErrEmailTaken) {
			writeError(w, http.StatusBadRequest, "email already taken")
			return
		}
		writeAuthError(w, err)
		return
	}
	resp := map[string]any{"sent": true, "expires_in": res.ExpiresIn}
	if res.Exposed {
		resp["dev_code"] = res.Code
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) ConfirmEmailChange(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body struct {
		NewEmail string `json:"new_email"`
		Code     string `json:"code"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	user, err := h.svc.ConfirmEmailChange(r.Context(), userID, body.NewEmail, body.Code)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toUserDTO(user))
}

func (h *AuthHandler) CheckDeleteMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	hasActive, err := h.svc.CheckDeleteAccount(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Внутренняя ошибка сервера")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"has_active_bookings": hasActive})
}

func (h *AuthHandler) RequestDeleteMeCode(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	res, err := h.svc.RequestDeleteAccountCode(r.Context(), userID)
	if err != nil {
		if errors.Is(err, domain.ErrActiveBookings) {
			writeError(w, http.StatusBadRequest, "Невозможно удалить аккаунт: у вас есть активные бронирования.")
			return
		}
		writeAuthErrorRussian(w, err)
		return
	}
	resp := map[string]any{"sent": true, "expires_in": res.ExpiresIn}
	if res.Exposed {
		resp["dev_code"] = res.Code
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) ConfirmDeleteMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body struct {
		Code string `json:"code"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	err := h.svc.ConfirmDeleteAccount(r.Context(), userID, body.Code)
	if err != nil {
		if errors.Is(err, domain.ErrActiveBookings) {
			writeError(w, http.StatusBadRequest, "Невозможно удалить аккаунт: у вас есть активные бронирования.")
			return
		}
		writeAuthErrorRussian(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeAuthErrorRussian(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrInvalidEmail):
		writeError(w, http.StatusBadRequest, "Некорректный email адрес")
	case errors.Is(err, domain.ErrCodeInvalid):
		writeError(w, http.StatusBadRequest, "Неверный код подтверждения")
	case errors.Is(err, domain.ErrCodeExpired):
		writeError(w, http.StatusBadRequest, "Срок действия кода истек")
	case errors.Is(err, domain.ErrTooManyAttempts):
		writeError(w, http.StatusTooManyRequests, "Превышено количество попыток ввода кода")
	case errors.Is(err, domain.ErrCodeRequestTooSoon):
		writeError(w, http.StatusTooManyRequests, "Пожалуйста, подождите перед повторным запросом кода")
	case errors.Is(err, domain.ErrTokenInvalid):
		writeError(w, http.StatusUnauthorized, "Неверный токен авторизации")
	default:
		writeError(w, http.StatusInternalServerError, "Внутренняя ошибка сервера")
	}
}


