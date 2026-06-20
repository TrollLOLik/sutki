package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres/sqlc"
)

// BookingRepo implements domain.BookingRepository on top of sqlc-generated queries.
type BookingRepo struct {
	q *sqlc.Queries
}

func NewBookingRepo(q *sqlc.Queries) *BookingRepo {
	return &BookingRepo{q: q}
}

func (r *BookingRepo) GetHouseForBooking(ctx context.Context, houseID int32) (ownerID int32, status string, err error) {
	row, err := r.q.GetHouseForBooking(ctx, houseID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, "", domain.ErrNotFound
		}
		return 0, "", err
	}
	return row.OwnerID, row.Status, nil
}

func (r *BookingRepo) HasConfirmedOverlap(ctx context.Context, houseID int32, start time.Time, end *time.Time) (bool, error) {
	// Treat a missing end as a single night so same-day requests still conflict.
	rangeEnd := start.AddDate(0, 0, 1)
	if end != nil {
		rangeEnd = *end
	}
	return r.q.HouseHasConfirmedOverlap(ctx, sqlc.HouseHasConfirmedOverlapParams{
		HouseID:    houseID,
		RangeStart: dateParam(start),
		RangeEnd:   dateParam(rangeEnd),
	})
}

func (r *BookingRepo) ConfirmedRanges(ctx context.Context, houseID int32) ([]domain.BookedRange, error) {
	rows, err := r.q.ListConfirmedRangesForHouse(ctx, &houseID)
	if err != nil {
		return nil, err
	}
	ranges := make([]domain.BookedRange, 0, len(rows))
	for _, row := range rows {
		ranges = append(ranges, domain.BookedRange{
			Start: row.StartDate.Time,
			End:   dateToPtr(row.EndDate),
		})
	}
	return ranges, nil
}

func (r *BookingRepo) Create(ctx context.Context, b domain.NewBooking) (domain.Booking, error) {
	row, err := r.q.CreateRequest(ctx, sqlc.CreateRequestParams{
		HouseID:   b.HouseID,
		UserID:    b.UserID,
		Name:      b.Name,
		Surname:   b.Surname,
		Lastname:  b.Lastname,
		Count:     b.Count,
		Message:   strToPtr(b.Message),
		Phone:     b.Phone,
		StartDate: dateParam(b.StartDate),
		EndDate:   dateParamPtr(b.EndDate),
	})
	if err != nil {
		return domain.Booking{}, err
	}
	return buildBooking(bookingFields{
		ID: row.ID, HouseID: row.HouseID, UserID: row.UserID,
		Name: row.Name, Surname: row.Surname, Lastname: row.Lastname,
		Count: row.Count, Message: row.Message, Phone: row.Phone,
		StartDate: row.StartDate, EndDate: row.EndDate, Status: row.Status,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		ConfirmedAt: row.ConfirmedAt, RejectionReason: row.RejectionReason,
	}), nil
}

func (r *BookingRepo) GetByID(ctx context.Context, id int32) (domain.Booking, error) {
	row, err := r.q.GetRequestByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Booking{}, domain.ErrNotFound
		}
		return domain.Booking{}, err
	}
	b := buildBooking(bookingFields{
		ID: row.ID, HouseID: row.HouseID, UserID: row.UserID,
		Name: row.Name, Surname: row.Surname, Lastname: row.Lastname,
		Count: row.Count, Message: row.Message, Phone: row.Phone,
		StartDate: row.StartDate, EndDate: row.EndDate, Status: row.Status,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		ConfirmedAt: row.ConfirmedAt, RejectionReason: row.RejectionReason,
	})
	b.House = &domain.BookingHouse{
		ID: row.HouseID, OwnerID: row.HouseOwnerID, Street: row.HouseStreet,
		HouseNumber: row.HouseNumber, City: row.HouseCity, Price: row.HousePrice,
		CoverPath: row.HouseCoverPath,
	}
	b.Guest = &domain.BookingGuest{
		Name:         row.GuestName,
		Surname:      row.GuestSurname,
		AvatarURL:    row.GuestAvatarUrl,
		Phone:        row.GuestPhoneProfile,
		IsVerified:   row.GuestIsVerified,
		Rating:       row.GuestRating,
		ReviewsCount: row.GuestReviewsCount,
	}
	return b, nil
}

func (r *BookingRepo) ListByUser(ctx context.Context, userID, limit, offset int32, scope string) ([]domain.Booking, error) {
	rows, err := r.q.ListRequestsByUser(ctx, sqlc.ListRequestsByUserParams{
		UserID: userID, Scope: scope, ResultLimit: limit, ResultOffset: offset,
	})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Booking, 0, len(rows))
	for _, row := range rows {
		b := buildBooking(bookingFields{
			ID: row.ID, HouseID: row.HouseID, UserID: row.UserID,
			Name: row.Name, Surname: row.Surname, Lastname: row.Lastname,
			Count: row.Count, Message: row.Message, Phone: row.Phone,
			StartDate: row.StartDate, EndDate: row.EndDate, Status: row.Status,
			CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
			ConfirmedAt: row.ConfirmedAt, RejectionReason: row.RejectionReason,
		})
		b.House = &domain.BookingHouse{
			ID: row.HouseID, OwnerID: row.HouseOwnerID, Street: row.HouseStreet,
			HouseNumber: row.HouseNumber, City: row.HouseCity, Price: row.HousePrice,
			CoverPath: row.HouseCoverPath,
		}
		out = append(out, b)
	}
	return out, nil
}

