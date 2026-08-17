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

// AUTH-02. Rebinding a login factor used to need nothing but a valid access
// token. Since the phone is the login credential, that turned one stolen
// 15-minute token into permanent ownership of the account — and for a
// phone-only account, into permanent loss of it for the real owner. These
// tests pin the gate: no proof of the CURRENT factor, no rebind.

const reauthTestChallengeID = "22222222-2222-4222-8222-222222222222"

// fakeUsers is the slice of domain.UserRepository these tests touch.
type fakeUsers struct {
	mu      sync.Mutex
	user    domain.User
	byPhone map[string]domain.User
	updated bool
	created bool
}

func (f *fakeUsers) GetByID(_ context.Context, id int32) (domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.user.ID != id {
		return domain.User{}, domain.ErrNotFound
	}
	return f.user, nil
}

func (f *fakeUsers) GetByPhone(_ context.Context, phone string) (domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	u, ok := f.byPhone[phone]
	if !ok {
		return domain.User{}, domain.ErrNotFound
	}
	return u, nil
}

func (f *fakeUsers) UpdatePhone(_ context.Context, id int32, raw, normalized string, at time.Time) (domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.updated = true
	f.user.Phone = raw
	f.user.PhoneNormalized = normalized
	f.user.PhoneVerifiedAt = &at
	return f.user, nil
}

func (f *fakeUsers) UpdateEmail(_ context.Context, id int32, email string) (domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.updated = true
	f.user.Email = email
	return f.user, nil
}

func (f *fakeUsers) GetByEmail(_ context.Context, email string) (domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.user.Email != "" && f.user.Email == email {
		return f.user, nil
	}
	return domain.User{}, domain.ErrNotFound
}

func (f *fakeUsers) didUpdate() bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.updated
}

// Unused by these tests; present to satisfy domain.UserRepository.
func (f *fakeUsers) Create(context.Context, string) (domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.created = true
	return domain.User{}, nil
}
func (f *fakeUsers) CreateWithPhone(context.Context, string) (domain.User, error) {
	return domain.User{}, nil
}
func (f *fakeUsers) UpdateProfile(context.Context, int32, *string, *string, *string, *string, *string, *string, *time.Time, *string, *bool) (domain.User, error) {
	return domain.User{}, nil
}
func (f *fakeUsers) LinkGuestRequests(context.Context, int32, string) ([]int32, error) {
	return nil, nil
}
func (f *fakeUsers) LinkGuestRequestsByPhone(context.Context, int32, string) ([]int32, error) {
	return nil, nil
}
func (f *fakeUsers) Delete(context.Context, int32) error { return nil }
func (f *fakeUsers) CheckActiveBookings(context.Context, int32) (int64, error) {
	return 0, nil
}
func (f *fakeUsers) AnonymizeAndRevoke(context.Context, int32, string) error { return nil }

func (f *fakeUsers) didCreate() bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.created
}

func newChangePhoneFixture(t *testing.T, code string, userID int32) (*Service, *fakePhoneChallenges, *fakeUsers) {
	svc, challenges, users, _ := newChangePhoneFixtureFull(t, code, userID)
	return svc, challenges, users
}

func newChangePhoneFixtureFull(t *testing.T, code string, userID int32) (*Service, *fakePhoneChallenges, *fakeUsers, *fakeReauthChallenges) {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash code: %v", err)
	}
	hashStr := string(hash)
	verified := time.Now().Add(-24 * time.Hour)

	challenges := &fakePhoneChallenges{c: domain.PhoneChallenge{
		ID:              reauthTestChallengeID,
		PhoneNormalized: "+79995550000", // the NEW number being bound
		Purpose:         domain.PhoneChallengePurposeChangePhone,
		UserID:          &userID,
		CodeHash:        &hashStr,
		CodeLength:      int32(len(code)),
		Status:          domain.PhoneChallengeStatusReady,
		ExpiresAt:       time.Now().Add(10 * time.Minute),
	}}
	users := &fakeUsers{
		user: domain.User{
			ID:              userID,
			Email:           "owner@example.com",
			PhoneNormalized: "+79991234567", // the CURRENT number
			PhoneVerifiedAt: &verified,
		},
		byPhone: map[string]domain.User{},
	}
	sessions := &fakeSessions{active: []domain.RefreshToken{
		{ID: 100}, {ID: 101}, {ID: 102}, // 100 is the caller's own session
	}}
	proofs := &fakeReauthChallenges{users: users, sessions: sessions}
	svc := &Service{users: users, phoneChallenges: challenges, reauthChallenges: proofs,
		refresh: sessions, now: time.Now}
	return svc, challenges, users, proofs
}

