import type { RentalRequest, RequestSort } from './types';

export function filterAndSortRequests(items: RentalRequest[], query: string, sort: RequestSort): RentalRequest[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  return items.filter((request) => {
    const person = request.direction === 'incoming' ? request.guest : request.listing.owner;
    const haystack = [
      person.name,
      person.surname,
      person.phone,
      request.listing.address,
      request.listing.city,
      request.listing.title,
    ].join(' ').toLocaleLowerCase('ru');
    return !needle || haystack.includes(needle);
  }).sort((a, b) => {
    if (sort === 'oldest') return Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id;
    if (sort === 'checkin_asc') return Date.parse(a.startDate) - Date.parse(b.startDate) || b.id - a.id;
    if (sort === 'checkin_desc') return Date.parse(b.startDate) - Date.parse(a.startDate) || b.id - a.id;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id;
  });
}
