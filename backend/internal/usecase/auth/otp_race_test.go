package auth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

// These tests pin the property that makes a 4-digit OTP survivable: the attempt
// budget must be spent BEFORE the code is compared, and the spend must be
// atomic. The old shape — SELECT attempts, compare, UPDATE attempts+1 — let N
// concurrent requests all observe attempts=0 and all reach the comparison,
// which collapses a 10 000-code space into a few minutes of parallel guessing.
//
// Run with -race: the fakes below are deliberately mutex-guarded so a genuine
// data race in the service shows up rather than hiding behind the fake.

const testChallengeID = "11111111-1111-4111-8111-111111111111"

// fakePhoneChallenges mirrors the semantics of the real UPDATE ... WHERE
// attempts < $2 ... RETURNING statement. spends counts how many callers were
// allowed through to the code comparison.
type fakePhoneChallenges struct {
	mu     sync.Mutex
	c      domain.PhoneChallenge
	spends int
}

func (f *fakePhoneChallenges) ConsumeAttempt(_ context.Context, id string, maxAttempts int32, now time.Time) (domain.PhoneChallenge, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.c.ID != id {
		return domain.PhoneChallenge{}, domain.ErrCodeInvalid
	}
	switch {
	case f.c.Attempts >= maxAttempts:
		return domain.PhoneChallenge{}, domain.ErrTooManyAttempts
	case f.c.Status != domain.PhoneChallengeStatusReady || f.c.CodeHash == nil:
		return domain.PhoneChallenge{}, domain.ErrCodeInvalid
	case !f.c.ExpiresAt.After(now):
		return domain.PhoneChallenge{}, domain.ErrCodeExpired
	}
	f.c.Attempts++
	f.spends++
	return f.c, nil
}

func (f *fakePhoneChallenges) snapshot() domain.PhoneChallenge {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.c
}

func (f *fakePhoneChallenges) spendCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.spends
}

func (f *fakePhoneChallenges) GetByID(_ context.Context, id string) (domain.PhoneChallenge, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.c.ID != id {
		return domain.PhoneChallenge{}, domain.ErrNotFound
	}
	return f.c, nil
}

func (f *fakePhoneChallenges) GetActive(_ context.Context, phone, purpose string) (domain.PhoneChallenge, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.c.PhoneNormalized != phone || f.c.Purpose != purpose {
		return domain.PhoneChallenge{}, domain.ErrNotFound
	}
	return f.c, nil
}

func (f *fakePhoneChallenges) MarkExpired(_ context.Context, id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.c.ID == id {
		f.c.Status = "expired"
		f.c.CodeHash = nil
	}
	return nil
}

func (f *fakePhoneChallenges) MarkVerified(_ context.Context, id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.c.ID == id {
		f.c.Status = "verified"
		f.c.CodeHash = nil
	}
	return nil
}

// Unused by these tests; present to satisfy domain.PhoneChallengeRepository.
func (f *fakePhoneChallenges) ReapStale(context.Context, time.Time) error { return nil }
func (f *fakePhoneChallenges) CreatePending(context.Context, domain.PhoneChallenge, domain.PhoneChallengeDelivery) error {
	return nil
}
func (f *fakePhoneChallenges) GetPendingDelivery(context.Context, string) (domain.PhoneChallengeDelivery, error) {
	return domain.PhoneChallengeDelivery{}, domain.ErrNotFound
}
func (f *fakePhoneChallenges) BeginDelivery(context.Context, string, string, string, string, time.Time) (domain.PhoneChallengeDelivery, error) {
	return domain.PhoneChallengeDelivery{}, nil
}
func (f *fakePhoneChallenges) MarkReady(context.Context, string, string, int32, string, string, time.Time) error {
	return nil
}
func (f *fakePhoneChallenges) MarkDeliveryFailed(context.Context, string, *string, *string) error {
	return nil
}

func newPhoneChallengeFixture(t *testing.T, code string) *fakePhoneChallenges {
	t.Helper()
	// MinCost keeps the suite fast; the property under test is the budget, not
	// the KDF parameters.
	hash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash code: %v", err)
	}
	hashStr := string(hash)
	return &fakePhoneChallenges{c: domain.PhoneChallenge{
		ID:              testChallengeID,
		PhoneNormalized: "+79991234567",
		Purpose:         domain.PhoneChallengePurposeLogin,
		CodeHash:        &hashStr,
		CodeLength:      int32(len(code)),
		Status:          domain.PhoneChallengeStatusReady,
		ExpiresAt:       time.Now().Add(10 * time.Minute),
	}}
}

func newPhoneTestService(repo domain.PhoneChallengeRepository) *Service {
	return &Service{phoneChallenges: repo, now: time.Now}
}

func TestVerifyPhoneChallenge_ConcurrentAttemptsShareOneBudget(t *testing.T) {
	const concurrency = 64
	repo := newPhoneChallengeFixture(t, "1234")
	svc := newPhoneTestService(repo)

	var wg sync.WaitGroup
	results := make([]error, concurrency)
	start := make(chan struct{})
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start // release all goroutines at once to maximise overlap
			_, err := svc.verifyPhoneChallenge(context.Background(), "+79991234567", "9999",
				domain.PhoneChallengePurposeLogin, testChallengeID, nil)
			results[i] = err
		}(i)
	}
	close(start)
	wg.Wait()

	if got := repo.spendCount(); got != maxAttempts {
		t.Fatalf("code comparison reached %d times, want exactly %d: the attempt budget is not being spent atomically", got, maxAttempts)
	}
	if got := repo.snapshot().Attempts; got != maxAttempts {
		t.Fatalf("attempts = %d, want %d", got, maxAttempts)
	}

	var invalid, tooMany int
	for _, err := range results {
		switch {
		case errors.Is(err, domain.ErrCodeInvalid):
			invalid++
		case errors.Is(err, domain.ErrTooManyAttempts):
			tooMany++
		default:
			t.Fatalf("unexpected error from verify: %v", err)
		}
	}
	if invalid != maxAttempts {
		t.Fatalf("%d requests got 'invalid code', want %d; the rest must be rejected as over budget", invalid, maxAttempts)
	}
	if tooMany != concurrency-maxAttempts {
		t.Fatalf("%d requests got 'too many attempts', want %d", tooMany, concurrency-maxAttempts)
	}
}