// fakeReauthChallenges mirrors the reauth_challenge table AND the transaction
// ConsumeAndRebind runs: the whole method body is under one mutex and mutates
// nothing until every check has passed, so an error part-way through leaves the
// world untouched — exactly what a ROLLBACK does.
type fakeReauthChallenges struct {
	mu       sync.Mutex
	rows     []*domain.ReauthChallenge
	nextID   int64
	users    *fakeUsers
	sessions *fakeSessions
	// failRebind simulates the user UPDATE failing inside the transaction.
	failRebind bool
}

func (f *fakeReauthChallenges) Start(_ context.Context, a domain.ReauthAttempt) (domain.ReauthChallenge, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	// One live attempt per user, across purposes — see the partial unique index.
	for _, row := range f.rows {
		if row.UserID == a.UserID && row.ConsumedAt == nil {
			t := a.Now
			row.ConsumedAt = &t
		}
	}
	f.nextID++
	row := &domain.ReauthChallenge{
		ID: f.nextID, UserID: a.UserID, Purpose: a.Purpose, Factor: a.Factor,
		PhoneChallengeID: a.PhoneChallengeID, ExpiresAt: a.ExpiresAt, CreatedAt: a.Now,
	}
	f.rows = append(f.rows, row)
	return *row, nil
}

func (f *fakeReauthChallenges) Pending(_ context.Context, userID int32, now time.Time) (domain.ReauthChallenge, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, row := range f.rows {
		if row.UserID == userID && row.ConsumedAt == nil && row.VerifiedAt == nil && row.ExpiresAt.After(now) {
			return *row, nil
		}
	}
	return domain.ReauthChallenge{}, domain.ErrNotFound
}

func (f *fakeReauthChallenges) MarkVerified(_ context.Context, id int64, userID int32, tokenHash string, expiresAt, now time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, row := range f.rows {
		if row.ID == id && row.UserID == userID && row.ConsumedAt == nil && row.VerifiedAt == nil {
			h, t := tokenHash, now
			row.TokenHash, row.VerifiedAt, row.ExpiresAt = &h, &t, expiresAt
			return nil
		}
	}
	return domain.ErrNotFound
}

func (f *fakeReauthChallenges) liveProof(tokenHash string, userID int32, purpose string, now time.Time) *domain.ReauthChallenge {
	for _, row := range f.rows {
		if row.TokenHash == nil || *row.TokenHash != tokenHash {
			continue
		}
		if row.UserID != userID || row.Purpose != purpose {
			continue
		}
		if row.VerifiedAt == nil || row.ConsumedAt != nil || !row.ExpiresAt.After(now) {
			continue
		}
		return row
	}
	return nil
}

func (f *fakeReauthChallenges) Get(_ context.Context, tokenHash string, userID int32, purpose string, now time.Time) (domain.ReauthChallenge, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	row := f.liveProof(tokenHash, userID, purpose, now)
	if row == nil {
		return domain.ReauthChallenge{}, domain.ErrNotFound
	}
	return *row, nil
}

