import 'server-only';
import { listings as mockListings } from '../data/listings';
import {
  createEmptyPublicListingReferences,
  mapPublicListingCard,
  mapPublicListingDetail,
  mapPublicListingReferences,
  type PublicListingDetailDTO,
  type PublicListingsBootstrap,
  type PublicListingsPageDTO,
  type PublicReferencesDTO,
} from './publicListings';

const backendOrigin = String(process.env.BACKEND_API_BASE_URL || 'https://arenda.wigaj.ru').replace(/\/$/, '');
const useMocks = process.env.NEXT_PUBLIC_LISTINGS_DATA_MODE === 'session-mock';

async function serverApiRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${backendOrigin}${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    const error = new Error(`Public API ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export async function loadPublicCatalog(): Promise<PublicListingsBootstrap> {
  if (useMocks) {
    return {
      source: 'session-mock',
      listings: mockListings,
      references: createEmptyPublicListingReferences(),
      catalogLoaded: true,
    };
  }

  try {
    const [page, servicePayload, categoryPayload] = await Promise.all([
      serverApiRequest<PublicListingsPageDTO>('/api/v1/listings/?limit=100&sort=newest'),
      serverApiRequest<PublicReferencesDTO>('/api/v1/services'),
      serverApiRequest<PublicReferencesDTO>('/api/v1/categories'),
    ]);
    return {
      source: 'http',
      listings: page.items.map(mapPublicListingCard),
      references: mapPublicListingReferences(servicePayload.items, categoryPayload.items),
      catalogLoaded: true,
    };
  } catch {
    return {
      source: 'http',
      listings: [],
      references: createEmptyPublicListingReferences(),
      catalogLoaded: false,
      error: 'Не удалось загрузить объявления. Проверьте подключение и попробуйте ещё раз.',
    };
  }
}

export async function loadPublicListing(id: number): Promise<{ listing?: ReturnType<typeof mapPublicListingDetail>; notFound: boolean; error?: string }> {
  if (useMocks) {
    const listing = mockListings.find((item) => item.id === id);
    return { listing, notFound: !listing };
  }
  try {
    const payload = await serverApiRequest<PublicListingDetailDTO>(`/api/v1/listings/${id}`);
    return { listing: mapPublicListingDetail(payload), notFound: false };
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    return {
      notFound: status === 404,
      error: status === 404 ? undefined : 'Не удалось загрузить объявление.',
    };
  }
}
