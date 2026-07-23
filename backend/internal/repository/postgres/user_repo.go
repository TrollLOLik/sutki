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
	row, err := r.q.GetUserByEmail(ctx, &email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, err
	}
	return domain.User{
		ID:              row.ID,
		Email:           deref(row.Email),
		Name:            deref(row.Name),
		Surname:         deref(row.Surname),
		Patronymic:      deref(row.Patronymic),
		Phone:           deref(row.Phone),
		PhoneNormalized: deref(row.PhoneNormalized),
		PhoneVerifiedAt: toTimePtrFromTimestamp(row.PhoneVerifiedAt),
		City:            deref(row.City),
		AvatarURL:       deref(row.AvatarUrl),
		IsVerified:      row.IsVerified,
		Birthday:        toTimePtr(row.Birthday),
		CreatedAt:       row.CreatedAt.Time,
		ListingsCount:   0,
		Rating:          0.0,
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
		ID:              row.ID,
		Email:           deref(row.Email),
		Name:            deref(row.Name),
		Surname:         deref(row.Surname),
		Patronymic:      deref(row.Patronymic),
		Phone:           deref(row.Phone),
		PhoneNormalized: deref(row.PhoneNormalized),
		PhoneVerifiedAt: toTimePtrFromTimestamp(row.PhoneVerifiedAt),
		City:            deref(row.City),
		AvatarURL:       deref(row.AvatarUrl),
		IsVerified:      row.IsVerified,
		Birthday:        toTimePtr(row.Birthday),
		CreatedAt:       row.CreatedAt.Time,
		ListingsCount:   row.ListingsCount,
		Rating:          row.Rating,
	}, nil
}