func (f *fakeReauthChallenges) ConsumeAndRebind(ctx context.Context, req domain.ReauthRebind, designate func(domain.User) (string, error)) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	user, err := f.users.GetByID(ctx, req.UserID)
	if err != nil {
		return err
	}
	wantFactor, err := designate(user)
	if err != nil {
		return err
	}
	row := f.liveProof(req.TokenHash, req.UserID, req.Purpose, req.Now)
	if row == nil {
		return domain.ErrNotFound
	}
	if row.Factor != wantFactor {
		return domain.ErrReauthRequired
	}
	if f.failRebind {
		// The rebind failed, so the transaction rolls back: the proof must NOT
		// be marked consumed.
		return errors.New("simulated rebind failure")
	}

	switch {
	case req.Phone != nil:
		if _, err := f.users.UpdatePhone(ctx, req.UserID, req.Phone.Raw, req.Phone.Normalized, req.Phone.VerifiedAt); err != nil {
			return err
		}
	case req.Email != nil:
		if _, err := f.users.UpdateEmail(ctx, req.UserID, *req.Email); err != nil {
			return err
		}
	default:
		return errors.New("neither phone nor email supplied")
	}
	if f.sessions != nil {
		if err := f.sessions.RevokeAllExcept(ctx, req.CurrentSessionID, req.UserID); err != nil {
			return err
		}
	}
	t := req.Now
	row.ConsumedAt = &t
	return nil
}

func (f *fakeReauthChallenges) DeleteExpired(_ context.Context, before time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	kept := f.rows[:0]
	for _, row := range f.rows {
		if !row.ExpiresAt.Before(before) {
			kept = append(kept, row)
		}
	}
	f.rows = kept
	return nil
}

func (f *fakeReauthChallenges) storedHashes() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []string
	for _, row := range f.rows {
		if row.TokenHash != nil {
			out = append(out, *row.TokenHash)
		}
	}
	return out
}

// mintProof drives the real issuing path for an attempt the server recorded,
// skipping only the OTP delivery (covered by its own tests).
func mintProof(t *testing.T, svc *Service, proofs *fakeReauthChallenges, userID int32, purpose, factor string) string {
	t.Helper()
	now := svc.now()
	attempt, err := proofs.Start(context.Background(), domain.ReauthAttempt{
		UserID: userID, Purpose: purpose, Factor: factor,
		ExpiresAt: now.Add(codeTTL), Now: now,
	})
	if err != nil {
		t.Fatalf("start attempt: %v", err)
	}
	token, err := svc.issueReauthToken(context.Background(), attempt.ID, userID, now)
	if err != nil {
		t.Fatalf("issue proof: %v", err)
	}
	return token
}

func TestRequestChangePhoneCode_RejectedWithoutReauthProof(t *testing.T) {
	svc, _, _ := newChangePhoneFixture(t, "1234", 7)

	_, err := svc.RequestChangePhoneCode(context.Background(), 7, "+79995550000", "flash_call", "")
	if !errors.Is(err, domain.ErrReauthRequired) {
		t.Fatalf("got %v, want ErrReauthRequired: a valid session alone must not start a phone rebind", err)
	}
}

func TestRequestChangePhoneCode_RejectedWithWrongReauthProof(t *testing.T) {
	svc, _, _, proofs := newChangePhoneFixtureFull(t, "1234", 7)
	mintProof(t, svc, proofs, 7, domain.ReauthPurposeChangePhone, ReauthFactorPhone)

	_, err := svc.RequestChangePhoneCode(context.Background(), 7, "+79995550000", "flash_call", "not-the-token")
	if !errors.Is(err, domain.ErrReauthRequired) {
		t.Fatalf("got %v, want ErrReauthRequired", err)
	}
}

func TestRequestChangePhoneCode_RejectedWithExpiredReauthProof(t *testing.T) {
	svc, _, _, proofs := newChangePhoneFixtureFull(t, "1234", 7)
	token := mintProof(t, svc, proofs, 7, domain.ReauthPurposeChangePhone, ReauthFactorPhone)
	svc.now = func() time.Time { return time.Now().Add(reauthTokenTTL + time.Minute) }

	_, err := svc.RequestChangePhoneCode(context.Background(), 7, "+79995550000", "flash_call", token)
	if !errors.Is(err, domain.ErrReauthRequired) {
		t.Fatalf("got %v, want ErrReauthRequired for an expired proof", err)
	}
}

