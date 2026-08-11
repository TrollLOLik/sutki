package legal

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

var sha256Pattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

type Config struct {
	Documents map[string]domain.LegalDocument
	Now       func() time.Time
}

type Service struct {
	repo      domain.LegalConsentRepository
	documents map[string]domain.LegalDocument
	now       func() time.Time
}

func New(repo domain.LegalConsentRepository, cfg Config) (*Service, error) {
	if repo == nil {
		return nil, errors.New("legal consent repository is required")
	}
	for _, documentType := range []string{
		domain.LegalDocumentUserAgreement,
		domain.LegalDocumentPersonalData,
		domain.LegalDocumentDataDissemination,
	} {
		document, ok := cfg.Documents[documentType]
		if !ok || strings.TrimSpace(document.Version) == "" || !sha256Pattern.MatchString(document.SHA256) {
			return nil, fmt.Errorf("legal document %s requires a version and lowercase SHA-256", documentType)
		}
		document.Type = documentType
		cfg.Documents[documentType] = document
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	return &Service{repo: repo, documents: cfg.Documents, now: cfg.Now}, nil
}

type RequestContext struct {
	RegistrationID string
	IPAddress      string
	UserAgent      string
	AppVersion     string
	Source         string
}

type DocumentStatus struct {
	Document domain.LegalDocument
	Accepted bool
}

type Status struct {
	Documents            []DocumentStatus
	PublicProfileVisible bool
}

func (s *Service) Documents() []domain.LegalDocument {
	return []domain.LegalDocument{
		s.documents[domain.LegalDocumentUserAgreement],
		s.documents[domain.LegalDocumentPersonalData],
		s.documents[domain.LegalDocumentDataDissemination],
	}
}

func (s *Service) AcceptLogin(ctx context.Context, request RequestContext) error {
	if err := validateRequestContext(request); err != nil {
		return err
	}
	acceptedAt := s.now().UTC()
	consents := make([]domain.LegalConsent, 0, 2)
	for _, documentType := range []string{domain.LegalDocumentUserAgreement, domain.LegalDocumentPersonalData} {
		consents = append(consents, consentFromRequest(nil, s.documents[documentType], acceptedAt, request))
	}
	return s.repo.AcceptRegistration(ctx, consents)
}

func (s *Service) BindLogin(ctx context.Context, registrationID string, userID int32) error {
	if strings.TrimSpace(registrationID) == "" {
		return domain.ErrLegalConsentRequired
	}
	return s.repo.BindRegistration(ctx, registrationID, userID)
}

func (s *Service) AcceptDissemination(ctx context.Context, userID int32, request RequestContext) error {
	if err := validateRequestContext(request); err != nil {
		return err
	}
	consent := consentFromRequest(&userID, s.documents[domain.LegalDocumentDataDissemination], s.now().UTC(), request)
	return s.repo.AcceptForUser(ctx, consent)
}

func (s *Service) RequireDissemination(ctx context.Context, userID int32) error {
	ok, err := s.repo.HasActive(ctx, userID, s.documents[domain.LegalDocumentDataDissemination])
	if err != nil {
		return err
	}
	if !ok {
		return domain.ErrLegalConsentRequired
	}
	return nil
}

func (s *Service) Status(ctx context.Context, userID int32) (Status, error) {
	result := Status{Documents: make([]DocumentStatus, 0, 3)}
	for _, documentType := range []string{
		domain.LegalDocumentUserAgreement,
		domain.LegalDocumentPersonalData,
		domain.LegalDocumentDataDissemination,
	} {
		document := s.documents[documentType]
		accepted, err := s.repo.HasActive(ctx, userID, document)
		if err != nil {
			return Status{}, err
		}
		result.Documents = append(result.Documents, DocumentStatus{Document: document, Accepted: accepted})
	}
	visible, err := s.repo.PublicProfileVisible(ctx, userID)
	if err != nil {
		return Status{}, err
	}
	result.PublicProfileVisible = visible
	return result, nil
}

func (s *Service) PublicProfileVisible(ctx context.Context, userID int32) (bool, error) {
	return s.repo.PublicProfileVisible(ctx, userID)
}

func (s *Service) RevokeDissemination(ctx context.Context, userID int32, reason string) error {
	return s.repo.Revoke(ctx, userID, domain.LegalDocumentDataDissemination, strings.TrimSpace(reason), s.now().UTC())
}

func validateRequestContext(request RequestContext) error {
	registrationID := strings.TrimSpace(request.RegistrationID)
	if registrationID == "" || len(registrationID) > 128 || len(strings.TrimSpace(request.AppVersion)) > 64 {
		return domain.ErrLegalConsentRequired
	}
	if request.Source != domain.LegalConsentSourceWeb && request.Source != domain.LegalConsentSourceAndroid {
		return domain.ErrLegalConsentRequired
	}
	return nil
}

func consentFromRequest(userID *int32, document domain.LegalDocument, acceptedAt time.Time, request RequestContext) domain.LegalConsent {
	return domain.LegalConsent{
		UserID: userID, RegistrationID: request.RegistrationID, Document: document,
		AcceptedAt: acceptedAt, IPAddress: pointer(request.IPAddress), UserAgent: pointer(request.UserAgent),
		AppVersion: pointer(request.AppVersion), Source: request.Source,
	}
}

func pointer(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}
