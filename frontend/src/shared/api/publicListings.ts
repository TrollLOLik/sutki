import type { Listing, ListingOwner, ListingPOI, ListingReference } from '../data/listings';
import type { CategoryId, SearchFilters } from '../types/filters';

export type PublicListingSource = 'http' | 'session-mock';

export interface PublicRefDTO {
  id: number;
  name: string;
}

export interface PublicListingPhotoDTO {
  id: number;
  url: string;
  position: number;
}

export interface PublicListingCardDTO {
  id: number;
  owner_id: number;
  address: string;
  city: string;
  description: string;
  price: number;
  rooms: string;
  area: number;
  lat: number | null;
  lng: number | null;
  radius: number;
  qc_geo: number | null;
  max_guests: number | null;
  views: number;
  created_at: string;
  smoking_allowed?: 'allowed' | 'forbidden' | 'on_balcony' | null;
  pets_allowed?: 'allowed' | 'forbidden' | 'on_request' | null;
  children_allowed?: 'allowed' | 'forbidden' | 'on_request' | null;
  events_allowed?: 'allowed' | 'forbidden' | 'on_request' | null;
  cover_url: string;
  rating: number;
  reviews_count: number;
  promotion_types?: Array<'boost' | 'highlight'>;
  promotion_expires_at?: string | null;
}

export interface PublicListingDetailDTO extends PublicListingCardDTO {
  owner_name: string;
  owner_surname: string;
  owner_patronymic: string;
  owner_phone: string;
  owner_avatar_url: string;
  owner_rating: number;
  owner_reviews_count: number;
  owner_listings_count: number;
  owner_is_verified: boolean;
  street: string;
  house_number: string;
  number_room: string;
  photos: PublicListingPhotoDTO[];
  services: PublicRefDTO[];
  categories: PublicRefDTO[];
  check_in_after?: string | null;
  check_out_before?: string | null;
  reviews_summary?: string | null;
  location_summary?: string | null;
  pois?: ListingPOI[];
}

export interface PublicListingsPageDTO {
  items: PublicListingCardDTO[];
  total: number;
  limit: number;
  offset: number;
}

export interface PublicReferencesDTO {
  items: PublicRefDTO[];
}

export interface PublicListingReferences {
  services: Record<string, number>;
  categories: Partial<Record<CategoryId, number>>;
}

export interface PublicListingsBootstrap {
  source: PublicListingSource;
  listings: Listing[];
  listingDetail?: Listing;
  references: PublicListingReferences;
  catalogLoaded: boolean;
  error?: string;
}

export interface PublicListingListParams {
  limit?: number;
  offset?: number;
  q?: string;
  city?: string;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  rooms?: number[];
  roomsMin?: number;
  serviceIds?: number[];
  categoryId?: number;
  guests?: number;
  checkIn?: string;
  checkOut?: string;
  sort?: SearchFilters['sort'];
  smokingAllowed?: boolean;
  petsAllowed?: boolean;
  childrenAllowed?: boolean;
  eventsAllowed?: boolean;
}

const emptyReferences: PublicListingReferences = { services: {}, categories: {} };

export function createEmptyPublicListingReferences(): PublicListingReferences {
  return { services: {}, categories: {} };
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');
}