func TestConfirmPhoneChange_RejectedWithoutReauthProof(t *testing.T) {
	svc, challenges, users := newChangePhoneFixture(t, "1234", 7)

	// The correct OTP for the new number is not enough on its own.
	_, err := svc.ConfirmPhoneChange(context.Background(), 7, 100, "+79995550000", "1234", reauthTestChallengeID, "")
	if !errors.Is(err, domain.ErrReauthRequired) {
		t.Fatalf("got %v, want ErrReauthRequired", err)
	}
	if users.didUpdate() {
		t.Fatal("phone was rebound despite the missing proof")
	}
	if got := challenges.spendCount(); got != 0 {
		t.Fatalf("the OTP budget was spent before the proof check: %d spends", got)
	}
}

func TestConfirmPhoneChange_SucceedsWithProofAndRevokesOtherSessions(t *testing.T) {
	svc, _, users, proofs := newChangePhoneFixtureFull(t, "1234", 7)
	notifier := &fakeNotifier{}
	svc.notifier = notifier
	token := mintProof(t, svc, proofs, 7, domain.ReauthPurposeChangePhone, ReauthFactorPhone)

	if _, err := svc.ConfirmPhoneChange(context.Background(), 7, 100, "+79995550000", "1234", reauthTestChallengeID, token); err != nil {
		t.Fatalf("confirm with a valid proof failed: %v", err)
	}
	if !users.didUpdate() {
		t.Fatal("phone was not rebound")
	}
	if got := proofs.sessions.revokedExcept(); got != 100 {
		t.Fatalf("other sessions not revoked (currentSID seen: %d, want 100)", got)
	}
	if notifier.factor() != ReauthFactorPhone || notifier.recipient() != "owner@example.com" {
		t.Fatalf("old contact not warned: factor=%q recipient=%q", notifier.factor(), notifier.recipient())
	}
	// The durable revocation is not enough on its own: this instance caches
	// session validity, so the other sessions must also be blacklisted in memory
	// or a stolen one keeps passing middleware until its access token expires.
	for _, sid := range []int64{101, 102} {
		if !svc.isSessionBlacklisted(sid) {
			t.Fatalf("session %d was revoked in the database but still passes this instance's cache", sid)
		}
	}
	if svc.isSessionBlacklisted(100) {
		t.Fatal("the caller's own session was blacklisted")
	}
	if err := svc.requireReauth(context.Background(), 7, domain.ReauthPurposeChangePhone, token); !errors.Is(err, domain.ErrReauthRequired) {
		t.Fatalf("proof survived the change (%v); a second rebind would need no new confirmation", err)
	}
}

// P1: the spend and the rebind are one transaction. A failure applying the
// change must roll the spend back, or the user is left with a burned proof and
// an unchanged account — locked out of their own change until they pay for
// another re-authentication.
func TestConfirmPhoneChange_FailedRebindDoesNotBurnTheProof(t *testing.T) {
	svc, _, users, proofs := newChangePhoneFixtureFull(t, "1234", 7)
	token := mintProof(t, svc, proofs, 7, domain.ReauthPurposeChangePhone, ReauthFactorPhone)
	proofs.failRebind = true

	if _, err := svc.ConfirmPhoneChange(context.Background(), 7, 100, "+79995550000", "1234", reauthTestChallengeID, token); err == nil {
		t.Fatal("expected the rebind to fail")
	}
	if users.didUpdate() {
		t.Fatal("phone was rebound despite the failure")
	}
	if err := svc.requireReauth(context.Background(), 7, domain.ReauthPurposeChangePhone, token); err != nil {
		t.Fatalf("proof was burned by a failed rebind (%v)", err)
	}

	// And the retry, once the failure clears, must go through.
	proofs.failRebind = false
	if _, err := svc.ConfirmPhoneChange(context.Background(), 7, 100, "+79995550000", "1234", reauthTestChallengeID, token); err != nil {
		t.Fatalf("retry after a transient failure: %v", err)
	}
	if !users.didUpdate() {
		t.Fatal("phone not rebound on the retry")
	}
}

