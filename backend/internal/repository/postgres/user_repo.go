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
		ID:            row.ID,
		Email:         row.Email,
		Name:          deref(row.Name),
		Surname:       deref(row.Surname),
		Patronymic:    deref(row.Patronymic),
		Phone:         deref(row.Phone),
		City:          deref(row.City),
		AvatarURL:     deref(row.AvatarUrl),
		IsVerified:    row.IsVerified,
		Birthday:      toTimePtr(row.Birthday),
		ListingsCount: 0,
		Rating:        0.0,
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
		ID:            row.ID,
		Email:         row.Email,
		Name:          deref(row.Name),
		Surname:       deref(row.Surname),
		Patronymic:    deref(row.Patronymic),
		Phone:         deref(row.Phone),
		City:          deref(row.City),
		AvatarURL:     deref(row.AvatarUrl),
		IsVerified:    row.IsVerified,
		Birthday:      toTimePtr(row.Birthday),
		ListingsCount: row.ListingsCount,
		Rating:        row.Rating,
	}, nil
}

func (r *UserRepo) Create(ctx context.Context, email string) (domain.User, error) {
	row, err := r.q.CreateUser(ctx, sqlc.CreateUserParams{Email: email, Roles: defaultRoles})
	if err != nil {
		return domain.User{}, err
	}
	return domain.User{
		ID:            row.ID,
		Email:         row.Email,
		Name:          deref(row.Name),
		Surname:       deref(row.Surname),
		Patronymic:    deref(row.Patronymic),
		Phone:         deref(row.Phone),
		City:          deref(row.City),
		AvatarURL:     deref(row.AvatarUrl),
		IsVerified:    row.IsVerified,
		Birthday:      toTimePtr(row.Birthday),
		ListingsCount: 0,
		Rating:        0.0,
	}, nil
}

func (r *UserRepo) UpdateProfile(ctx context.Context, id int32, name, surname, patronymic, phone, city, avatarURL *string, birthday *time.Time, vkID *string, vkIDDoNull *bool) (domain.User, error) {
	var pgBirthday pgtype.Date
	if birthday != nil {
		pgBirthday = pgtype.Date{Time: *birthday, Valid: true}
	}
	_, err := r.q.UpdateUserProfile(ctx, sqlc.UpdateUserProfileParams{
		ID:         id,
		Name:       name,
		Surname:    surname,
		Patronymic: patronymic,
		Phone:      phone,
		City:       city,
		Birthday:   pgBirthday,
		AvatarUrl:  avatarURL,
		VkID:       vkID,
		VkIDDoNull: vkIDDoNull,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, err
	}
	return r.GetByID(ctx, id)
}

func (r *UserRepo) UpdateEmail(ctx context.Context, id int32, email string) (domain.User, error) {
	_, err := r.q.UpdateUserEmail(ctx, sqlc.UpdateUserEmailParams{
		ID:    id,
		Email: email,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, err
	}
	return r.GetByID(ctx, id)
}

func (r *UserRepo) Delete(ctx context.Context, id int32) error {
	return r.q.DeleteUser(ctx, id)
}

func (r *UserRepo) CheckActiveBookings(ctx context.Context, id int32) (int64, error) {
	count, err := r.q.CheckUserActiveBookings(ctx, &id)
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (r *UserRepo) AnonymizeAndRevoke(ctx context.Context, id int32, emailHash string) error {
	type TxBeginner interface {
		Begin(ctx context.Context) (pgx.Tx, error)
	}

	db := r.q.DB()
	txb, ok := db.(TxBeginner)
	if !ok {
		return errors.New("underlying database connection does not support transactions")
	}

	tx, err := txb.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	qtx := r.q.WithTx(tx)

	if err := qtx.CreatePersonalDataRevocation(ctx, sqlc.CreatePersonalDataRevocationParams{
		UserID:    id,
		EmailHash: emailHash,
	}); err != nil {
		return err
	}

	if err := qtx.SoftDeleteUserHouses(ctx, id); err != nil {
		return err
	}

	if err := qtx.AnonymizeUser(ctx, id); err != nil {
		return err
	}

	if err := qtx.DeleteUserRefreshTokens(ctx, id); err != nil {
		return err
	}

	if err := qtx.DeleteUserFavorites(ctx, id); err != nil {
		return err
	}

	if err := qtx.DeleteUserDeviceTokens(ctx, id); err != nil {
		return err
	}

	return tx.Commit(ctx)
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