function roomCount(value: string): number {
  const roomValue = normalized(value);
  if (roomValue === 'studio' || roomValue === 'студия' || roomValue === '0') return 0;
  if (roomValue === '5+') return 5;
  const parsed = Number.parseInt(roomValue, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function serviceKey(ref: PublicRefDTO): string {
  const value = normalized(ref.name);
  if (value.includes('wi-fi') || value.includes('wifi') || value.includes('wi fi')) return 'wifi';
  if (value.includes('холодиль')) return 'fridge';
  if (value.includes('посуд')) return 'dishes';
  if (value.includes('гриль')) return 'grill';
  if (value.includes('микроволн')) return 'microwave';
  if (value.includes('телевиз') || value === 'тв' || value.startsWith('тв ')) return 'tvbox';
  if (value.includes('душ')) return 'shower';
  if (value.includes('стираль')) return 'washing';
  return `service-${ref.id}`;
}

function categoryKey(ref: PublicRefDTO, rooms: number): CategoryId {
  const value = normalized(ref.name);
  if (value.includes('коттедж') || value === 'дом') return 'cottage';
  if (value.includes('одноком')) return 'one-room';
  if (value.includes('многоком')) return 'multi-room';
  if (rooms === 1) return 'one-room';
  if (rooms > 1) return 'multi-room';
  return 'apartments';
}

function categoryLabel(category: CategoryId, rooms: number): string {
  if (category === 'cottage') return 'Дом для отдыха';
  if (rooms === 0) return 'Современная студия';
  return `Уютная ${rooms}-комн. квартира`;
}

function allowed(value: string | null | undefined): boolean {
  return value === 'allowed' || value === 'on_request' || value === 'on_balcony';
}

function mapReference(ref: PublicRefDTO, id: string): ListingReference {
  return { id, apiId: ref.id, name: ref.name };
}

function baseListing(dto: PublicListingCardDTO, detail?: Pick<PublicListingDetailDTO, 'services' | 'categories'>): Listing {
  const rooms = roomCount(dto.rooms);
  const categories = detail?.categories ?? [];
  const categoryId = categories.length > 0 ? categoryKey(categories[0], rooms) : categoryKey({ id: 0, name: '' }, rooms);
  const services = (detail?.services ?? []).map((ref) => mapReference(ref, serviceKey(ref)));
  const promoted = dto.promotion_types?.includes('highlight')
    ? 'highlight'
    : dto.promotion_types?.includes('boost') ? 'top' : undefined;

  return {
    id: dto.id,
    coverUrl: dto.cover_url || '/listings/flat-1.jpg',
    rooms,
    title: categoryLabel(categoryId, rooms),
    address: dto.address,
    city: dto.city,
    cityName: dto.city,
    area: dto.area,
    capacity: dto.max_guests ?? 1,
    views: dto.views,
    price: dto.price,
    rating: dto.rating,
    reviewsCount: dto.reviews_count,
    categoryId,
    serviceIds: services.map((service) => service.id),
    smokingAllowed: allowed(dto.smoking_allowed),
    petsAllowed: allowed(dto.pets_allowed),
    childrenAllowed: allowed(dto.children_allowed),
    eventsAllowed: allowed(dto.events_allowed),
    availableFrom: '0001-01-01',
    availableTo: '9999-12-31',
    createdAt: dto.created_at,
    promoted,
    description: dto.description,
    services,
    categories: categories.map((ref) => mapReference(ref, categoryKey(ref, rooms))),
    lat: dto.lat,
    lng: dto.lng,
    locationRadius: dto.radius,
  };
}

export function mapPublicListingCard(dto: PublicListingCardDTO): Listing {
  return baseListing(dto);
}

export function mapPublicListingDetail(dto: PublicListingDetailDTO): Listing {
  const listing = baseListing(dto, dto);
  const photos = [...(dto.photos ?? [])]
    .sort((left, right) => left.position - right.position)
    .map((photo) => photo.url)
    .filter(Boolean);
  const owner: ListingOwner = {
    id: String(dto.owner_id),
    name: dto.owner_name,
    surname: dto.owner_surname,
    phone: dto.owner_phone || undefined,
    avatarUrl: dto.owner_avatar_url || undefined,
    verified: dto.owner_is_verified,
    rating: dto.owner_rating,
    reviewsCount: dto.owner_reviews_count,
    listingsCount: dto.owner_listings_count,
    city: dto.city,
  };

  return {
    ...listing,
    coverUrl: dto.cover_url || photos[0] || '/listings/flat-1.jpg',
    photos: photos.length > 0 ? photos : [dto.cover_url || '/listings/flat-1.jpg'],
    owner,
    checkInAfter: dto.check_in_after,
    checkOutBefore: dto.check_out_before,
    locationSummary: dto.location_summary,
    reviewsSummary: dto.reviews_summary,
    pois: dto.pois ?? [],
  };
}

export function mapPublicListingReferences(services: PublicRefDTO[], categories: PublicRefDTO[]): PublicListingReferences {
  const result = createEmptyPublicListingReferences();
  services.forEach((ref) => { result.services[serviceKey(ref)] = ref.id; });
  categories.forEach((ref) => {
    const value = normalized(ref.name);
    const key = categoryKey(ref, 0);
    if (result.categories[key] == null) result.categories[key] = ref.id;
    if (value.includes('квартир') || value.includes('апартамент')) {
      result.categories.apartments ??= ref.id;
      result.categories['one-room'] ??= ref.id;
      result.categories['multi-room'] ??= ref.id;
    }
  });
  return result;
}

export function filtersToPublicListingParams(filters: SearchFilters, query: string, references: PublicListingReferences = emptyReferences): PublicListingListParams {
  const rooms = filters.rooms.flatMap((room) => {
    if (room === 'studio') return [0];
    if (room === '5plus') return [];
    return [Number(room)];
  });
  const serviceIds = filters.serviceIds.flatMap((id) => references.services[id] == null ? [] : [references.services[id]]);
  const normalizedQuery = query.trim();
  return {
    limit: 100,
    q: normalizedQuery || undefined,
    city: filters.city ?? undefined,
    priceMin: filters.priceMin ?? undefined,
    priceMax: filters.priceMax ?? undefined,
    areaMin: filters.areaMin ?? undefined,
    areaMax: filters.areaMax ?? undefined,
    rooms: rooms.length > 0 ? rooms : undefined,
    roomsMin: filters.rooms.includes('5plus') ? 5 : undefined,
    serviceIds: serviceIds.length > 0 ? serviceIds : undefined,
    categoryId: filters.categoryId ? references.categories[filters.categoryId] : undefined,
    guests: filters.guests,
    checkIn: filters.checkIn && filters.checkOut ? filters.checkIn : undefined,
    checkOut: filters.checkIn && filters.checkOut ? filters.checkOut : undefined,
    sort: filters.sort,
    smokingAllowed: filters.smokingAllowed || undefined,
    petsAllowed: filters.petsAllowed || undefined,
    childrenAllowed: filters.childrenAllowed || undefined,
    eventsAllowed: filters.eventsAllowed || undefined,
  };
}

export function buildPublicListingsQuery(params: PublicListingListParams): string {
  const query = new URLSearchParams();
  const set = (key: string, value: unknown) => { if (value !== undefined && value !== null && value !== '') query.set(key, String(value)); };
  set('limit', params.limit);
  set('offset', params.offset);
  set('q', params.q);
  set('city', params.city);
  set('price_min', params.priceMin);
  set('price_max', params.priceMax);
  set('area_min', params.areaMin);
  set('area_max', params.areaMax);
  if (params.rooms?.length) set('rooms', params.rooms.join(','));
  set('rooms_min', params.roomsMin);
  if (params.serviceIds?.length) set('services', params.serviceIds.join(','));
  set('category', params.categoryId);
  set('guests', params.guests);
  set('check_in', params.checkIn);
  set('check_out', params.checkOut);
  set('sort', params.sort);
  if (params.smokingAllowed) set('smoking_allowed', true);
  if (params.petsAllowed) set('pets_allowed', true);
  if (params.childrenAllowed) set('children_allowed', true);
  if (params.eventsAllowed) set('events_allowed', true);
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

async function publicApiRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const baseUrl = String(process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
  const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(response.status === 404 ? 'Объявление не найдено' : `API вернул ошибку ${response.status}`);
  return response.json() as Promise<T>;
}

export async function fetchPublicListings(params: PublicListingListParams, signal?: AbortSignal): Promise<Listing[]> {
  const payload = await publicApiRequest<PublicListingsPageDTO>(`/api/v1/listings/${buildPublicListingsQuery(params)}`, signal);
  return payload.items.map(mapPublicListingCard);
}

export async function fetchPublicListing(id: number, signal?: AbortSignal): Promise<Listing> {
  const payload = await publicApiRequest<PublicListingDetailDTO>(`/api/v1/listings/${id}`, signal);
  return mapPublicListingDetail(payload);
}