// Guards the ordering of the two checks in ConfirmPhoneChange: the proof is
// validated at entry but spent only at the write, so a mistyped OTP costs one
// attempt out of five rather than the whole re-authentication.
func TestConfirmPhoneChange_WrongCodeDoesNotBurnTheProof(t *testing.T) {
	svc, challenges, users, proofs := newChangePhoneFixtureFull(t, "1234", 7)
	svc.notifier = &fakeNotifier{}
	token := mintProof(t, svc, proofs, 7, domain.ReauthPurposeChangePhone, ReauthFactorPhone)

	_, err := svc.ConfirmPhoneChange(context.Background(), 7, 100, "+79995550000", "9999", reauthTestChallengeID, token)
	if !errors.Is(err, domain.ErrCodeInvalid) {
		t.Fatalf("got %v, want ErrCodeInvalid", err)
	}
	if users.didUpdate() {
		t.Fatal("phone rebound on a wrong code")
	}
	if got := challenges.spendCount(); got != 1 {
		t.Fatalf("OTP attempts spent = %d, want 1", got)
	}
	if err := svc.requireReauth(context.Background(), 7, domain.ReauthPurposeChangePhone, token); err != nil {
		t.Fatalf("proof was burned by a mistyped code (%v)", err)
	}
	if _, err := svc.ConfirmPhoneChange(context.Background(), 7, 100, "+79995550000", "1234", reauthTestChallengeID, token); err != nil {
		t.Fatalf("retry with the correct code failed: %v", err)
	}
	if !users.didUpdate() {
		t.Fatal("phone not rebound on the retry")
	}
}

// P1: the operation a code authorizes is fixed when the code is REQUESTED.
// VerifyReauthCode takes no purpose at all — it reads it from the recorded
// attempt — so a code obtained "to change my email" cannot be redeemed as
// authorization to change the phone.
func TestVerifyReauthCode_PurposeComesFromTheRecordedAttempt(t *testing.T) {
	svc, _, users, proofs := newChangePhoneFixtureFull(t, "1234", 7)
	// Email-only account, so re-auth runs over the email code path.
	users.user.PhoneVerifiedAt = nil
	users.user.PhoneNormalized = ""

	hash, err := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	svc.codes = &fakeAuthCodes{exists: true, rec: domain.AuthCode{
		Channel: "email", Target: "owner@example.com",
		CodeHash: string(hash), ExpiresAt: time.Now().Add(10 * time.Minute),
	}}

	now := svc.now()
	if _, err := proofs.Start(context.Background(), domain.ReauthAttempt{
		UserID: 7, Purpose: domain.ReauthPurposeChangeEmail, Factor: ReauthFactorEmail,
		ExpiresAt: now.Add(codeTTL), Now: now,
	}); err != nil {
		t.Fatalf("start attempt: %v", err)
	}

	token, err := svc.VerifyReauthCode(context.Background(), 7, "123456")
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if err := svc.requireReauth(context.Background(), 7, domain.ReauthPurposeChangePhone, token); !errors.Is(err, domain.ErrReauthRequired) {
		t.Fatalf("got %v, want ErrReauthRequired: a code requested to change the email must not authorize the phone", err)
	}
	if err := svc.requireReauth(context.Background(), 7, domain.ReauthPurposeChangeEmail, token); err != nil {
		t.Fatalf("proof rejected for the purpose it was actually requested for: %v", err)
	}
}

func TestVerifyReauthCode_RejectsWithoutAPendingAttempt(t *testing.T) {
	svc, _, _, _ := newChangePhoneFixtureFull(t, "1234", 7)
	if _, err := svc.VerifyReauthCode(context.Background(), 7, "123456"); !errors.Is(err, domain.ErrCodeInvalid) {
		t.Fatalf("got %v, want ErrCodeInvalid", err)
	}
}

func TestReauthProof_NotSpendableByAnotherUser(t *testing.T) {
	svc, _, _, proofs := newChangePhoneFixtureFull(t, "1234", 7)
	token := mintProof(t, svc, proofs, 7, domain.ReauthPurposeChangePhone, ReauthFactorPhone)
	if err := svc.requireReauth(context.Background(), 8, domain.ReauthPurposeChangePhone, token); !errors.Is(err, domain.ErrReauthRequired) {
		t.Fatalf("got %v, want ErrReauthRequired for another user's proof", err)
	}
}

