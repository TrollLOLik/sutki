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

// defaultRoles is the legacy Symfony role set assigned to new mobile users.
var defaultRoles = []byte(`["ROLE_USER"]`)

// UserRepo implements domain.UserRepository on top of sqlc-generated queries.
type UserRepo struct {
	q *sqlc.Queries
}

func NewUserRepo(q *sqlc.Queries) *UserRepo {
	return &UserRepo{q: q}
}

func (r *UserRepo) GetByEmail(ctx context.Context, email string) (domain.User, error) {
	row, err := r.q.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, err
	}
	return domain.User{
		ID:         row.ID,
		Email:      row.Email,
		Name:       deref(row.Name),
		Phone:      deref(row.Phone),
		City:       deref(row.City),
		AvatarURL:  deref(row.AvatarUrl),
		IsVerified: row.IsVerified,
		Birthday:   toTimePtr(row.Birthday),
	}, nil
}

func (r *UserRepo) GetByID(ctx context.Context, id int32) (domain.User, error) {
	row, err := r.q.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, err
	}
	return domain.User{
		ID:         row.ID,
		Email:      row.Email,
		Name:       deref(row.Name),
		Phone:      deref(row.Phone),
		City:       deref(row.City),
		AvatarURL:  deref(row.AvatarUrl),
		IsVerified: row.IsVerified,
		Birthday:   toTimePtr(row.Birthday),
	}, nil
}

func (r *UserRepo) Create(ctx context.Context, email string) (domain.User, error) {
	row, err := r.q.CreateUser(ctx, sqlc.CreateUserParams{Email: email, Roles: defaultRoles})
	if err != nil {
		return domain.User{}, err
	}
	return domain.User{
		ID:         row.ID,
		Email:      row.Email,
		Name:       deref(row.Name),
		Phone:      deref(row.Phone),
		City:       deref(row.City),
		AvatarURL:  deref(row.AvatarUrl),
		IsVerified: row.IsVerified,
		Birthday:   toTimePtr(row.Birthday),
	}, nil
}

func (r *UserRepo) UpdateProfile(ctx context.Context, id int32, name, phone, city, avatarURL *string, birthday *time.Time) (domain.User, error) {
	var pgBirthday pgtype.Date
	if birthday != nil {
		pgBirthday = pgtype.Date{Time: *birthday, Valid: true}
	}
	row, err := r.q.UpdateUserProfile(ctx, sqlc.UpdateUserProfileParams{
		ID:        id,
		Name:      name,
		Phone:     phone,
		City:      city,
		Birthday:  pgBirthday,
		AvatarUrl: avatarURL,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, err
	}
	return domain.User{
		ID:         row.ID,
		Email:      row.Email,
		Name:       deref(row.Name),
		Phone:      deref(row.Phone),
		City:       deref(row.City),
		AvatarURL:  deref(row.AvatarUrl),
		IsVerified: row.IsVerified,
		Birthday:   toTimePtr(row.Birthday),
	}, nil
}

func (r *UserRepo) UpdateEmail(ctx context.Context, id int32, email string) (domain.User, error) {
	row, err := r.q.UpdateUserEmail(ctx, sqlc.UpdateUserEmailParams{
		ID:    id,
		Email: email,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, err
	}
	return domain.User{
		ID:         row.ID,
		Email:      row.Email,
		Name:       deref(row.Name),
		Phone:      deref(row.Phone),
		City:       deref(row.City),
		AvatarURL:  deref(row.AvatarUrl),
		IsVerified: row.IsVerified,
		Birthday:   toTimePtr(row.Birthday),
	}, nil
}

func (r *UserRepo) Delete(ctx context.Context, id int32) error {
	return r.q.DeleteUser(ctx, id)
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func toTimePtr(d pgtype.Date) *time.Time {
	if !d.Valid {
		return nil
	}
	t := d.Time
	return &t
}