func TestVerifyPhoneChallenge_CorrectCodeIsAccepted(t *testing.T) {
	repo := newPhoneChallengeFixture(t, "4321")
	svc := newPhoneTestService(repo)

	c, err := svc.verifyPhoneChallenge(context.Background(), "+79991234567", "4321",
		domain.PhoneChallengePurposeLogin, testChallengeID, nil)
	if err != nil {
		t.Fatalf("verify with the correct code failed: %v", err)
	}
	if c.ID != testChallengeID {
		t.Fatalf("returned challenge %q, want %q", c.ID, testChallengeID)
	}
	// A successful verification still costs a try; that is intentional, the
	// budget is spent before the comparison can distinguish right from wrong.
	if got := repo.snapshot().Attempts; got != 1 {
		t.Fatalf("attempts = %d after one successful verify, want 1", got)
	}
}

func TestVerifyPhoneChallenge_RejectsOnceBudgetIsSpent(t *testing.T) {
	repo := newPhoneChallengeFixture(t, "1234")
	svc := newPhoneTestService(repo)

	for i := 0; i < maxAttempts; i++ {
		if _, err := svc.verifyPhoneChallenge(context.Background(), "+79991234567", "0000",
			domain.PhoneChallengePurposeLogin, testChallengeID, nil); !errors.Is(err, domain.ErrCodeInvalid) {
			t.Fatalf("attempt %d: got %v, want ErrCodeInvalid", i+1, err)
		}
	}
	// Even the correct code must not get through after the budget is gone.
	_, err := svc.verifyPhoneChallenge(context.Background(), "+79991234567", "1234",
		domain.PhoneChallengePurposeLogin, testChallengeID, nil)
	if !errors.Is(err, domain.ErrTooManyAttempts) {
		t.Fatalf("got %v, want ErrTooManyAttempts", err)
	}
	if got := repo.spendCount(); got != maxAttempts {
		t.Fatalf("code comparison reached %d times, want %d", got, maxAttempts)
	}
}

func TestVerifyPhoneChallenge_ExpiredChallengeIsNotSpendable(t *testing.T) {
	repo := newPhoneChallengeFixture(t, "1234")
	repo.c.ExpiresAt = time.Now().Add(-time.Second)
	svc := newPhoneTestService(repo)

	_, err := svc.verifyPhoneChallenge(context.Background(), "+79991234567", "1234",
		domain.PhoneChallengePurposeLogin, testChallengeID, nil)
	if !errors.Is(err, domain.ErrCodeExpired) {
		t.Fatalf("got %v, want ErrCodeExpired", err)
	}
	if got := repo.spendCount(); got != 0 {
		t.Fatalf("expired challenge consumed %d attempts, want 0", got)
	}
	if got := repo.snapshot().Status; got != "expired" {
		t.Fatalf("challenge status = %q, want it burned to \"expired\"", got)
	}
}

// fakeAuthCodes mirrors ConsumeAuthCodeAttempt: the budget guard lives in the
// same critical section as the increment.
type fakeAuthCodes struct {
	mu     sync.Mutex
	rec    domain.AuthCode
	exists bool
	spends int
}

func (f *fakeAuthCodes) ConsumeAttempt(_ context.Context, channel, target string, maxAttempts int32) (domain.AuthCode, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.exists || f.rec.Channel != channel || f.rec.Target != target {
		return domain.AuthCode{}, domain.ErrNotFound
	}
	if f.rec.Attempts >= maxAttempts {
		return domain.AuthCode{}, domain.ErrTooManyAttempts
	}
	f.rec.Attempts++
	f.spends++
	return f.rec, nil
}

func (f *fakeAuthCodes) Get(_ context.Context, channel, target string) (domain.AuthCode, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.exists || f.rec.Channel != channel || f.rec.Target != target {
		return domain.AuthCode{}, domain.ErrNotFound
	}
	return f.rec, nil
}

func (f *fakeAuthCodes) Delete(_ context.Context, _, _ string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.exists = false
	return nil
}

func (f *fakeAuthCodes) Upsert(_ context.Context, c domain.AuthCode) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.rec, f.exists = c, true
	return nil
}

func (f *fakeAuthCodes) spendCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.spends
}

func TestVerifyCode_ConcurrentEmailAttemptsShareOneBudget(t *testing.T) {
	const concurrency = 64
	hash, err := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash code: %v", err)
	}
	repo := &fakeAuthCodes{exists: true, rec: domain.AuthCode{
		Channel:   "email",
		Target:    "user@example.com",
		CodeHash:  string(hash),
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}}
	// users/refresh stay nil: every request below carries a wrong code, so the
	// service returns before it touches them.
	svc := &Service{codes: repo, now: time.Now}

	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, _ = svc.VerifyCode(context.Background(), "user@example.com", "000000", domain.DeviceInfo{})
		}()
	}
	close(start)
	wg.Wait()

	if got := repo.spendCount(); got != maxAttempts {
		t.Fatalf("code comparison reached %d times, want exactly %d", got, maxAttempts)
	}
}