func (r *UserRepo) Create(ctx context.Context, email string) (domain.User, error) {
	row, err := r.q.CreateUser(ctx, sqlc.CreateUserParams{Email: &email, Roles: defaultRoles})
	if err != nil {
		return domain.User{}, err
	}
	return domain.User{
		ID:              row.ID,
		Email:           deref(row.Email),
		Name:            deref(row.Name),
		Surname:         deref(row.Surname),
		Patronymic:      deref(row.Patronymic),
		Phone:           deref(row.Phone),
		PhoneNormalized: deref(row.PhoneNormalized),
		PhoneVerifiedAt: toTimePtrFromTimestamp(row.PhoneVerifiedAt),
		City:            deref(row.City),
		AvatarURL:       deref(row.AvatarUrl),
		IsVerified:      row.IsVerified,
		Birthday:        toTimePtr(row.Birthday),
		CreatedAt:       row.CreatedAt.Time,
		ListingsCount:   0,
		Rating:          0.0,
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
		Email: &email,
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

// LinkGuestRequests runs the full guest-request linking flow in one
// transaction. Raw SQL rather than sqlc: the generated LinkGuestRequests
// query only contained the first statement (the DELETE), so the actual
// linking UPDATE and the profile backfill were silently never executed.
// Returns the linked request IDs so callers can notify the listing owners.
func (r *UserRepo) LinkGuestRequests(ctx context.Context, userID int32, email string) ([]int32, error) {
	type TxBeginner interface {
		Begin(ctx context.Context) (pgx.Tx, error)
	}

	db := r.q.DB()
	txb, ok := db.(TxBeginner)
	if !ok {
		return nil, errors.New("underlying database connection does not support transactions")
	}

	tx, err := txb.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Drop guest requests the user made on their own listings.
	const deleteOwn = `
DELETE FROM request
USING house
WHERE request.house_id = house.id
  AND LOWER(TRIM(request.email)) = LOWER(TRIM($1))
  AND request.user_id IS NULL
  AND request.status = 'pending_verification'
  AND house.owner_id = $2::int`
	if _, err := tx.Exec(ctx, deleteOwn, email, userID); err != nil {
		return nil, err
	}

	// 2. Link the remaining guest requests to the verified user and move
	// them to in_progress so owners finally see them as pending.
	const linkRequests = `
UPDATE request
SET user_id = $2::int, status = 'in_progress', updated_at = now()
FROM house
WHERE request.house_id = house.id
  AND LOWER(TRIM(request.email)) = LOWER(TRIM($1))
  AND request.user_id IS NULL
  AND request.status = 'pending_verification'
  AND house.owner_id != $2::int
RETURNING request.id`
	rows, err := tx.Query(ctx, linkRequests, email, userID)
	if err != nil {
		return nil, err
	}
	var linkedIDs []int32
	for rows.Next() {
		var id int32
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		linkedIDs = append(linkedIDs, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// 3. Backfill the empty profile from the freshest guest request data.
	const backfillProfile = `
UPDATE "user"
SET
  name = COALESCE(NULLIF(name, ''), (SELECT name FROM request WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND name IS NOT NULL AND name != '' ORDER BY created_at DESC LIMIT 1)),
  surname = COALESCE(NULLIF(surname, ''), (SELECT surname FROM request WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND surname IS NOT NULL AND surname != '' ORDER BY created_at DESC LIMIT 1)),
  patronymic = COALESCE(NULLIF(patronymic, ''), (SELECT lastname FROM request WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND lastname IS NOT NULL AND lastname != '' ORDER BY created_at DESC LIMIT 1)),
  phone = COALESCE(NULLIF(phone, ''), (SELECT phone FROM request WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND phone IS NOT NULL AND phone != '' ORDER BY created_at DESC LIMIT 1))
WHERE id = $2::int
  AND (name IS NULL OR name = '' OR phone IS NULL OR phone = '')`
	if _, err := tx.Exec(ctx, backfillProfile, email, userID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return linkedIDs, nil
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

func (r *UserRepo) GetByPhone(ctx context.Context, phone string) (domain.User, error) {
	row, err := r.q.GetUserByPhone(ctx, &phone)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, err
	}
	return domain.User{
		ID:              row.ID,
		Email:           deref(row.Email),
		Name:            deref(row.Name),
		Surname:         deref(row.Surname),
		Patronymic:      deref(row.Patronymic),
		Phone:           deref(row.Phone),
		PhoneNormalized: deref(row.PhoneNormalized),
		PhoneVerifiedAt: toTimePtrFromTimestamp(row.PhoneVerifiedAt),
		City:            deref(row.City),
		AvatarURL:       deref(row.AvatarUrl),
		IsVerified:      row.IsVerified,
		Birthday:        toTimePtr(row.Birthday),
		CreatedAt:       row.CreatedAt.Time,
		ListingsCount:   0,
		Rating:          0.0,
	}, nil
}

func (r *UserRepo) CreateWithPhone(ctx context.Context, phone string) (domain.User, error) {
	row, err := r.q.CreateUser(ctx, sqlc.CreateUserParams{
		Phone:           &phone,
		PhoneNormalized: &phone,
		PhoneVerifiedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
		Roles:           defaultRoles,
	})
	if err != nil {
		return domain.User{}, err
	}
	return domain.User{
		ID:              row.ID,
		Email:           deref(row.Email),
		Name:            deref(row.Name),
		Surname:         deref(row.Surname),
		Patronymic:      deref(row.Patronymic),
		Phone:           deref(row.Phone),
		PhoneNormalized: deref(row.PhoneNormalized),
		PhoneVerifiedAt: toTimePtrFromTimestamp(row.PhoneVerifiedAt),
		City:            deref(row.City),
		AvatarURL:       deref(row.AvatarUrl),
		IsVerified:      row.IsVerified,
		Birthday:        toTimePtr(row.Birthday),
		CreatedAt:       row.CreatedAt.Time,
		ListingsCount:   0,
		Rating:          0.0,
	}, nil
}

func (r *UserRepo) UpdatePhone(ctx context.Context, id int32, phone, phoneNormalized string, verifiedAt time.Time) (domain.User, error) {
	_, err := r.q.UpdateUserPhone(ctx, sqlc.UpdateUserPhoneParams{
		ID:              id,
		Phone:           &phone,
		PhoneNormalized: &phoneNormalized,
		PhoneVerifiedAt: pgtype.Timestamptz{Time: verifiedAt, Valid: true},
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, domain.ErrNotFound
		}
		return domain.User{}, err
	}
	return r.GetByID(ctx, id)
}

func (r *UserRepo) LinkGuestRequestsByPhone(ctx context.Context, userID int32, phoneNormalized string) ([]int32, error) {
	type TxBeginner interface {
		Begin(ctx context.Context) (pgx.Tx, error)
	}

	db := r.q.DB()
	txb, ok := db.(TxBeginner)
	if !ok {
		return nil, errors.New("underlying database connection does not support transactions")
	}

	tx, err := txb.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Drop guest requests the user made on their own listings.
	const deleteOwn = `
DELETE FROM request
USING house
WHERE request.house_id = house.id
  AND request.phone_normalized = $1
  AND request.user_id IS NULL
  AND request.status = 'pending_verification'
  AND house.owner_id = $2::int`
	if _, err := tx.Exec(ctx, deleteOwn, phoneNormalized, userID); err != nil {
		return nil, err
	}

	// 2. Link the remaining guest requests to the verified user and move
	// them to in_progress so owners finally see them as pending.
	const linkRequests = `
UPDATE request
SET user_id = $2::int, status = 'in_progress', updated_at = now()
FROM house
WHERE request.house_id = house.id
  AND request.phone_normalized = $1
  AND request.user_id IS NULL
  AND request.status = 'pending_verification'
  AND house.owner_id != $2::int
RETURNING request.id`
	rows, err := tx.Query(ctx, linkRequests, phoneNormalized, userID)
	if err != nil {
		return nil, err
	}
	var linkedIDs []int32
	for rows.Next() {
		var id int32
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		linkedIDs = append(linkedIDs, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// 3. Backfill the empty profile from the freshest guest request data.
	const backfillProfile = `
UPDATE "user"
SET
  name = COALESCE(NULLIF(name, ''), (SELECT name FROM request WHERE phone_normalized = $1 AND name IS NOT NULL AND name != '' ORDER BY created_at DESC LIMIT 1)),
  surname = COALESCE(NULLIF(surname, ''), (SELECT surname FROM request WHERE phone_normalized = $1 AND surname IS NOT NULL AND surname != '' ORDER BY created_at DESC LIMIT 1)),
  patronymic = COALESCE(NULLIF(patronymic, ''), (SELECT lastname FROM request WHERE phone_normalized = $1 AND lastname IS NOT NULL AND lastname != '' ORDER BY created_at DESC LIMIT 1)),
  phone = COALESCE(NULLIF(phone, ''), (SELECT phone FROM request WHERE phone_normalized = $1 AND phone IS NOT NULL AND phone != '' ORDER BY created_at DESC LIMIT 1))
WHERE id = $2::int
  AND (name IS NULL OR name = '' OR phone IS NULL OR phone = '')`
	if _, err := tx.Exec(ctx, backfillProfile, phoneNormalized, userID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return linkedIDs, nil
}

func toTimePtrFromTimestamp(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time
	return &v
}
