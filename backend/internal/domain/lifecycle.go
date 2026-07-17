package domain

// BookingTransitionActor identifies who is allowed to move a booking between
// lifecycle states. Authorization is checked before this state-machine rule.
type BookingTransitionActor string

const (
	BookingActorGuest  BookingTransitionActor = "guest"
	BookingActorHost   BookingTransitionActor = "host"
	BookingActorSystem BookingTransitionActor = "system"
)

// BookingTransitionAllowed is the canonical request lifecycle:
//
//	pending_verification --system--> in_progress
//	pending_verification --guest-->  cancelled
//	in_progress          --host-->   confirmed | cancelled
//	in_progress          --guest-->  cancelled
//
// "pending" is accepted as a legacy alias for in_progress. Confirmed and
// cancelled requests are terminal for manual actions in the current product.
func BookingTransitionAllowed(from, to string, actor BookingTransitionActor) bool {
	switch actor {
	case BookingActorGuest:
		return (from == BookingPendingVerification || isBookingPending(from)) && to == BookingCancelled
	case BookingActorHost:
		return isBookingPending(from) && (to == BookingConfirmed || to == BookingCancelled)
	case BookingActorSystem:
		return from == BookingPendingVerification && to == BookingPending
	default:
		return false
	}
}

func isBookingPending(status string) bool {
	return status == BookingPending || status == BookingLegacyPending
}

type ListingTransitionActor string

const (
	ListingActorOwner      ListingTransitionActor = "owner"
	ListingActorModeration ListingTransitionActor = "moderation"
)

// ListingTransitionAllowed is the canonical listing lifecycle. Owners can
// only withdraw an active listing and republish a listing they withdrew.
// Editing changed content, including on an unpublished or rejected listing,
// sends it through moderation again; moderation alone decides its next state.
func ListingTransitionAllowed(from, to string, actor ListingTransitionActor) bool {
	switch actor {
	case ListingActorOwner:
		return (from == HouseStatusActive && to == HouseStatusUnpublished) ||
			(from == HouseStatusUnpublished && to == HouseStatusActive)
	case ListingActorModeration:
		switch to {
		case HouseStatusActive, HouseStatusRejected, HouseStatusModerationReview, HouseStatusPendingModeration:
			return from == HouseStatusActive || from == HouseStatusUnpublished ||
				from == HouseStatusRejected || from == HouseStatusModerationReview ||
				from == HouseStatusPendingModeration
		default:
			return false
		}
	default:
		return false
	}
}

func ListingPromotable(status string) bool {
	switch status {
	case HouseStatusActive, HouseStatusPendingModeration, HouseStatusModerationReview:
		return true
	default:
		return false
	}
}
