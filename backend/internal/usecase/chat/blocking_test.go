package chat

import (
	"context"
	"errors"
	"testing"

	"github.com/TrollLOLik/sutki/backend/internal/domain"
)

type blockingChatRepo struct {
	domain.ChatRepository
	participant        bool
	otherUserID        int32
	canContactCalls    int
	createMessageCalls int
	suggestionCalls    int
}

func (r *blockingChatRepo) CheckParticipantExists(context.Context, int64, int32) (bool, error) {
	return r.participant, nil
}

func (r *blockingChatRepo) GetOtherParticipantID(context.Context, int64, int32) (int32, error) {
	return r.otherUserID, nil
}

func (r *blockingChatRepo) CanContact(context.Context, *int32, int32, int32) (bool, error) {
	r.canContactCalls++
	return true, nil
}

func (r *blockingChatRepo) CreateMessage(context.Context, int64, int32, *string, *int64, []domain.MessageAttachment) (domain.Message, error) {
	r.createMessageCalls++
	return domain.Message{}, nil
}

func (r *blockingChatRepo) GetSuggestionContext(context.Context, int64, int32) (domain.SuggestionContext, error) {
	r.suggestionCalls++
	return domain.SuggestionContext{}, nil
}

type blockingChecker struct {
	state      domain.UserBlockState
	checkCalls int
	stateCalls int
	lastFirst  int32
	lastSecond int32
}

func (c *blockingChecker) IsBlockedBetween(_ context.Context, firstUserID, secondUserID int32) (bool, error) {
	c.checkCalls++
	c.lastFirst = firstUserID
	c.lastSecond = secondUserID
	return c.state.Blocked, nil
}

func (c *blockingChecker) BlockState(_ context.Context, viewerUserID, otherUserID int32) (domain.UserBlockState, error) {
	c.stateCalls++
	c.lastFirst = viewerUserID
	c.lastSecond = otherUserID
	return c.state, nil
}

func TestBlockedPairCannotOpenConversation(t *testing.T) {
	repo := &blockingChatRepo{}
	checker := &blockingChecker{state: domain.UserBlockState{Blocked: true, BlockedByMe: true}}
	svc := New(repo, nil, Config{BlockChecker: checker})

	_, err := svc.FindOrCreateConversation(context.Background(), nil, 11, 22)
	if !errors.Is(err, domain.ErrUserInteractionBlocked) {
		t.Fatalf("FindOrCreateConversation() error = %v, want ErrUserInteractionBlocked", err)
	}
	if repo.canContactCalls != 0 {
		t.Fatal("contact relationship was queried after the pair block was found")
	}
}

func TestBlockedPairCannotCreateUserActivityInExistingConversation(t *testing.T) {
	operations := []struct {
		name string
		run  func(*Service) error
	}{
		{
			name: "message",
			run: func(s *Service) error {
				body := "Здравствуйте"
				_, err := s.SendMessage(context.Background(), 11, 7, &body, nil, nil)
				return err
			},
		},
		{name: "typing", run: func(s *Service) error {
			return s.PublishTyping(context.Background(), 11, 7, true)
		}},
		{name: "suggestions", run: func(s *Service) error {
			_, err := s.Suggestions(context.Background(), 11, 7)
			return err
		}},
	}

	for _, operation := range operations {
		t.Run(operation.name, func(t *testing.T) {
			repo := &blockingChatRepo{participant: true, otherUserID: 22}
			checker := &blockingChecker{state: domain.UserBlockState{Blocked: true}}
			svc := New(repo, nil, Config{BlockChecker: checker})

			if err := operation.run(svc); !errors.Is(err, domain.ErrUserInteractionBlocked) {
				t.Fatalf("operation error = %v, want ErrUserInteractionBlocked", err)
			}
			if repo.createMessageCalls != 0 || repo.suggestionCalls != 0 {
				t.Fatalf("work continued after block: messages=%d suggestions=%d", repo.createMessageCalls, repo.suggestionCalls)
			}
		})
	}
}

func TestConversationBlockStateIsDirectional(t *testing.T) {
	repo := &blockingChatRepo{participant: true, otherUserID: 22}
	want := domain.UserBlockState{Blocked: true, BlockedByMe: true}
	checker := &blockingChecker{state: want}
	svc := New(repo, nil, Config{BlockChecker: checker})

	got, err := svc.ConversationBlockState(context.Background(), 11, 7)
	if err != nil {
		t.Fatalf("ConversationBlockState() error = %v", err)
	}
	if got != want {
		t.Fatalf("ConversationBlockState() = %+v, want %+v", got, want)
	}
	if checker.lastFirst != 11 || checker.lastSecond != 22 {
		t.Fatalf("block lookup pair = %d/%d, want 11/22", checker.lastFirst, checker.lastSecond)
	}
}