func (r *BookingRepo) CountByUser(ctx context.Context, userID int32, scope string) (int64, error) {
	return r.q.CountRequestsByUser(ctx, sqlc.CountRequestsByUserParams{UserID: userID, Scope: scope})
}

func (r *BookingRepo) ListForOwner(ctx context.Context, ownerID, limit, offset int32) ([]domain.Booking, error) {
	rows, err := r.q.ListRequestsForOwner(ctx, sqlc.ListRequestsForOwnerParams{
		OwnerID: ownerID, ResultLimit: limit, ResultOffset: offset,
	})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Booking, 0, len(rows))
	for _, row := range rows {
		b := buildBooking(bookingFields{
			ID: row.ID, HouseID: row.HouseID, UserID: row.UserID,
			Name: row.Name, Surname: row.Surname, Lastname: row.Lastname,
			Count: row.Count, Message: row.Message, Phone: row.Phone,
			StartDate: row.StartDate, EndDate: row.EndDate, Status: row.Status,
			CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
			ConfirmedAt: row.ConfirmedAt, RejectionReason: row.RejectionReason,
		})
		b.House = &domain.BookingHouse{
			ID: row.HouseID, OwnerID: row.HouseOwnerID, Street: row.HouseStreet,
			HouseNumber: row.HouseNumber, City: row.HouseCity, Price: row.HousePrice,
			CoverPath: row.HouseCoverPath,
		}
		out = append(out, b)
	}
	return out, nil
}

func (r *BookingRepo) CountForOwner(ctx context.Context, ownerID int32) (int64, error) {
	return r.q.CountRequestsForOwner(ctx, ownerID)
}

func (r *BookingRepo) Confirm(ctx context.Context, id int32) (domain.Booking, error) {
	row, err := r.q.ConfirmRequest(ctx, id)
	if err != nil {
		return domain.Booking{}, err
	}
	return buildBooking(bookingFields{
		ID: row.ID, HouseID: row.HouseID, UserID: row.UserID,
		Name: row.Name, Surname: row.Surname, Lastname: row.Lastname,
		Count: row.Count, Message: row.Message, Phone: row.Phone,
		StartDate: row.StartDate, EndDate: row.EndDate, Status: row.Status,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		ConfirmedAt: row.ConfirmedAt, RejectionReason: row.RejectionReason,
	}), nil
}

func (r *BookingRepo) Reject(ctx context.Context, id int32, reason string) (domain.Booking, error) {
	row, err := r.q.RejectRequest(ctx, sqlc.RejectRequestParams{ID: id, RejectionReason: strToPtr(reason)})
	if err != nil {
		return domain.Booking{}, err
	}
	return buildBooking(bookingFields{
		ID: row.ID, HouseID: row.HouseID, UserID: row.UserID,
		Name: row.Name, Surname: row.Surname, Lastname: row.Lastname,
		Count: row.Count, Message: row.Message, Phone: row.Phone,
		StartDate: row.StartDate, EndDate: row.EndDate, Status: row.Status,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		ConfirmedAt: row.ConfirmedAt, RejectionReason: row.RejectionReason,
	}), nil
}

func (r *BookingRepo) Cancel(ctx context.Context, id int32) (domain.Booking, error) {
	row, err := r.q.CancelRequest(ctx, id)
	if err != nil {
		return domain.Booking{}, err
	}
	return buildBooking(bookingFields{
		ID: row.ID, HouseID: row.HouseID, UserID: row.UserID,
		Name: row.Name, Surname: row.Surname, Lastname: row.Lastname,
		Count: row.Count, Message: row.Message, Phone: row.Phone,
		StartDate: row.StartDate, EndDate: row.EndDate, Status: row.Status,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		ConfirmedAt: row.ConfirmedAt, RejectionReason: row.RejectionReason,
	}), nil
}

// bookingFields holds the shared columns of the `request` table as produced by
// the various sqlc row types, so a single builder can map any of them.
type bookingFields struct {
	ID              int32
	HouseID         int32
	UserID          int32
	Name            string
	Surname         string
	Lastname        string
	Count           int32
	Message         *string
	Phone           string
	StartDate       pgtype.Date
	EndDate         pgtype.Date
	Status          string
	CreatedAt       pgtype.Timestamp
	UpdatedAt       pgtype.Timestamp
	ConfirmedAt     pgtype.Timestamp
	RejectionReason *string
}

func buildBooking(f bookingFields) domain.Booking {
	return domain.Booking{
		ID:              f.ID,
		HouseID:         f.HouseID,
		UserID:          f.UserID,
		Name:            f.Name,
		Surname:         f.Surname,
		Lastname:        f.Lastname,
		Count:           f.Count,
		Message:         derefStr(f.Message),
		Phone:           f.Phone,
		StartDate:       f.StartDate.Time,
		EndDate:         dateToPtr(f.EndDate),
		Status:          f.Status,
		CreatedAt:       f.CreatedAt.Time,
		UpdatedAt:       f.UpdatedAt.Time,
		ConfirmedAt:     tsToPtr(f.ConfirmedAt),
		RejectionReason: derefStr(f.RejectionReason),
	}
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func strToPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func dateParam(t time.Time) pgtype.Date {
	return pgtype.Date{Time: t, Valid: true}
}

func dateParamPtr(t *time.Time) pgtype.Date {
	if t == nil {
		return pgtype.Date{}
	}
	return pgtype.Date{Time: *t, Valid: true}
}

func dateToPtr(d pgtype.Date) *time.Time {
	if !d.Valid {
		return nil
	}
	t := d.Time
	return &t
}

func tsToPtr(ts pgtype.Timestamp) *time.Time {
	if !ts.Valid {
		return nil
	}
	t := ts.Time
	return &t
}
