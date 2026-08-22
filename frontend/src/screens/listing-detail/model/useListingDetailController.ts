import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import type { Listing } from '@shared/data/listings';
import { useChatSnapshot } from '@features/chat';
import type { OwnerListingStatus } from '@features/my-listings';
import type { BookingDraft } from './listingDetailTypes';
import { buildListingFeatures, buildListingRules, formatListingPrice, getListingDetailTitle, listingPhotoSet } from './listingDetailView';

interface ListingDetailControllerOptions {
  listing: Listing;
  allListings: readonly Listing[];
  ownerStatus?: OwnerListingStatus;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onToast: (message: string) => void;
}

export function useListingDetailController({ listing, allListings, ownerStatus, onPublish, onUnpublish, onToast }: ListingDetailControllerOptions) {
  const [activePhoto, setActivePhoto] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [publicationConfirmation, setPublicationConfirmation] = useState<'publish' | 'unpublish' | null>(null);
  const [descriptionHeight, setDescriptionHeight] = useState(60);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [guestSheetOpen, setGuestSheetOpen] = useState(false);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>({ checkIn: null, checkOut: null, guests: 1 });
  const [headerProgress, setHeaderProgress] = useState(0);
  const mobileGalleryRef = useRef<HTMLDivElement>(null);
  const lightboxSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const { conversations } = useChatSnapshot();

  const photos = useMemo(() => {
    if (listing.photos?.length) return listing.photos;
    const first = listing.coverUrl;
    return [first, ...listingPhotoSet.filter((item) => item !== first)].slice(0, 5);
  }, [listing.coverUrl, listing.photos]);
  const features = useMemo(() => buildListingFeatures(listing), [listing]);
  const rules = useMemo(() => buildListingRules(listing), [listing]);
  const similar = useMemo(() => allListings.filter((item) => item.id !== listing.id && item.cityName === listing.cityName).slice(0, 3), [allListings, listing.cityName, listing.id]);
  const owner = useMemo(() => listing.owner ?? conversations.find((conversation) => conversation.listing?.id === listing.id && !conversation.isOwner)?.otherUser ?? conversations.find((conversation) => conversation.listing?.id === listing.id)?.otherUser, [conversations, listing]);
  const ownerName = owner ? `${owner.surname} ${owner.name}`.trim() : 'Арендодатель';
  const ownerRating = owner?.rating ?? 0;
  const ownerReviews = owner?.reviewsCount ?? 0;
  const ownerCanPromote = !ownerStatus || ownerStatus === 'active';
  const ownerCanUnpublish = ownerStatus === 'active';
  const ownerCanPublish = ownerStatus === 'unpublished';

  const confirmPublicationChange = () => {
    if (publicationConfirmation === 'publish') onPublish?.();
    if (publicationConfirmation === 'unpublish') onUnpublish?.();
    setPublicationConfirmation(null);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setActivePhoto(0);
    setDescriptionExpanded(false);
    setLocationOpen(false);
  }, [listing.id]);
  useEffect(() => {
    const measureDescription = () => setDescriptionHeight(descriptionRef.current?.scrollHeight ?? 60);
    measureDescription();
    window.addEventListener('resize', measureDescription);
    return () => window.removeEventListener('resize', measureDescription);
  }, [listing.id]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (document.documentElement.dataset.scrollLocked) return;
        const bottom = titleRef.current?.getBoundingClientRect().bottom ?? 300;
        setHeaderProgress(Math.max(0, Math.min(1, (108 - bottom) / 48)));
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); };
  }, []);
  useEffect(() => {
    if (!galleryOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setActivePhoto((value) => (value - 1 + photos.length) % photos.length);
      if (event.key === 'ArrowRight') setActivePhoto((value) => (value + 1) % photos.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [galleryOpen, photos.length]);

  const openGallery = (index: number) => { setActivePhoto(index); setGalleryOpen(true); };
  const closeGallery = () => setGalleryOpen(false);
  const handleLightboxTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) { lightboxSwipeStartRef.current = null; return; }
    const touch = event.touches[0];
    lightboxSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleLightboxTouchMove = (event: TouchEvent<HTMLElement>) => {
    const start = lightboxSwipeStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY) && event.cancelable) event.preventDefault();
  };
  const handleLightboxTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = lightboxSwipeStartRef.current;
    lightboxSwipeStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
    setActivePhoto((value) => deltaX < 0 ? (value + 1) % photos.length : (value - 1 + photos.length) % photos.length);
  };
  const cancelLightboxTouch = () => { lightboxSwipeStartRef.current = null; };
  const share = async () => {
    const payload = { title: getListingDetailTitle(listing), text: `${getListingDetailTitle(listing)} — ${formatListingPrice(listing.price)} ₽ за сутки`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(payload);
      else { await navigator.clipboard.writeText(window.location.href); onToast('Ссылка скопирована'); }
    } catch {
      // The user may close the system share dialog.
    }
  };
  const scrollMobileGallery = (direction: number) => {
    const track = mobileGalleryRef.current;
    if (!track) return;
    const next = (activePhoto + direction + photos.length) % photos.length;
    track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' });
    setActivePhoto(next);
  };
  const handleMobileGalleryScroll = () => {
    const track = mobileGalleryRef.current;
    if (!track || track.clientWidth === 0) return;
    setActivePhoto(Math.round(track.scrollLeft / track.clientWidth));
  };
  const toggleDescription = () => {
    setDescriptionHeight(descriptionRef.current?.scrollHeight ?? 60);
    setDescriptionExpanded((value) => !value);
  };
  const applyDates = (checkIn: string | null, checkOut: string | null) => {
    setBookingDraft((current) => ({ ...current, checkIn, checkOut }));
    setDateSheetOpen(false);
  };
  const applyGuests = (guests: number) => {
    setBookingDraft((current) => ({ ...current, guests }));
    setGuestSheetOpen(false);
  };

  return { activePhoto, setActivePhoto, descriptionExpanded, publicationConfirmation, setPublicationConfirmation, descriptionHeight, galleryOpen, locationOpen, setLocationOpen, dateSheetOpen, setDateSheetOpen, guestSheetOpen, setGuestSheetOpen, bookingDraft, headerProgress, mobileGalleryRef, descriptionRef, titleRef, photos, features, rules, similar, owner, ownerName, ownerRating, ownerReviews, ownerCanPromote, ownerCanUnpublish, ownerCanPublish, confirmPublicationChange, openGallery, closeGallery, handleLightboxTouchStart, handleLightboxTouchMove, handleLightboxTouchEnd, cancelLightboxTouch, share, scrollMobileGallery, handleMobileGalleryScroll, toggleDescription, applyDates, applyGuests };
}
