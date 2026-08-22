export const TOTAL_CREATE_LISTING_STEPS = 6;
export const CREATE_LISTING_STEP_TITLES = ['Тип жилья', 'Адрес', 'Параметры', 'Описание', 'Фотографии', 'Публикация'] as const;

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatTimeInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export function formatListingPrice(value: string): string {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `${number.toLocaleString('ru-RU')} ₽` : 'Цена не указана';
}

export function getListingDraftTitle(rooms: string): string {
  if (rooms === 'studio') return 'Студия';
  if (rooms === '5') return 'Жильё с 5+ комнатами';
  return rooms ? `${rooms}-комнатное жильё` : 'Ваше объявление';
}

export function getCreateListingStepDescription(step: number): string {
  return [
    'Выберите категорию и количество комнат.',
    'Укажите адрес и проверьте метку.',
    'Добавьте цену, площадь и удобства.',
    'Опишите объект и правила проживания.',
    'Загрузите и упорядочьте фотографии.',
    'Проверьте карточку перед публикацией.',
  ][step] ?? '';
}
