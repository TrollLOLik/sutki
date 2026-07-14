package postgres_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres"
	"github.com/TrollLOLik/sutki/backend/internal/repository/postgres/sqlc"
)

func TestReviewEditAttemptsFlow(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:MadLust20@localhost:5432/ce76279_sutki?sslmode=disable"
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	// 1. Create temporary host and guest
	var hostID, guestID int32
	err = pool.QueryRow(ctx, `INSERT INTO "user"(email, name, roles, deleted, enable, is_verified, created_at, updated_at) VALUES('test-host@example.com', 'Test Host', '[]'::jsonb, false, true, true, now(), now()) RETURNING id`).Scan(&hostID)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM "user" WHERE id IN ($1, $2)`, hostID, guestID)
	}()

	err = pool.QueryRow(ctx, `INSERT INTO "user"(email, name, roles, deleted, enable, is_verified, created_at, updated_at) VALUES('test-guest@example.com', 'Test Guest', '[]'::jsonb, false, true, true, now(), now()) RETURNING id`).Scan(&guestID)
	if err != nil {
		t.Fatal(err)
	}

	// 2. Create temporary house
	var houseID int32
	err = pool.QueryRow(ctx, `
		INSERT INTO house(owner_id, street, description, price, deleted, count_room, created_at, updated_at, house_number, area) 
		VALUES($1, 'Main St', 'Test House Description', 1000, false, '1', now(), now(), '1', 50) 
		RETURNING id`, hostID).Scan(&houseID)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM house WHERE id = $1`, houseID)
	}()

	// 3. Create confirmed booking request (in the past, so eligible for review)
	var requestID int32
	yesterday := time.Now().AddDate(0, 0, -2)
	today := time.Now().AddDate(0, 0, -1)
	err = pool.QueryRow(ctx, `
		INSERT INTO request(house_id, user_id, name, surname, lastname, count, phone, start_date, end_date, status, created_at, updated_at) 
		VALUES($1, $2, 'GuestName', 'GuestSurname', 'GuestLastname', 2, '+79998887766', $3, $4, 'confirmed', now(), now()) 
		RETURNING id`, houseID, guestID, yesterday, today).Scan(&requestID)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM review WHERE request_id = $1`, requestID)
		_, _ = pool.Exec(context.Background(), `DELETE FROM request WHERE id = $1`, requestID)
	}()

	repo := postgres.NewReviewRepo(pool, sqlc.New(pool))

	// 4. Check eligibility before review creation
	elig, err := repo.Eligibility(ctx, requestID, guestID)
	if err != nil {
		t.Fatal(err)
	}
	if !elig.CanReview {
		t.Fatal("expected guest to be eligible for review")
	}
	if elig.EditAttempts != 0 {
		t.Fatalf("expected initial edit attempts to be 0, got %d", elig.EditAttempts)
	}

	// 5. Create initial pending review
	newReview := domain.NewReview{
		RequestID: requestID,
		AuthorID:  guestID,
		Rating:    5,
		Body:      "Initial review content",
	}
	contentHash := "hash1"
	r, err := repo.CreatePending(ctx, newReview, contentHash, "masked text", []string{})
	if err != nil {
		t.Fatal(err)
	}
	if r.Status != "pending_moderation" {
		t.Fatalf("expected status to be pending_moderation, got %s", r.Status)
	}

	// 6. Check eligibility: should NOT be allowed to review or edit when review is pending
	elig, err = repo.Eligibility(ctx, requestID, guestID)
	if err != nil {
		t.Fatal(err)
	}
	if elig.CanReview {
		t.Fatal("should not be allowed to review when one is pending")
	}

	// Try creating duplicate review or editing: should fail with ErrReviewNotAllowed
	_, err = repo.CreatePending(ctx, newReview, "hash1_diff", "masked", []string{})
	if !errors.Is(err, domain.ErrReviewNotAllowed) {
		t.Fatalf("expected ErrReviewNotAllowed, got %v", err)
	}

	// 7. Reject the review
	_, err = pool.Exec(ctx, `UPDATE review SET status = 'rejected', rejection_reason = 'Profanity' WHERE id = $1`, r.ID)
	if err != nil {
		t.Fatal(err)
	}

	// 8. Check eligibility: should be allowed to review (edit) again!
	elig, err = repo.Eligibility(ctx, requestID, guestID)
	if err != nil {
		t.Fatal(err)
	}
	if !elig.CanReview {
		t.Fatal("expected guest to be eligible for review after rejection")
	}
	if elig.ReviewStatus != "rejected" {
		t.Fatalf("expected review status to be rejected, got %s", elig.ReviewStatus)
	}
	if elig.RejectionReason != "Profanity" {
		t.Fatalf("expected rejection reason 'Profanity', got '%s'", elig.RejectionReason)
	}

	// 9. First edit: try submitting same content (no-op check)
	_, err = repo.CreatePending(ctx, newReview, contentHash, "masked text", []string{})
	if !errors.Is(err, domain.ErrReviewUnchanged) {
		t.Fatalf("expected ErrReviewUnchanged, got %v", err)
	}

	// Perform actual edit with new content
	newReview.Body = "Updated review content 1"
	contentHash = "hash2"
	r2, err := repo.CreatePending(ctx, newReview, contentHash, "masked text 2", []string{})
	if err != nil {
		t.Fatal(err)
	}
	if r2.ID != r.ID {
		t.Fatalf("expected same review ID, got %d vs %d", r2.ID, r.ID)
	}

	// Verify edit_attempts is 1 in database
	var attempts int32
	var dbStatus string
	err = pool.QueryRow(ctx, `SELECT edit_attempts, status FROM review WHERE id = $1`, r.ID).Scan(&attempts, &dbStatus)
	if err != nil {
		t.Fatal(err)
	}
	if attempts != 1 {
		t.Fatalf("expected edit_attempts to be 1, got %d", attempts)
	}
	if dbStatus != "pending_moderation" {
		t.Fatalf("expected status to reset to pending_moderation, got %s", dbStatus)
	}

	// 10. Reject again and perform 2nd edit
	_, err = pool.Exec(ctx, `UPDATE review SET status = 'rejected' WHERE id = $1`, r.ID)
	if err != nil {
		t.Fatal(err)
	}
	newReview.Body = "Updated review content 2"
	contentHash = "hash3"
	_, err = repo.CreatePending(ctx, newReview, contentHash, "masked text 3", []string{})
	if err != nil {
		t.Fatal(err)
	}

	// 11. Reject again and perform 3rd edit
	_, err = pool.Exec(ctx, `UPDATE review SET status = 'rejected' WHERE id = $1`, r.ID)
	if err != nil {
		t.Fatal(err)
	}
	newReview.Body = "Updated review content 3"
	contentHash = "hash4"
	_, err = repo.CreatePending(ctx, newReview, contentHash, "masked text 4", []string{})
	if err != nil {
		t.Fatal(err)
	}

	// 12. Reject again and verify that 4th edit is BLOCKED
	_, err = pool.Exec(ctx, `UPDATE review SET status = 'rejected' WHERE id = $1`, r.ID)
	if err != nil {
		t.Fatal(err)
	}

	// Verify eligibility: can_review should be false, edit_attempts should be 3
	elig, err = repo.Eligibility(ctx, requestID, guestID)
	if err != nil {
		t.Fatal(err)
	}
	if elig.CanReview {
		t.Fatal("should not be allowed to review/edit after 3 attempts")
	}
	if elig.EditAttempts != 3 {
		t.Fatalf("expected edit attempts to be 3, got %d", elig.EditAttempts)
	}

	newReview.Body = "Updated review content 4"
	contentHash = "hash5"
	_, err = repo.CreatePending(ctx, newReview, contentHash, "masked text 5", []string{})
	if !errors.Is(err, domain.ErrReviewAttemptsExceeded) {
		t.Fatalf("expected ErrReviewAttemptsExceeded, got %v", err)
	}
}
