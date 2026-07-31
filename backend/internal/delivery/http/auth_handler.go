package http

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/auth"
)

const minimumProfileAge = 18

func latestBirthdayForAge(now time.Time, age int) time.Time {
	year, month, day := now.Date()
	targetYear := year - age
	lastDayOfMonth := time.Date(targetYear, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
	if day > lastDayOfMonth {
		day = lastDayOfMonth
	}
	return time.Date(targetYear, month, day, 0, 0, 0, 0, time.UTC)
}

func birthdayMeetsMinimumAge(birthday, now time.Time) bool {
	birthdayDate := time.Date(birthday.Year(), birthday.Month(), birthday.Day(), 0, 0, 0, 0, time.UTC)
	return !birthdayDate.After(latestBirthdayForAge(now.UTC(), minimumProfileAge))
}

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
	r.Post("/phone/request", h.requestCodePhone)
	r.Post("/phone/fallback", h.fallbackCodePhone)
	r.Post("/phone/verify", h.verifyCodePhone)
	r.Post("/refresh", h.refresh)
	r.Post("/logout", h.logout)
}

type userDTO struct {
	ID              int32   `json:"id"`
	Email           string  `json:"email"`
	Name            string  `json:"name"`
	Surname         string  `json:"surname"`
	Patronymic      string  `json:"patronymic"`
	Phone           string  `json:"phone"`
	PhoneNormalized string  `json:"phone_normalized"`
	PhoneVerifiedAt *string `json:"phone_verified_at"`
	City            string  `json:"city"`
	AvatarURL       string  `json:"avatar_url"`
	IsVerified      bool    `json:"is_verified"`
	Birthday        *string `json:"birthday"`
	CreatedAt       string  `json:"created_at"`
	ListingsCount   int32   `json:"listings_count"`
	Rating          float64 `json:"rating"`
	ReviewsCount    int32   `json:"reviews_count"`
}

type publicUserDTO struct {
	ID              int32   `json:"id"`
	Name            string  `json:"name"`
	Surname         string  `json:"surname"`
	Patronymic      string  `json:"patronymic"`
	Phone           string  `json:"phone"`
	PhoneVerifiedAt *string `json:"phone_verified_at"`
	City            string  `json:"city"`
	AvatarURL       string  `json:"avatar_url"`
	IsVerified      bool    `json:"is_verified"`
	CreatedAt       string  `json:"created_at"`
	ListingsCount   int32   `json:"listings_count"`
	Rating          float64 `json:"rating"`
	ReviewsCount    int32   `json:"reviews_count"`
}

func toUserDTO(u domain.User) userDTO {
	var bdayStr *string
	if u.Birthday != nil {
		s := u.Birthday.Format("2006-01-02")
		bdayStr = &s
	}
	var phoneVerifiedStr *string
	if u.PhoneVerifiedAt != nil {
		s := u.PhoneVerifiedAt.Format(time.RFC3339)
		phoneVerifiedStr = &s
	}
	return userDTO{
		ID:              u.ID,
		Email:           u.Email,
		Name:            u.Name,
		Surname:         u.Surname,
		Patronymic:      u.Patronymic,
		Phone:           u.Phone,
		PhoneNormalized: u.PhoneNormalized,
		PhoneVerifiedAt: phoneVerifiedStr,
		City:            u.City,
		AvatarURL:       resolveMediaURL(u.AvatarURL),
		IsVerified:      u.IsVerified,
		Birthday:        bdayStr,
		CreatedAt:       u.CreatedAt.Format(time.RFC3339),
		ListingsCount:   u.ListingsCount,
		Rating:          u.Rating,
		ReviewsCount:    u.ReviewsCount,
	}
}