func TestIssueReauthToken_StoresOnlyTheHash(t *testing.T) {
	svc, _, _, proofs := newChangePhoneFixtureFull(t, "1234", 7)
	token := mintProof(t, svc, proofs, 7, domain.ReauthPurposeChangePhone, ReauthFactorPhone)
	for _, stored := range proofs.storedHashes() {
		if stored == token {
			t.Fatal("the token itself is in storage; a database read would yield a spendable proof")
		}
	}
	if len(proofs.storedHashes()) != 1 || proofs.storedHashes()[0] != hashToken(token) {
		t.Fatal("proof not stored under its hash")
	}
}

func TestStartingAReauth_InvalidatesThePreviousProof(t *testing.T) {
	svc, _, _, proofs := newChangePhoneFixtureFull(t, "1234", 7)
	first := mintProof(t, svc, proofs, 7, domain.ReauthPurposeChangePhone, ReauthFactorPhone)
	second := mintProof(t, svc, proofs, 7, domain.ReauthPurposeChangePhone, ReauthFactorPhone)

	if err := svc.requireReauth(context.Background(), 7, domain.ReauthPurposeChangePhone, first); !errors.Is(err, domain.ErrReauthRequired) {
		t.Fatalf("got %v, want the first proof to be dead after re-authenticating", err)
	}
	if err := svc.requireReauth(context.Background(), 7, domain.ReauthPurposeChangePhone, second); err != nil {
		t.Fatalf("second proof rejected: %v", err)
	}
}

func TestRequireReauth_FailsClosedWithoutRepository(t *testing.T) {
	svc, _, _, proofs := newChangePhoneFixtureFull(t, "1234", 7)
	token := mintProof(t, svc, proofs, 7, domain.ReauthPurposeChangePhone, ReauthFactorPhone)
	svc.reauthChallenges = nil
	if err := svc.requireReauth(context.Background(), 7, domain.ReauthPurposeChangePhone, token); !errors.Is(err, domain.ErrReauthRequired) {
		t.Fatalf("got %v, want ErrReauthRequired when the repository is missing", err)
	}
}

func TestRequestNewEmailCode_PhoneOnlyAccountStillNeedsProof(t *testing.T) {
	svc, _, users := newChangePhoneFixture(t, "1234", 7)
	users.user.Email = "" // phone-only: the branch that used to skip the check

	_, err := svc.RequestNewEmailCode(context.Background(), 7, "", "new@example.com")
	if !errors.Is(err, domain.ErrReauthRequired) {
		t.Fatalf("got %v, want ErrReauthRequired: the empty-email branch must not skip the gate", err)
	}
}

func TestReauthFactorFor_PrefersVerifiedPhone(t *testing.T) {
	verified := time.Now()
	cases := []struct {
		name string
		user domain.User
		want string
		err  error
	}{
		{"verified phone wins", domain.User{Email: "a@b.c", PhoneNormalized: "+79991234567", PhoneVerifiedAt: &verified}, ReauthFactorPhone, nil},
		{"unverified phone falls back to email", domain.User{Email: "a@b.c", PhoneNormalized: "+79991234567"}, ReauthFactorEmail, nil},
		{"email only", domain.User{Email: "a@b.c"}, ReauthFactorEmail, nil},
		{"phone only", domain.User{PhoneNormalized: "+79991234567", PhoneVerifiedAt: &verified}, ReauthFactorPhone, nil},
		{"nothing to prove", domain.User{}, "", domain.ErrReauthUnavailable},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := reauthFactorFor(tc.user)
			if !errors.Is(err, tc.err) {
				t.Fatalf("err = %v, want %v", err, tc.err)
			}
			if got != tc.want {
				t.Fatalf("factor = %q, want %q", got, tc.want)
			}
		})
	}
}

// fakeSessions models refresh_token including revoked_at, because ListActive
// filters on it: a fake that always returned nil would let a dead
// blacklist-mirroring loop pass every assertion.
type fakeSessions struct {
	mu      sync.Mutex
	active  []domain.RefreshToken
	revoked map[int64]bool
	except  int64
	called  bool
}

