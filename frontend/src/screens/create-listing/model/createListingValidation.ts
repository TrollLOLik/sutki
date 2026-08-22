import type { CreateListingDraft, ValidationError } from './createListingDraft';

export type CreateListingValidatedStep = 0 | 1 | 2 | 3;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function validateCreateListingStep(
  draft: Readonly<CreateListingDraft>,
  step: CreateListingValidatedStep,
): ValidationError | null {
  if (step === 0) {
    if (draft.categoryIds.length === 0 && !draft.category) return { message: 'Выберите тип жилья', anchor: 'create-category' };
    if (!draft.rooms) return { message: 'Укажите количество комнат', anchor: 'create-rooms' };
    return null;
  }

  if (step === 1) {
    if (draft.city.trim().length < 2) return { message: 'Укажите город', anchor: 'create-city' };
    if (draft.street.trim().length < 2) return { message: 'Укажите улицу', anchor: 'create-street' };
    if (draft.houseNumber.trim().length < 1) return { message: 'Укажите номер дома', anchor: 'create-house' };
    return null;
  }

  if (step === 2) {
    const area = Number(draft.area);
    const price = Number(draft.price);
    const guests = Number(draft.maxGuests);

    if (!Number.isFinite(area) || area < 5 || area > 10_000) {
      return { message: 'Площадь должна быть от 5 до 10 000 м²', anchor: 'create-area' };
    }
    if (!Number.isFinite(price) || price < 150 || price > 100_000_000) {
      return { message: 'Цена должна быть от 150 ₽ за ночь', anchor: 'create-price' };
    }
    if (draft.maxGuests !== '' && (!Number.isFinite(guests) || guests < 1 || guests > 100)) {
      return { message: 'Укажите количество гостей от 1 до 100', anchor: 'create-guests' };
    }
    return null;
  }

  if (draft.description.trim().length < 10) {
    return { message: 'Добавьте описание (минимум 10 символов)', anchor: 'create-description' };
  }
  if (draft.checkInAfter && !timePattern.test(draft.checkInAfter)) return { message: 'Время заезда должно быть в формате ЧЧ:ММ (например, 14:00)', anchor: 'create-checkin' };
  if (draft.checkOutBefore && !timePattern.test(draft.checkOutBefore)) return { message: 'Время выезда должно быть в формате ЧЧ:ММ (например, 12:00)', anchor: 'create-checkout' };
  return null;
}

export function findFirstCreateListingError(draft: Readonly<CreateListingDraft>): {
  step: CreateListingValidatedStep;
  error: ValidationError;
} | null {
  for (const step of [0, 1, 2, 3] as const) {
    const error = validateCreateListingStep(draft, step);
    if (error) return { step, error };
  }
  return null;
}
