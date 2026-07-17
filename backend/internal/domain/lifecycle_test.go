package domain

import "testing"

func TestBookingTransitionAllowed(t *testing.T) {
	tests := []struct {
		name  string
		from  string
		to    string
		actor BookingTransitionActor
		want  bool
	}{
		{"guest cancels pending", BookingPending, BookingCancelled, BookingActorGuest, true},
		{"guest cancels verification", BookingPendingVerification, BookingCancelled, BookingActorGuest, true},
		{"host confirms pending", BookingPending, BookingConfirmed, BookingActorHost, true},
		{"host rejects legacy pending", BookingLegacyPending, BookingCancelled, BookingActorHost, true},
		{"system verifies guest", BookingPendingVerification, BookingPending, BookingActorSystem, true},
		{"guest cannot cancel confirmed", BookingConfirmed, BookingCancelled, BookingActorGuest, false},
		{"host cannot revive cancelled", BookingCancelled, BookingConfirmed, BookingActorHost, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := BookingTransitionAllowed(tt.from, tt.to, tt.actor); got != tt.want {
				t.Fatalf("BookingTransitionAllowed(%q, %q, %q) = %v, want %v", tt.from, tt.to, tt.actor, got, tt.want)
			}
		})
	}
}

func TestListingOwnerTransitions(t *testing.T) {
	if !ListingTransitionAllowed(HouseStatusActive, HouseStatusUnpublished, ListingActorOwner) {
		t.Fatal("owner must be able to unpublish an active listing")
	}
	if !ListingTransitionAllowed(HouseStatusUnpublished, HouseStatusActive, ListingActorOwner) {
		t.Fatal("owner must be able to republish a withdrawn listing")
	}
	if ListingTransitionAllowed(HouseStatusRejected, HouseStatusActive, ListingActorOwner) {
		t.Fatal("owner must not bypass moderation for a rejected listing")
	}
	if !ListingTransitionAllowed(HouseStatusUnpublished, HouseStatusPendingModeration, ListingActorModeration) {
		t.Fatal("edited unpublished listing must be able to re-enter moderation")
	}
	if ListingPromotable(HouseStatusRejected) || ListingPromotable(HouseStatusUnpublished) {
		t.Fatal("rejected and unpublished listings must not be promotable")
	}
}
