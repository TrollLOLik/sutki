package http

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/usecase/abuse"
)

type AbuseHandler struct {
	svc *abuse.Service
}

func NewAbuseHandler(svc *abuse.Service) *AbuseHandler {
	return &AbuseHandler{svc: svc}
}

func (h *AbuseHandler) Routes(r chi.Router) {
	r.Post("/reports", h.createReport)
	r.Get("/users/{id}/block-state", h.blockState)
	r.Post("/users/{id}/block", h.blockUser)
	r.Delete("/users/{id}/block", h.unblockUser)
	r.Get("/me/blocked-users", h.listBlockedUsers)
}

func (h *AbuseHandler) blockState(w http.ResponseWriter, r *http.Request) {
	actorID, targetID, ok := abuseActorAndTarget(w, r)
	if !ok {
		return
	}
	state, err := h.svc.BlockState(r.Context(), actorID, targetID)
	if err != nil {
		handleAbuseError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, state)
}

type createReportRequest struct {
	TargetType string `json:"target_type"`
	TargetID   int64  `json:"target_id"`
	Reason     string `json:"reason"`
	Details    string `json:"details"`
}

type reportResponse struct {
	ID         int64     `json:"id"`
	TargetType string    `json:"target_type"`
	TargetID   int64     `json:"target_id"`
	Reason     string    `json:"reason"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

func (h *AbuseHandler) createReport(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req createReportRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	report, err := h.svc.Report(r.Context(), domain.CreateAbuseReport{
		ReporterUserID: userID,
		TargetType:     req.TargetType,
		TargetID:       req.TargetID,
		Reason:         req.Reason,
		Details:        req.Details,
		Source:         r.Header.Get("X-Client-Platform"),
		AppVersion:     r.Header.Get("X-App-Version"),
		IPAddress:      getClientIP(r),
		UserAgent:      r.UserAgent(),
	})
	if err != nil {
		handleAbuseError(w, r, err)
		return
	}

	writeJSON(w, http.StatusCreated, reportResponse{
		ID:         report.ID,
		TargetType: report.TargetType,
		TargetID:   report.TargetID,
		Reason:     report.Reason,
		Status:     report.Status,
		CreatedAt:  report.CreatedAt,
	})
}

type blockedUserResponse struct {
	UserID    int32     `json:"user_id"`
	Name      string    `json:"name"`
	AvatarURL string    `json:"avatar_url,omitempty"`
	BlockedAt time.Time `json:"blocked_at"`
}

type blockedUsersResponse struct {
	Items  []blockedUserResponse `json:"items"`
	Total  int64                 `json:"total"`
	Limit  int32                 `json:"limit"`
	Offset int32                 `json:"offset"`
}

func (h *AbuseHandler) blockUser(w http.ResponseWriter, r *http.Request) {
	actorID, targetID, ok := abuseActorAndTarget(w, r)
	if !ok {
		return
	}

	blocked, err := h.svc.Block(r.Context(), actorID, targetID)
	if err != nil {
		handleAbuseError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, blockedUserDTO(blocked))
}

func (h *AbuseHandler) unblockUser(w http.ResponseWriter, r *http.Request) {
	actorID, targetID, ok := abuseActorAndTarget(w, r)
	if !ok {
		return
	}
	if err := h.svc.Unblock(r.Context(), actorID, targetID); err != nil {
		handleAbuseError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AbuseHandler) listBlockedUsers(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	page, err := h.svc.ListBlocked(
		r.Context(),
		userID,
		parseInt32(r.URL.Query().Get("limit"), 20),
		parseInt32(r.URL.Query().Get("offset"), 0),
	)
	if err != nil {
		handleAbuseError(w, r, err)
		return
	}

	items := make([]blockedUserResponse, 0, len(page.Items))
	for _, item := range page.Items {
		items = append(items, blockedUserDTO(item))
	}
	writeJSON(w, http.StatusOK, blockedUsersResponse{
		Items: items, Total: page.Total, Limit: page.Limit, Offset: page.Offset,
	})
}

func blockedUserDTO(user domain.BlockedUser) blockedUserResponse {
	return blockedUserResponse{
		UserID:    user.UserID,
		Name:      user.Name,
		AvatarURL: resolveMediaURL(user.AvatarURL),
		BlockedAt: user.BlockedAt,
	}
}

func abuseActorAndTarget(w http.ResponseWriter, r *http.Request) (int32, int32, bool) {
	actorID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return 0, 0, false
	}
	target, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 32)
	if err != nil || target <= 0 {
		writeError(w, http.StatusBadRequest, "Некорректный пользователь.")
		return 0, 0, false
	}
	return actorID, int32(target), true
}

func handleAbuseError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, abuse.ErrInvalidTargetType),
		errors.Is(err, abuse.ErrInvalidReason),
		errors.Is(err, abuse.ErrInvalidTargetID),
		errors.Is(err, abuse.ErrDetailsTooLong):
		writeError(w, http.StatusBadRequest, "Проверьте данные жалобы.")
	case errors.Is(err, domain.ErrSelfBlock):
		writeError(w, http.StatusBadRequest, "Нельзя заблокировать самого себя.")
	case errors.Is(err, domain.ErrSelfReport):
		writeError(w, http.StatusBadRequest, "Нельзя пожаловаться на собственный контент.")
	case errors.Is(err, domain.ErrReportTargetForbidden):
		writeError(w, http.StatusForbidden, "У вас нет доступа к этому объекту.")
	case errors.Is(err, domain.ErrReportRateLimit):
		writeError(w, http.StatusTooManyRequests, "Слишком много жалоб. Попробуйте позже.")
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, http.StatusNotFound, "Объект не найден.")
	default:
		writeInternalError(w, r, err, "abuse operation failed")
	}
}
