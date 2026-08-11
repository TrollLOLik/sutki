package legal

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type consentRepoStub struct {
	registration []domain.LegalConsent
	userConsent  *domain.LegalConsent
	boundID      string
	boundUserID  int32
	revoked      bool
	hasActive    bool
	checked      []domain.LegalDocument
}

func (r *consentRepoStub) AcceptRegistration(_ context.Context, consents []domain.LegalConsent) error {
	r.registration = append([]domain.LegalConsent(nil), consents...)
	return nil
}

func (r *consentRepoStub) BindRegistration(_ context.Context, registrationID string, userID int32) error {
	r.boundID, r.boundUserID = registrationID, userID
	return nil
}

func (r *consentRepoStub) AcceptForUser(_ context.Context, consent domain.LegalConsent) error {
	r.userConsent = &consent
	return nil
}

func (r *consentRepoStub) HasActive(_ context.Context, _ int32, document domain.LegalDocument) (bool, error) {
	r.checked = append(r.checked, document)
	return r.hasActive, nil
}

func (r *consentRepoStub) PublicProfileVisible(_ context.Context, _ int32) (bool, error) {
	return r.hasActive, nil
}

func (r *consentRepoStub) Revoke(_ context.Context, _ int32, documentType, _ string, _ time.Time) error {
	if documentType != domain.LegalDocumentDataDissemination {
		return errors.New("unexpected document type")
	}
	r.revoked = true
	return nil
}

func newTestService(t *testing.T, repo domain.LegalConsentRepository) *Service {
	t.Helper()
	const hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	service, err := New(repo, Config{
		Documents: map[string]domain.LegalDocument{
			domain.LegalDocumentUserAgreement:     {Version: "1.0", SHA256: hash},
			domain.LegalDocumentPersonalData:      {Version: "1.0", SHA256: hash},
			domain.LegalDocumentDataDissemination: {Version: "1.0", SHA256: hash},
		},
		Now: func() time.Time { return time.Date(2026, 8, 10, 12, 0, 0, 0, time.UTC) },
	})
	if err != nil {
		t.Fatalf("new service: %v", err)
	}
	return service
}

func TestAcceptLoginRecordsTwoSeparateDocuments(t *testing.T) {
	repo := &consentRepoStub{}
	service := newTestService(t, repo)
	request := RequestContext{
		RegistrationID: "device-1", IPAddress: "127.0.0.1", UserAgent: "test",
		AppVersion: "1.1.0", Source: domain.LegalConsentSourceAndroid,
	}

	if err := service.AcceptLogin(context.Background(), request); err != nil {
		t.Fatalf("accept login: %v", err)
	}
	if len(repo.registration) != 2 {
		t.Fatalf("recorded %d documents, want 2", len(repo.registration))
	}
	if repo.registration[0].Document.Type != domain.LegalDocumentUserAgreement ||
		repo.registration[1].Document.Type != domain.LegalDocumentPersonalData {
		t.Fatalf("unexpected documents: %#v", repo.registration)
	}
	for _, consent := range repo.registration {
		if consent.RegistrationID != request.RegistrationID || consent.Source != request.Source {
			t.Fatalf("request evidence was not preserved: %#v", consent)
		}
		if consent.AcceptedAt.IsZero() || consent.Document.SHA256 == "" {
			t.Fatalf("document evidence is incomplete: %#v", consent)
		}
	}
}

func TestDisseminationIsSeparateAndRequired(t *testing.T) {
	repo := &consentRepoStub{}
	service := newTestService(t, repo)
	request := RequestContext{RegistrationID: "web-session", Source: domain.LegalConsentSourceWeb}

	if err := service.RequireDissemination(context.Background(), 7); !errors.Is(err, domain.ErrLegalConsentRequired) {
		t.Fatalf("missing dissemination consent returned %v", err)
	}
	if err := service.AcceptDissemination(context.Background(), 7, request); err != nil {
		t.Fatalf("accept dissemination: %v", err)
	}
	if repo.userConsent == nil || repo.userConsent.Document.Type != domain.LegalDocumentDataDissemination {
		t.Fatalf("wrong user consent: %#v", repo.userConsent)
	}
	repo.hasActive = true
	if err := service.RequireDissemination(context.Background(), 7); err != nil {
		t.Fatalf("active dissemination consent rejected: %v", err)
	}
	if checked := repo.checked[len(repo.checked)-1]; checked.Version != "1.0" || checked.SHA256 == "" {
		t.Fatalf("consent was not checked against the current document: %#v", checked)
	}
	if err := service.RevokeDissemination(context.Background(), 7, "user request"); err != nil || !repo.revoked {
		t.Fatalf("revoke dissemination: %v", err)
	}
}

func TestStatusReturnsEveryCurrentDocument(t *testing.T) {
	repo := &consentRepoStub{hasActive: true}
	service := newTestService(t, repo)

	status, err := service.Status(context.Background(), 7)
	if err != nil {
		t.Fatalf("status: %v", err)
	}
	if len(status.Documents) != 3 || !status.PublicProfileVisible {
		t.Fatalf("unexpected status: %#v", status)
	}
	for _, document := range status.Documents {
		if !document.Accepted || document.Document.Version != "1.0" || document.Document.SHA256 == "" {
			t.Fatalf("incomplete document status: %#v", document)
		}
	}
}

func TestConsentContextIsFailClosed(t *testing.T) {
	service := newTestService(t, &consentRepoStub{})
	for _, request := range []RequestContext{
		{Source: domain.LegalConsentSourceWeb},
		{RegistrationID: "device-1", Source: "ios"},
	} {
		if err := service.AcceptLogin(context.Background(), request); !errors.Is(err, domain.ErrLegalConsentRequired) {
			t.Fatalf("invalid context returned %v", err)
		}
	}
}
