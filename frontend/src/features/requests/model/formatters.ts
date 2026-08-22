import type { RentalRequest } from './types';

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export function parseRequestDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function getRequestNights(request: RentalRequest): number {
  const duration = parseRequestDate(request.endDate).getTime() - parseRequestDate(request.startDate).getTime();
  return Math.max(1, Math.round(duration / 86_400_000));
}

export function formatRequestDateRange(request: RentalRequest): string {
  const start = parseRequestDate(request.startDate);
  const end = parseRequestDate(request.endDate);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}–${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')}`;
  }
  return `${start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')} — ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')}`;
}

export function formatRequestLongDateRange(request: RentalRequest): string {
  const start = parseRequestDate(request.startDate);
  const end = parseRequestDate(request.endDate);
  return `${start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

export function formatRequestCreatedAt(value: string, long = false): string {
  const date = new Date(value);
  return date.toLocaleDateString('ru-RU', long
    ? { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
}

function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}

export function formatGuestsCount(count: number): string {
  return pluralize(count, 'гость', 'гостя', 'гостей');
}

export function formatNightsCount(count: number): string {
  return pluralize(count, 'ночь', 'ночи', 'ночей');
}

export function getCompactPersonName(request: RentalRequest): string {
  const person = request.direction === 'incoming' ? request.guest : request.listing.owner;
  return person.surname ? `${person.surname} ${person.name.slice(0, 1)}.` : person.name;
}

export function getFullPersonName(request: RentalRequest): string {
  const person = request.direction === 'incoming' ? request.guest : request.listing.owner;
  return [person.surname, person.name, person.patronymic].filter(Boolean).join(' ');
}