func toPublicUserDTO(u domain.User) publicUserDTO {
	dto := toUserDTO(u)
	phone := ""
	var phoneVerifiedAt *string
	// A phone number is public only for a verified host with at least one
	// listing. This keeps guest phone numbers out of the enumerable endpoint.
	if u.ListingsCount > 0 && u.PhoneVerifiedAt != nil {
		phone = dto.Phone
		phoneVerifiedAt = dto.PhoneVerifiedAt
	}
	return publicUserDTO{
		ID:              dto.ID,
		Name:            dto.Name,
		Surname:         dto.Surname,
		Patronymic:      dto.Patronymic,
		Phone:           phone,
		PhoneVerifiedAt: phoneVerifiedAt,
		City:            dto.City,
		AvatarURL:       dto.AvatarURL,
		IsVerified:      dto.IsVerified,
		CreatedAt:       dto.CreatedAt,
		ListingsCount:   dto.ListingsCount,
		Rating:          dto.Rating,
		ReviewsCount:    dto.ReviewsCount,
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

	if !h.svc.ExposeCode() {
		// Same key as the service's own lookup — see verifyCode.
		emailClean, err := auth.NormalizeEmail(body.Email)
		if err != nil {
			writeAuthError(w, r, err)
			return
		}
		guestID := r.Header.Get("X-Guest-Id")
		clientIP := getClientIP(r)

		if !OTPEmailLimiter.Allow("otp_email:"+emailClean, 5) {
			writeError(w, http.StatusTooManyRequests, "Слишком много запросов кода для этой почты. Пожалуйста, попробуйте позже.")
			return
		}
		if guestID != "" && !OTPGuestIDLimiter.Allow("otp_guest:"+guestID, 10) {
			writeError(w, http.StatusTooManyRequests, "Слишком много запросов с этого устройства. Пожалуйста, попробуйте позже.")
			return
		}
		if !OTPIPLimiter.Allow("otp_ip:"+clientIP, 15) {
			writeError(w, http.StatusTooManyRequests, "Слишком много запросов с вашего IP. Пожалуйста, попробуйте позже.")
			return
		}
	}

	res, err := h.svc.RequestCode(r.Context(), body.Email)
	if err != nil {
		writeAuthError(w, r, err)
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
	if !h.svc.ExposeCode() {
		// Key on the address the service will actually look up, not on the raw
		// input: `"Name" <a@b.com>` and `a@b.com` share one auth_code row, so
		// keying on the raw string hands out a fresh budget per spelling.
		emailClean, err := auth.NormalizeEmail(body.Email)
		if err != nil {
			writeAuthError(w, r, err)
			return
		}
		if !allowOTPVerify(w, r, "email:"+emailClean, "") {
			return
		}
	}
	res, err := h.svc.VerifyCode(r.Context(), body.Email, body.Code, extractDeviceInfo(r))
	if err != nil {
		writeAuthError(w, r, err)
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
	res, err := h.svc.Refresh(r.Context(), body.RefreshToken, extractDeviceInfo(r))
	if err != nil {
		writeAuthError(w, r, err)
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
		writeInternalError(w, r, err, "internal error")
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
		writeInternalError(w, r, err, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, toUserDTO(user))
}

// PublicProfile returns the non-sensitive fields used by public profile screens.
func (h *AuthHandler) PublicProfile(w http.ResponseWriter, r *http.Request) {
	if !PublicProfileLimiter.Allow("public_profile_ip:"+getClientIP(r), publicProfilesPerIPHour) {
		writeRateLimitError(w, "Слишком много запросов профилей. Попробуйте позже.")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 32)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	user, err := h.svc.GetUser(r.Context(), int32(id))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeInternalError(w, r, err, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, toPublicUserDTO(user))
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
		Name       *string `json:"name"`
		Surname    *string `json:"surname"`
		Patronymic *string `json:"patronymic"`
		Phone      *string `json:"phone"`
		City       *string `json:"city"`
		Birthday   *string `json:"birthday"`
		AvatarURL  *string `json:"avatar_url"`
		VKID       *string `json:"vk_id"`
		VKIDDoNull *bool   `json:"vk_id_do_null"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	body.Phone = nil
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
		if !birthdayMeetsMinimumAge(t, time.Now()) {
			writeError(w, http.StatusBadRequest, "Пользователю должно быть не менее 18 лет")
			return
		}
		bday = &t
	}
	user, err := h.svc.UpdateProfile(r.Context(), userID, body.Name, body.Surname, body.Patronymic, body.Phone, body.City, body.AvatarURL, bday, body.VKID, body.VKIDDoNull)
	if err != nil {
		if errors.Is(err, domain.ErrUnsafeImage) {
			writeError(w, http.StatusUnprocessableEntity, unsafeImagePublicMessage(err))
			return
		}
		if errors.Is(err, domain.ErrImageModerationUnavailable) {
			writeError(w, http.StatusServiceUnavailable, "Проверка изображения временно недоступна. Попробуйте ещё раз.")
			return
		}
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeInternalError(w, r, err, "internal error")
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
		writeInternalError(w, r, err, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeAuthError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, auth.ErrInvalidPhone):
		writeError(w, http.StatusBadRequest, "invalid phone number")
	case errors.Is(err, domain.ErrPhoneTaken):
		writeError(w, http.StatusConflict, "phone already taken")
	case errors.Is(err, domain.ErrPhoneAlreadyLinked):
		writeError(w, http.StatusConflict, "phone already linked")
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
	case errors.Is(err, domain.ErrVoiceFallbackLimit):
		writeRateLimitError(w, "Достигнут лимит голосовых звонков. Попробуйте позже.")
	case errors.Is(err, domain.ErrTokenInvalid):
		writeError(w, http.StatusUnauthorized, "invalid token")
	case errors.Is(err, domain.ErrReauthRequired):
		// 403, not 401: the access token is fine, the caller just has not
		// proved control of the factor already on the account. A 401 would
		// send the client into a token refresh that cannot help.
		writeError(w, http.StatusForbidden, "reauthentication required")
	case errors.Is(err, domain.ErrReauthUnavailable):
		writeError(w, http.StatusConflict, "no factor available for reauthentication")
	default:
		writeInternalError(w, r, err, "internal error")
	}
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
	if !h.svc.ExposeCode() {
		email, err := auth.NormalizeEmail(body.NewEmail)
		if err != nil {
			writeAuthError(w, r, err)
			return
		}
		uid := strconv.FormatInt(int64(userID), 10)
		if !EmailChangeUserLimiter.Allow("email_change_user:"+uid, emailChangeRequestsPerUserHour) ||
			!EmailChangeTargetLimiter.Allow("email_change_target:"+email, emailChangeRequestsPerTargetHour) ||
			!EmailChangeIPLimiter.Allow("email_change_ip:"+getClientIP(r), emailChangeRequestsPerIPHour) {
			writeRateLimitError(w, "Слишком много запросов смены почты. Попробуйте позже.")
			return
		}
	}
	res, err := h.svc.RequestNewEmailCode(r.Context(), userID, body.TempToken, body.NewEmail)
	if err != nil {
		if errors.Is(err, domain.ErrEmailTaken) {
			writeError(w, http.StatusBadRequest, "email already taken")
			return
		}
		writeAuthError(w, r, err)
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
	sessionID, _ := sessionIDFromContext(r.Context())
	var body struct {
		NewEmail  string `json:"new_email"`
		Code      string `json:"code"`
		TempToken string `json:"temp_token"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	user, err := h.svc.ConfirmEmailChange(r.Context(), userID, sessionID, body.NewEmail, body.Code, body.TempToken)
	if err != nil {
		writeAuthError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toUserDTO(user))
}

// RequestReauthCode sends a one-time code on the factor already attached to the
// account, as the first step of any factor change. The target is never taken
// from the request — that is what makes it a proof of ownership.
func (h *AuthHandler) RequestReauthCode(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body struct {
		Purpose string `json:"purpose"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	// This places a real, billable call or email to the account's own contact,
	// so it needs the same per-identity budget as every other code-issuing
	// route, not the (much larger) verification budget. Without it a stolen
	// access token buys a stream of flash calls to the victim's phone.
	if !h.svc.ExposeCode() {
		uid := strconv.FormatInt(int64(userID), 10)
		if !OTPPhoneLimiter.Allow("otp_reauth_user:"+uid, 5) {
			writeError(w, http.StatusTooManyRequests, "Слишком много запросов кода подтверждения. Пожалуйста, попробуйте позже.")
			return
		}
		if !OTPIPLimiter.Allow("otp_ip:"+getClientIP(r), 15) {
			writeError(w, http.StatusTooManyRequests, "Слишком много запросов с вашего IP. Пожалуйста, попробуйте позже.")
			return
		}
	}
	res, err := h.svc.RequestReauthCode(r.Context(), userID, body.Purpose)
	if err != nil {
		log.Printf("requestReauthCode error: %v", err)
		writeAuthError(w, r, err)
		return
	}
	resp := map[string]any{
		"sent": true, "factor": res.Factor, "expires_in": res.ExpiresIn,
	}
	if res.Factor == auth.ReauthFactorPhone {
		resp["challenge_id"] = res.ChallengeID
		resp["delivery_mode"] = res.DeliveryMode
		resp["code_length"] = res.CodeLength
		resp["retry_after"] = res.RetryAfter
		resp["fallback_available"] = res.FallbackAvailable
		resp["reused"] = res.Reused
	}
	if res.Exposed {
		resp["dev_code"] = res.Code
	}
	writeJSON(w, http.StatusOK, resp)
}

// ReauthFallback re-delivers the re-auth code as a voice call. Only meaningful
// when the account's factor is a phone; the phone is read from the account, not
// from the request, for the same reason RequestReauthCode does.
func (h *AuthHandler) ReauthFallback(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	// No body: which challenge to re-deliver comes from the attempt the server
	// recorded, not from the caller.
	// Shares the budget with /me/reauth/request: both make the provider dial
	// the same number, and the service-level 60s cooldown alone would still
	// allow 60 calls an hour.
	if !h.svc.ExposeCode() {
		uid := strconv.FormatInt(int64(userID), 10)
		if !OTPPhoneLimiter.Allow("otp_reauth_user:"+uid, 5) {
			writeError(w, http.StatusTooManyRequests, "Слишком много запросов кода подтверждения. Пожалуйста, попробуйте позже.")
			return
		}
		if !OTPIPLimiter.Allow("otp_ip:"+getClientIP(r), 15) {
			writeError(w, http.StatusTooManyRequests, "Слишком много запросов с вашего IP. Пожалуйста, попробуйте позже.")
			return
		}
	}
	res, err := h.svc.RequestReauthVoiceFallback(r.Context(), userID)
	if err != nil {
		log.Printf("reauthFallback error: %v", err)
		writeAuthError(w, r, err)
		return
	}
	writePhoneChallengeResponse(w, res)
}

// VerifyReauthCode exchanges that code for the short-lived proof the change
// endpoints require.
func (h *AuthHandler) VerifyReauthCode(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	// Only the code. The purpose and the challenge it answers both come from the
	// attempt the server recorded at request time — accepting either from the
	// caller is what allowed a code issued for one operation to be redeemed as
	// authorization for another.
	var body struct {
		Code string `json:"code"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if !h.svc.ExposeCode() && !allowOTPVerify(w, r, "reauth:"+strconv.FormatInt(int64(userID), 10), "") {
		return
	}
	token, err := h.svc.VerifyReauthCode(r.Context(), userID, body.Code)
	if err != nil {
		writeAuthError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"temp_token": token})
}

func (h *AuthHandler) CheckDeleteMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	hasActive, err := h.svc.CheckDeleteAccount(r.Context(), userID)
	if err != nil {
		writeInternalError(w, r, err, "Внутренняя ошибка сервера")
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
		writeAuthErrorRussian(w, r, err)
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
		writeAuthErrorRussian(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeAuthErrorRussian(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, auth.ErrInvalidPhone):
		writeError(w, http.StatusBadRequest, "Неверный формат номера телефона. Используйте +7 или 8.")
	case errors.Is(err, domain.ErrPhoneTaken):
		writeError(w, http.StatusConflict, "Этот номер телефона уже занят другим пользователем")
	case errors.Is(err, domain.ErrPhoneAlreadyLinked):
		writeError(w, http.StatusConflict, "Этот номер телефона уже привязан к вашему аккаунту")
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
	case errors.Is(err, domain.ErrReauthRequired):
		writeError(w, http.StatusForbidden, "Подтвердите текущий номер телефона или почту, чтобы продолжить")
	case errors.Is(err, domain.ErrReauthUnavailable):
		writeError(w, http.StatusConflict, "К аккаунту не привязан контакт для подтверждения")
	default:
		writeInternalError(w, r, err, "Внутренняя ошибка сервера")
	}
}

func extractDeviceInfo(r *http.Request) domain.DeviceInfo {
	device := r.Header.Get("X-Device-Name")
	os := r.Header.Get("X-Device-OS")
	version := r.Header.Get("X-App-Version")

	// Use the shared getClientIP helper: proxy headers are only trusted when
	// TRUST_PROXY_HEADERS=true, so stored session IPs/geo can't be spoofed by
	// clients sending forged X-Forwarded-For / X-Real-IP headers.
	ip := getClientIP(r)

	if device == "" {
		ua := r.Header.Get("User-Agent")
		if ua != "" {
			osName := "Unknown OS"
			browserName := "Browser"

			uaLower := strings.ToLower(ua)
			if strings.Contains(uaLower, "windows") {
				osName = "Windows"
			} else if strings.Contains(uaLower, "macintosh") || strings.Contains(uaLower, "mac os x") {
				osName = "macOS"
			} else if strings.Contains(uaLower, "linux") {
				osName = "Linux"
			} else if strings.Contains(uaLower, "iphone") || strings.Contains(uaLower, "ipad") {
				osName = "iOS"
			} else if strings.Contains(uaLower, "android") {
				osName = "Android"
			}

			if strings.Contains(uaLower, "chrome") {
				browserName = "Chrome"
			} else if strings.Contains(uaLower, "safari") {
				browserName = "Safari"
			} else if strings.Contains(uaLower, "firefox") {
				browserName = "Firefox"
			} else if strings.Contains(uaLower, "edge") {
				browserName = "Edge"
			}

			device = browserName
			os = osName
			version = "Web"
		}
	}

	info := domain.DeviceInfo{}
	if device != "" {
		info.DeviceName = &device
	}
	if os != "" {
		info.DeviceOS = &os
	}
	if version != "" {
		info.AppVersion = &version
	}
	if ip != "" {
		info.IPAddress = &ip
	}

	return info
}

func (h *AuthHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	sid, ok := sessionIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	res, err := h.svc.ListSessions(r.Context(), userID, sid)
	if err != nil {
		writeInternalError(w, r, err, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *AuthHandler) RevokeOtherSessions(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	sid, ok := sessionIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	err := h.svc.RevokeAllSessionsExcept(r.Context(), sid, userID)
	if err != nil {
		writeInternalError(w, r, err, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) RevokeSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	idStr := chi.URLParam(r, "id")
	sessionID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid session id")
		return
	}

	err = h.svc.RevokeSession(r.Context(), sessionID, userID)
	if err != nil {
		writeInternalError(w, r, err, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) requestCodePhone(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone   string `json:"phone"`
		Channel string `json:"channel"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	phoneClean, err := auth.NormalizePhone(body.Phone)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Неверный формат номера телефона. Используйте +7 или 8.")
		return
	}

	if !h.svc.ExposeCode() {
		guestID := r.Header.Get("X-Guest-Id")
		clientIP := getClientIP(r)

		if !OTPPhoneLimiter.Allow("otp_phone:"+phoneClean, 5) {
			writeError(w, http.StatusTooManyRequests, "Слишком много запросов кода для этого номера. Пожалуйста, попробуйте позже.")
			return
		}
		if guestID != "" && !OTPGuestIDLimiter.Allow("otp_guest:"+guestID, 10) {
			writeError(w, http.StatusTooManyRequests, "Слишком много запросов с этого устройства. Пожалуйста, попробуйте позже.")
			return
		}
		if !OTPIPLimiter.Allow("otp_ip:"+clientIP, 15) {
			writeError(w, http.StatusTooManyRequests, "Слишком много запросов с вашего IP. Пожалуйста, попробуйте позже.")
			return
		}
	}

	res, err := h.svc.RequestPhoneCode(r.Context(), body.Phone, body.Channel)
	if err != nil {
		log.Printf("requestCodePhone error: %v", err)
		writeAuthError(w, r, err)
		return
	}
	writePhoneChallengeResponse(w, res)
}

func writePhoneChallengeResponse(w http.ResponseWriter, res auth.RequestCodeResult) {
	resp := map[string]any{
		"sent": true, "expires_in": res.ExpiresIn, "challenge_id": res.ChallengeID,
		"delivery_mode": res.DeliveryMode, "code_length": res.CodeLength,
		"retry_after": res.RetryAfter, "fallback_available": res.FallbackAvailable,
		"reused": res.Reused,
	}
	if res.Exposed {
		resp["dev_code"] = res.Code
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) fallbackCodePhone(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone       string `json:"phone"`
		ChallengeID string `json:"challenge_id"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if !h.svc.ExposeCode() {
		phone, err := auth.NormalizePhone(body.Phone)
		if err != nil {
			writeAuthError(w, r, err)
			return
		}
		if !allowVoiceFallback(w, r, "phone:"+phone) {
			return
		}
	}
	res, err := h.svc.RequestPhoneVoiceFallback(r.Context(), body.Phone, body.ChallengeID, domain.PhoneChallengePurposeLogin, nil)
	if err != nil {
		log.Printf("fallbackCodePhone error: %v", err)
		writeAuthError(w, r, err)
		return
	}
	writePhoneChallengeResponse(w, res)
}

func (h *AuthHandler) verifyCodePhone(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone       string `json:"phone"`
		Code        string `json:"code"`
		Channel     string `json:"channel"`
		ChallengeID string `json:"challenge_id"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	challengeID := body.ChallengeID
	if challengeID == "" {
		challengeID = body.Channel
	}
	if !h.svc.ExposeCode() {
		// Normalization failures fall through to the service, which returns the
		// same error for every malformed number — keying the limiter on the raw
		// value would let an attacker spread the budget over spelling variants.
		phoneClean, err := auth.NormalizePhone(body.Phone)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Неверный формат номера телефона. Используйте +7 или 8.")
			return
		}
		if !allowOTPVerify(w, r, "phone:"+phoneClean, otpChallengeKey(challengeID)) {
			return
		}
	}
	res, err := h.svc.VerifyPhoneCode(r.Context(), body.Phone, body.Code, challengeID, extractDeviceInfo(r))
	if err != nil {
		log.Printf("verifyCodePhone error: %v", err)
		writeAuthError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toAuthResponse(res))
}

func (h *AuthHandler) changePhoneRequest(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body struct {
		Phone     string `json:"phone"`
		Channel   string `json:"channel"`
		TempToken string `json:"temp_token"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	phoneClean, err := auth.NormalizePhone(body.Phone)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Неверный формат номера телефона. Используйте +7 или 8.")
		return
	}

	if !h.svc.ExposeCode() {
		clientIP := getClientIP(r)

		if !OTPPhoneLimiter.Allow("otp_phone:"+phoneClean, 5) {
			writeError(w, http.StatusTooManyRequests, "Слишком много запросов кода для этого номера. Пожалуйста, попробуйте позже.")
			return
		}
		if !OTPIPLimiter.Allow("otp_ip:"+clientIP, 15) {
			writeError(w, http.StatusTooManyRequests, "Слишком много запросов с вашего IP. Пожалуйста, попробуйте позже.")
			return
		}
	}

	res, err := h.svc.RequestChangePhoneCode(r.Context(), userID, body.Phone, body.Channel, body.TempToken)
	if err != nil {
		log.Printf("changePhoneRequest error: %v", err)
		writeAuthError(w, r, err)
		return
	}
	writePhoneChallengeResponse(w, res)
}

func (h *AuthHandler) changePhoneFallback(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body struct {
		Phone       string `json:"phone"`
		ChallengeID string `json:"challenge_id"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if !h.svc.ExposeCode() {
		phone, err := auth.NormalizePhone(body.Phone)
		if err != nil {
			writeAuthError(w, r, err)
			return
		}
		if !allowVoiceFallback(w, r, "phone:"+phone) {
			return
		}
	}
	res, err := h.svc.RequestPhoneVoiceFallback(r.Context(), body.Phone, body.ChallengeID, domain.PhoneChallengePurposeChangePhone, &userID)
	if err != nil {
		log.Printf("changePhoneFallback error: %v", err)
		writeAuthError(w, r, err)
		return
	}
	writePhoneChallengeResponse(w, res)
}

func (h *AuthHandler) changePhoneConfirm(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	sessionID, _ := sessionIDFromContext(r.Context())
	var body struct {
		Phone       string `json:"phone"`
		Code        string `json:"code"`
		Channel     string `json:"channel"`
		ChallengeID string `json:"challenge_id"`
		TempToken   string `json:"temp_token"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	challengeID := body.ChallengeID
	if challengeID == "" {
		challengeID = body.Channel
	}
	if !h.svc.ExposeCode() {
		phoneClean, err := auth.NormalizePhone(body.Phone)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Неверный формат номера телефона. Используйте +7 или 8.")
			return
		}
		if !allowOTPVerify(w, r, "phone:"+phoneClean, otpChallengeKey(challengeID)) {
			return
		}
	}
	user, err := h.svc.ConfirmPhoneChange(r.Context(), userID, sessionID, body.Phone, body.Code, challengeID, body.TempToken)
	if err != nil {
		log.Printf("changePhoneConfirm error: %v", err)
		writeAuthError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toUserDTO(user))
}
