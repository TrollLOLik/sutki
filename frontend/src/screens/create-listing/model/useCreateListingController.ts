import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { myListingsRepository } from '@features/my-listings';
import { scrollToValidationAnchor } from '@shared/lib/forms/scrollToValidationError';
import {
  clearCreateListingDraft,
  clearCreateListingTransientDraft,
  createEmptyListingDraft,
  loadCreateListingDraft,
  loadCreateListingTransientDraft,
  saveCreateListingDraft,
  saveCreateListingTransientDraft,
  type CreateListingDraft,
  type ListingPhoto,
  type RuleValue,
  type ValidationError,
} from './createListingDraft';
import { findFirstCreateListingError, validateCreateListingStep, type CreateListingValidatedStep } from './createListingValidation';
import { TOTAL_CREATE_LISTING_STEPS } from './createListingView';
import { AMENITIES, CATEGORY_OPTIONS } from '../ui/createListingOptions';

interface CreateListingControllerOptions {
  editId?: number;
  onClose: () => void;
  onPublished: (message: string) => void;
}

export function useCreateListingController({ editId, onClose, onPublished }: CreateListingControllerOptions) {
  const editingOwnerListing = editId ? myListingsRepository.getSnapshot().find((item) => item.listing.id === editId) : undefined;
  const editingListing = editingOwnerListing?.listing;
  const transientDraft = loadCreateListingTransientDraft();
  const [step, setStep] = useState(0);
  const [maxVisitedStep, setMaxVisitedStep] = useState(0);
  const [draft, setDraft] = useState<CreateListingDraft>(() => editingListing ? {
    ...createEmptyListingDraft(),
    category: editingListing.categoryId,
    categoryIds: [editingListing.categoryId],
    rooms: String(editingListing.rooms),
    city: editingListing.cityName,
    street: editingListing.address.split(',')[0]?.trim() ?? '',
    houseNumber: editingListing.address.split(',')[1]?.trim() ?? '',
    area: String(editingListing.area),
    price: String(editingListing.price),
    maxGuests: String(editingListing.capacity),
    amenities: [...editingListing.serviceIds],
    description: editingListing.title,
    smoking: editingListing.smokingAllowed ? 'allowed' : 'forbidden',
    pets: editingListing.petsAllowed ? 'allowed' : 'forbidden',
    children: editingListing.childrenAllowed ? 'allowed' : 'forbidden',
    events: editingListing.eventsAllowed ? 'allowed' : 'forbidden',
  } : loadCreateListingDraft());
  const draftRef = useRef<CreateListingDraft>(draft);
  const shouldPersistDraftRef = useRef(true);
  const [photos, setPhotos] = useState<ListingPhoto[]>(() => editingListing
    ? editingOwnerListing?.photos?.length ? editingOwnerListing.photos : [{ id: `listing-${editingListing.id}`, url: editingListing.coverUrl, name: 'Обложка объявления' }]
    : transientDraft.photos);
  const [error, setError] = useState<ValidationError | null>(null);
  const [saved, setSaved] = useState(true);
  const [published, setPublished] = useState(false);
  const [publishedListingId, setPublishedListingId] = useState<number | null>(null);
  const [cityFocused, setCityFocused] = useState(false);
  const [streetFocused, setStreetFocused] = useState(false);
  const [houseFocused, setHouseFocused] = useState(false);
  const [mapFound, setMapFound] = useState(false);
  const [mapPoint, setMapPoint] = useState(editingOwnerListing?.mapPoint ?? transientDraft.mapPoint);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => { document.title = 'Новое объявление — ВИГАЖ'; }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const syncKeyboardOffset = () => {
      const next = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset(next > 100 ? next : 0);
    };
    viewport.addEventListener('resize', syncKeyboardOffset);
    viewport.addEventListener('scroll', syncKeyboardOffset);
    syncKeyboardOffset();
    return () => { viewport.removeEventListener('resize', syncKeyboardOffset); viewport.removeEventListener('scroll', syncKeyboardOffset); };
  }, []);
  useEffect(() => {
    draftRef.current = draft;
    setSaved(false);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      if (!editId && shouldPersistDraftRef.current) saveCreateListingDraft(draftRef.current);
      setSaved(true);
      saveTimerRef.current = null;
    }, 420);
    return () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); };
  }, [draft, editId]);
  useEffect(() => {
    if (!editId && shouldPersistDraftRef.current) saveCreateListingTransientDraft({ photos, mapPoint });
  }, [editId, mapPoint, photos]);

  const saveDraftNow = useCallback(() => {
    if (saveTimerRef.current) { window.clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    if (!editId && shouldPersistDraftRef.current) saveCreateListingDraft(draftRef.current);
    setSaved(true);
  }, [editId]);
  const closeDraft = useCallback(() => { saveDraftNow(); onClose(); }, [onClose, saveDraftNow]);

  useEffect(() => {
    const persistLatestDraft = () => { if (!editId && shouldPersistDraftRef.current) saveCreateListingDraft(draftRef.current); };
    window.addEventListener('beforeunload', persistLatestDraft);
    window.addEventListener('pagehide', persistLatestDraft);
    window.addEventListener('popstate', persistLatestDraft);
    return () => {
      window.removeEventListener('beforeunload', persistLatestDraft);
      window.removeEventListener('pagehide', persistLatestDraft);
      window.removeEventListener('popstate', persistLatestDraft);
      persistLatestDraft();
    };
  }, [editId]);

  const category = CATEGORY_OPTIONS.find((item) => item.value === (draft.categoryIds[0] ?? draft.category));
  const selectedAmenityNames = useMemo(() => AMENITIES.filter((item) => draft.amenities.includes(item.id)).map((item) => item.label), [draft.amenities]);

  const update = <K extends keyof CreateListingDraft>(key: K, value: CreateListingDraft[K]) => {
    shouldPersistDraftRef.current = true;
    setDraft((current) => {
      const next = { ...current, [key]: value };
      draftRef.current = next;
      return next;
    });
    if (error) setError(null);
  };
  const showError = (nextError: ValidationError, targetStep = step) => {
    setError(nextError);
    if (targetStep !== step) setStep(targetStep);
    scrollToValidationAnchor(nextError.anchor);
  };
  const goNext = () => {
    const validation = step <= 3 ? validateCreateListingStep(draft, step as CreateListingValidatedStep) : null;
    if (validation) { showError(validation); return; }
    if (step === 4 && photos.some((photo) => photo.status === 'checking')) { showError({ message: 'Пожалуйста, дождитесь окончания загрузки всех фотографий.', anchor: 'create-photos' }); return; }
    if (step === 4 && photos.some((photo) => photo.status === 'error')) { showError({ message: 'Некоторые фотографии не удалось загрузить. Попробуйте ещё раз или удалите их.', anchor: 'create-photos' }); return; }
    const next = Math.min(TOTAL_CREATE_LISTING_STEPS - 1, step + 1);
    setStep(next);
    setMaxVisitedStep((current) => Math.max(current, next));
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goBack = () => {
    if (step === 0) { closeDraft(); return; }
    setStep((current) => current - 1);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const jumpToStep = (target: number) => {
    if (target > maxVisitedStep) return;
    setStep(target);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const toggleAmenity = (id: string) => update('amenities', draft.amenities.includes(id) ? draft.amenities.filter((item) => item !== id) : [...draft.amenities, id]);
  const toggleCategory = (value: string) => {
    const next = draft.categoryIds.includes(value) ? draft.categoryIds.filter((item) => item !== value) : [...draft.categoryIds, value];
    shouldPersistDraftRef.current = true;
    setDraft((current) => {
      const updated = { ...current, categoryIds: next, category: next[0] ?? '' };
      draftRef.current = updated;
      return updated;
    });
    if (error) setError(null);
  };
  const selectRule = (key: 'smoking' | 'pets' | 'children' | 'events', value: RuleValue) => update(key, draft[key] === value ? '' : value);
  const handlePhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const selected = (Array.from(event.target.files ?? []) as File[]).filter((file) => allowedTypes.has(file.type) && file.size <= 10 * 1024 * 1024).slice(0, Math.max(0, 10 - photos.length));
    if (!selected.length) return;
    const next = selected.map((file) => ({ id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, url: URL.createObjectURL(file), name: file.name, status: 'checking' as const }));
    setPhotos((current) => [...current, ...next].slice(0, 10));
    event.target.value = '';
    window.setTimeout(() => setPhotos((current) => current.map((photo) => next.some((item) => item.id === photo.id) ? { ...photo, status: 'ready' } : photo)), 650);
  };
  const improveDescription = () => {
    const rooms = draft.rooms === 'studio' ? 'студия' : `${draft.rooms || '2'}-комнатное жильё`;
    const features = selectedAmenityNames.slice(0, 4);
    const generated = [
      `Уютное ${rooms} в городе ${draft.city || 'Челябинск'}, ${draft.street ? `улица ${draft.street}` : 'в удобном районе'}.`,
      `Жильё площадью ${draft.area || '—'} м² подойдёт для компании до ${draft.maxGuests || '—'} гостей.`,
      features.length ? `В жилье есть: ${features.join(', ')}.` : '',
      `Заезд после ${draft.checkInAfter || '14:00'}, выезд до ${draft.checkOutBefore || '12:00'}.`,
    ].filter(Boolean).join('\n\n');
    update('description', generated.slice(0, 1500));
  };
  const transformDescription = (mode: 'short' | 'detail' | 'friendly') => {
    if (mode === 'short') return update('description', draft.description.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').slice(0, 1500));
    if (mode === 'friendly') return update('description', `${draft.description.trim()}\n\nБудем рады принять вас и ответить на вопросы перед заселением!`.trim().slice(0, 1500));
    update('description', `${draft.description.trim()}\n\nРядом находятся магазины, транспорт и всё необходимое для комфортного проживания.`.trim().slice(0, 1500));
  };
  const removePhoto = (id: string) => setPhotos((current) => {
    const target = current.find((photo) => photo.id === id);
    if (target) URL.revokeObjectURL(target.url);
    return current.filter((photo) => photo.id !== id);
  });
  const movePhoto = (index: number, direction: -1 | 1) => setPhotos((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const makeCover = (id: string) => setPhotos((current) => {
    const index = current.findIndex((photo) => photo.id === id);
    if (index <= 0) return current;
    const next = [...current];
    const [photo] = next.splice(index, 1);
    next.unshift(photo);
    return next;
  });
  const resetDraft = () => {
    shouldPersistDraftRef.current = false;
    const emptyDraft = createEmptyListingDraft();
    draftRef.current = emptyDraft;
    setDraft(emptyDraft);
    setPhotos([]);
    setStep(0);
    setMaxVisitedStep(0);
    setError(null);
    setPublished(false);
    clearCreateListingDraft();
    clearCreateListingTransientDraft();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const publish = () => {
    if (photos.some((photo) => photo.status === 'checking')) { showError({ message: 'Пожалуйста, дождитесь окончания загрузки всех фотографий.', anchor: 'create-photos' }, 4); return; }
    if (photos.some((photo) => photo.status === 'error')) { showError({ message: 'Некоторые фотографии не удалось загрузить. Попробуйте ещё раз или удалите их.', anchor: 'create-photos' }, 4); return; }
    const validation = findFirstCreateListingError(draft);
    if (validation) { showError(validation.error, validation.step); return; }
    const publishedId = editId ?? Date.now();
    myListingsRepository.upsertPublished({ id: publishedId, ...draft, photos: photos.map((photo) => ({ name: photo.name, url: photo.url })), coverUrl: photos[0]?.url, mapPoint, createdAt: new Date().toISOString(), status: 'pending_moderation' });
    shouldPersistDraftRef.current = false;
    clearCreateListingDraft();
    clearCreateListingTransientDraft();
    setPublishedListingId(publishedId);
    setPublished(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (editId) onPublished('Изменения сохранены');
  };

  return {
    step,
    maxVisitedStep,
    draft,
    photos,
    error,
    saved,
    published,
    publishedListingId,
    cityFocused,
    setCityFocused,
    streetFocused,
    setStreetFocused,
    houseFocused,
    setHouseFocused,
    mapFound,
    setMapFound,
    mapPoint,
    setMapPoint,
    keyboardOffset,
    fileInputRef,
    category,
    selectedAmenityNames,
    update,
    goNext,
    goBack,
    jumpToStep,
    toggleAmenity,
    toggleCategory,
    selectRule,
    handlePhotos,
    improveDescription,
    transformDescription,
    removePhoto,
    movePhoto,
    makeCover,
    resetDraft,
    publish,
  };
}

export type CreateListingController = ReturnType<typeof useCreateListingController>;