func (f *fakeSessions) RevokeAllExcept(_ context.Context, currentID int64, _ int32) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.called, f.except = true, currentID
	if f.revoked == nil {
		f.revoked = map[int64]bool{}
	}
	for _, t := range f.active {
		if t.ID != currentID {
			f.revoked[t.ID] = true
		}
	}
	return nil
}

func (f *fakeSessions) revokedExcept() int64 {
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.called {
		return -1
	}
	return f.except
}

func (f *fakeSessions) ListActive(context.Context, int32) ([]domain.RefreshToken, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []domain.RefreshToken
	for _, t := range f.active {
		if !f.revoked[t.ID] {
			out = append(out, t)
		}
	}
	return out, nil
}

// Unused by these tests; present to satisfy domain.RefreshTokenRepository.
func (f *fakeSessions) Create(context.Context, int32, string, time.Time, *string, *string, *string, *string, *string) (int64, error) {
	return 0, nil
}
func (f *fakeSessions) Get(context.Context, string) (domain.RefreshToken, error) {
	return domain.RefreshToken{}, domain.ErrNotFound
}
func (f *fakeSessions) GetByID(context.Context, int64) (domain.RefreshToken, error) {
	return domain.RefreshToken{}, domain.ErrNotFound
}
func (f *fakeSessions) Revoke(context.Context, string) error                     { return nil }
func (f *fakeSessions) RevokeByID(context.Context, int64, int32) error           { return nil }
func (f *fakeSessions) UpdateActiveTime(context.Context, int64, time.Time) error { return nil }
func (f *fakeSessions) UpdateLocation(context.Context, int64, string) error      { return nil }

// fakeNotifier records the factor-change warning.
type fakeNotifier struct {
	mu     sync.Mutex
	fac    string
	to     string
	called bool
}

func (f *fakeNotifier) NotifyFactorChanged(_ context.Context, _ int32, email, factor string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.called, f.to, f.fac = true, email, factor
	return nil
}

func (f *fakeNotifier) factor() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.fac
}

func (f *fakeNotifier) recipient() string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.to
}

// Unused by these tests; present to satisfy domain.EmailNotifier.
func (f *fakeNotifier) SendLoginCode(context.Context, string, string, time.Duration) error {
	return nil
}
func (f *fakeNotifier) NotifyBookingRequested(context.Context, string, domain.Booking) error {
	return nil
}
func (f *fakeNotifier) NotifyBookingConfirmed(context.Context, domain.Booking) error { return nil }
func (f *fakeNotifier) NotifyBookingRejected(context.Context, domain.Booking, string) error {
	return nil
}
func (f *fakeNotifier) NotifyBookingCancelled(context.Context, int32, string, domain.Booking) error {
	return nil
}
func (f *fakeNotifier) NotifyChatMessage(context.Context, int32, string, string, int64) error {
	return nil
}
func (f *fakeNotifier) SendWelcome(context.Context, int32, string) error { return nil }
func (f *fakeNotifier) NotifyReviewReceived(context.Context, int32, string, int64, int32, string) error {
	return nil
}
func (f *fakeNotifier) NotifyReviewModerated(context.Context, int32, string, int64, string, string, string) error {
	return nil
}

