export type BookingErrors = Partial<Record<'dates' | 'name' | 'phone', string>>;

export type PhoneCountry = 'RU' | 'KZ' | 'BY' | 'AM' | 'KG';

export const phoneCountries: ReadonlyArray<{ code: PhoneCountry; flag: string; dialCode: string; label: string; placeholder: string }> = [
  { code: 'RU', flag: '🇷🇺', dialCode: '+7', label: 'Россия', placeholder: '+7 (999) 000-00-00' },
  { code: 'KZ', flag: '🇰🇿', dialCode: '+7', label: 'Казахстан', placeholder: '+7 (700) 000-00-00' },
  { code: 'BY', flag: '🇧🇾', dialCode: '+375', label: 'Беларусь', placeholder: '+375 (29) 000-00-00' },
  { code: 'AM', flag: '🇦🇲', dialCode: '+374', label: 'Армения', placeholder: '+374 (99) 000-000' },
  { code: 'KG', flag: '🇰🇬', dialCode: '+996', label: 'Кыргызстан', placeholder: '+996 (555) 000-000' },
];

const phoneFormats: Record<PhoneCountry, { dialDigits: string; nationalLength: number; groups: number[] }> = {
  RU: { dialDigits: '7', nationalLength: 10, groups: [3, 3, 2, 2] },
  KZ: { dialDigits: '7', nationalLength: 10, groups: [3, 3, 2, 2] },
  BY: { dialDigits: '375', nationalLength: 9, groups: [2, 3, 2, 2] },
  AM: { dialDigits: '374', nationalLength: 8, groups: [2, 3, 3] },
  KG: { dialDigits: '996', nationalLength: 9, groups: [3, 3, 3] },
};

export function formatRubles(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export function isoToday(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000));
}

export function formatBookingDate(value: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`));
}

export function nightsLabel(nights: number): string {
  const lastTwo = nights % 100;
  const last = nights % 10;
  if (last === 1 && lastTwo !== 11) return `${nights} ночь`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${nights} ночи`;
  return `${nights} ночей`;
}

export function guestsLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return `${count} гость`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} гостя`;
  return `${count} гостей`;
}

export function maskPhone(value: string, country: PhoneCountry = 'RU'): string {
  const format = phoneFormats[country];
  let digits = value.replace(/\D/g, '');
  if (value.trimStart().startsWith('+') && digits.startsWith(format.dialDigits)) digits = digits.slice(format.dialDigits.length);
  if ((country === 'RU' || country === 'KZ') && digits.startsWith('8') && digits.length > format.nationalLength) digits = digits.slice(1);
  if (digits.startsWith(format.dialDigits) && digits.length > format.nationalLength) digits = digits.slice(format.dialDigits.length);
  digits = digits.slice(0, format.nationalLength);

  let result = `+${format.dialDigits}`;
  let offset = 0;
  format.groups.forEach((groupLength, index) => {
    const group = digits.slice(offset, offset + groupLength);
    if (!group) return;
    if (index === 0) result += ` (${group}`;
    else if (index === 1) result += `${digits.length >= format.groups[0] ? ') ' : ''}${group}`;
    else result += `-${group}`;
    offset += groupLength;
  });
  return result;
}

export function isPhoneComplete(value: string, country: PhoneCountry): boolean {
  const format = phoneFormats[country];
  const digits = value.replace(/\D/g, '');
  return digits.startsWith(format.dialDigits) && digits.length === format.dialDigits.length + format.nationalLength;
}

