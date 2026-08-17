package booking

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type blockingBookingRepo struct {
	domain.BookingRepository
	createCalls  int
	overlapCalls int
	confirmCalls int
}

func (r *blockingBookingRepo) GetHouseForBooking(context.Context, int32) (int32, string, string, error) {
	return 22, houseActive, "", nil
}

func (r *blockingBookingRepo) HasConfirmedOverlap(context.Context, int32, time.Time, *time.Time) (bool, error) {
	r.overlapCalls++
	return false, nil
}

func (r *blockingBookingRepo) Create(_ context.Context, b domain.NewBooking) (domain.Booking, error) {
	r.createCalls++
	return domain.Booking{ID: 1, HouseID: b.HouseID, UserID: b.UserID}, nil
}

func (r *blockingBookingRepo) GetByID(context.Context, int32) (domain.Booking, error) {
	return domain.Booking{
		ID:     1,
		UserID: 11,
		Status: domain.BookingPending,
		House:  &domain.BookingHouse{OwnerID: 22},
	}, nil
}

func (r *blockingBookingRepo) Confirm(context.Context, int32) (domain.Booking, error) {
	r.confirmCalls++
	return domain.Booking{ID: 1, UserID: 11, Status: domain.BookingConfirmed}, nil
}

type bookingBlockChecker struct {
	blocked bool
	calls   int
}

func (c *bookingBlockChecker) IsBlockedBetween(context.Context, int32, int32) (bool, error) {
	c.calls++
	return c.blocked, nil
}

func (c *bookingBlockChecker) BlockState(context.Context, int32, int32) (domain.UserBlockState, error) {
	return domain.UserBlockState{Blocked: c.blocked}, nil
}

func TestBlockedPairCannotCreateBooking(t *testing.T) {
	repo := &blockingBookingRepo{}
	checker := &bookingBlockChecker{blocked: true}
	svc := New(repo, Config{BlockChecker: checker})

	_, err := svc.Create(context.Background(), domain.NewBooking{
		HouseID:   3,
		UserID:    11,
		StartDate: time.Now(),
	})
	if !errors.Is(err, domain.ErrUserInteractionBlocked) {
		t.Fatalf("Create() error = %v, want ErrUserInteractionBlocked", err)
	}
	if repo.overlapCalls != 0 || repo.createCalls != 0 {
		t.Fatalf("booking work continued after block: overlap=%d create=%d", repo.overlapCalls, repo.createCalls)
	}
}

func TestBlockDoesNotDisableExistingBookingTransition(t *testing.T) {
	repo := &blockingBookingRepo{}
	checker := &bookingBlockChecker{blocked: true}
	svc := New(repo, Config{BlockChecker: checker})

	if _, err := svc.Confirm(context.Background(), 1, 22); err != nil {
		t.Fatalf("Confirm() error = %v", err)
	}
	if checker.calls != 0 {
		t.Fatal("existing booking transition consulted pair block")
	}
	if repo.confirmCalls != 1 {
		t.Fatalf("Confirm calls = %d, want 1", repo.confirmCalls)
	}
}