// End-to-end over the write side of the purpose binding: RequestReauthCode is
// what records the attempt, and until now only its read side was covered.
func TestRequestReauthCode_RecordsThePurposeItWasAskedFor(t *testing.T) {
	svc, _, users, proofs := newChangePhoneFixtureFull(t, "1234", 7)
	// Email-only account so the flow takes the email branch and needs no phone
	// provider.
	users.user.PhoneVerifiedAt = nil
	users.user.PhoneNormalized = ""
	svc.codes = &fakeAuthCodes{}
	// RequestCode enforces a 60s resend cooldown per address; exposeCode is its
	// documented dev bypass and this test issues two codes back to back.
	svc.exposeCode = true

	if _, err := svc.RequestReauthCode(context.Background(), 7, domain.ReauthPurposeChangeEmail); err != nil {
		t.Fatalf("request: %v", err)
	}
	attempt, err := proofs.Pending(context.Background(), 7, svc.now())
	if err != nil {
		t.Fatalf("no attempt recorded: %v", err)
	}
	if attempt.Purpose != domain.ReauthPurposeChangeEmail {
		t.Fatalf("recorded purpose = %q, want change_email", attempt.Purpose)
	}
	if attempt.Factor != ReauthFactorEmail {
		t.Fatalf("recorded factor = %q, want email", attempt.Factor)
	}

	// A second request for the other purpose must replace the first, so the one
	// live attempt always matches the code the user is about to be sent.
	if _, err := svc.RequestReauthCode(context.Background(), 7, domain.ReauthPurposeChangePhone); err != nil {
		t.Fatalf("second request: %v", err)
	}
	attempt, err = proofs.Pending(context.Background(), 7, svc.now())
	if err != nil {
		t.Fatalf("no attempt after the second request: %v", err)
	}
	if attempt.Purpose != domain.ReauthPurposeChangePhone {
		t.Fatalf("recorded purpose = %q, want change_phone", attempt.Purpose)
	}
}

func TestRequestReauthCode_RejectsAnUnknownPurpose(t *testing.T) {
	svc, _, _, _ := newChangePhoneFixtureFull(t, "1234", 7)
	if _, err := svc.RequestReauthCode(context.Background(), 7, "change_password"); !errors.Is(err, domain.ErrCodeInvalid) {
		t.Fatalf("got %v, want ErrCodeInvalid", err)
	}
}

// Pins the user_id predicate in MarkVerified. Attempt ids are small sequential
// integers, so a caller that ever passed the wrong one must not be able to
// attach its proof to somebody else's live attempt — which would both destroy
// the victim's re-authentication and hand the caller a token bound to it.
func TestIssueReauthToken_CannotAttachToAnotherUsersAttempt(t *testing.T) {
	svc, _, _, proofs := newChangePhoneFixtureFull(t, "1234", 7)
	now := svc.now()
	victim, err := proofs.Start(context.Background(), domain.ReauthAttempt{
		UserID: 8, Purpose: domain.ReauthPurposeChangePhone, Factor: ReauthFactorPhone,
		ExpiresAt: now.Add(codeTTL), Now: now,
	})
	if err != nil {
		t.Fatalf("start victim attempt: %v", err)
	}

	if _, err := svc.issueReauthToken(context.Background(), victim.ID, 7, now); !errors.Is(err, domain.ErrCodeInvalid) {
		t.Fatalf("got %v, want ErrCodeInvalid: user 7 must not mint against user 8's attempt", err)
	}
	// And the victim's attempt is untouched, so their own flow still completes.
	still, err := proofs.Pending(context.Background(), 8, now)
	if err != nil {
		t.Fatalf("victim's attempt was destroyed: %v", err)
	}
	if still.VerifiedAt != nil {
		t.Fatal("victim's attempt was marked verified by another user")
	}
}

func TestRequestReauthVoiceFallback_RequiresAPendingPhoneAttempt(t *testing.T) {
	svc, _, users, proofs := newChangePhoneFixtureFull(t, "1234", 7)

	// Nothing in flight at all.
	if _, err := svc.RequestReauthVoiceFallback(context.Background(), 7); !errors.Is(err, domain.ErrCodeInvalid) {
		t.Fatalf("got %v, want ErrCodeInvalid with no pending attempt", err)
	}

	// An email attempt has no call to re-deliver.
	users.user.PhoneVerifiedAt = nil
	users.user.PhoneNormalized = ""
	now := svc.now()
	if _, err := proofs.Start(context.Background(), domain.ReauthAttempt{
		UserID: 7, Purpose: domain.ReauthPurposeChangeEmail, Factor: ReauthFactorEmail,
		ExpiresAt: now.Add(codeTTL), Now: now,
	}); err != nil {
		t.Fatalf("start attempt: %v", err)
	}
	if _, err := svc.RequestReauthVoiceFallback(context.Background(), 7); !errors.Is(err, domain.ErrCodeInvalid) {
		t.Fatalf("got %v, want ErrCodeInvalid for an email attempt", err)
	}
}
