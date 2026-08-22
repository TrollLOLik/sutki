import type { Metadata } from 'next';
import { createEmptyPublicListingReferences, type PublicListingsBootstrap } from '@shared/api/publicListings';
import { loadPublicCatalog, loadPublicListing } from '@shared/api/publicListings.server';
import { appRoutePath, parseAppRoute, routeTitle } from '../router/appRoute';
import { NextClientApplication } from '../NextClientApplication';

interface ApplicationRouteProps {
  params: Promise<{ route?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function applicationLocation(
  routeSegments: string[] = [],
  searchParams: Record<string, string | string[] | undefined> = {},
): string {
  const pathname = `/${routeSegments.map(encodeURIComponent).join('/')}`;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }

  const serializedQuery = query.toString();
  return serializedQuery ? `${pathname}?${serializedQuery}` : pathname;
}

async function resolveLocation({ params, searchParams }: ApplicationRouteProps): Promise<string> {
  const [{ route }, query] = await Promise.all([params, searchParams]);
  return applicationLocation(route, query);
}

function emptyBootstrap(): PublicListingsBootstrap {
  return {
    source: process.env.NEXT_PUBLIC_LISTINGS_DATA_MODE === 'session-mock' ? 'session-mock' : 'http',
    listings: [],
    references: createEmptyPublicListingReferences(),
    catalogLoaded: false,
  };
}

async function loadRouteBootstrap(location: string): Promise<PublicListingsBootstrap> {
  const route = parseAppRoute(location);
  const needsCatalog = route.name === 'home' || route.name === 'map' || route.name === 'listing' || route.name === 'booking';
  const listingId = route.name === 'listing' || route.name === 'booking' ? route.listingId : null;
  if (!needsCatalog) return emptyBootstrap();

  const [catalog, detail] = await Promise.all([
    loadPublicCatalog(),
    listingId == null ? Promise.resolve(null) : loadPublicListing(listingId),
  ]);
  if (!detail?.listing) return catalog;
  return {
    ...catalog,
    listings: [detail.listing, ...catalog.listings.filter((listing) => listing.id !== detail.listing?.id)],
    listingDetail: detail.listing,
  };
}

export async function generateMetadata(props: ApplicationRouteProps): Promise<Metadata> {
  const location = await resolveLocation(props);
  const route = parseAppRoute(location);
  const indexable = route.name === 'home' || route.name === 'listing';
  const detail = route.name === 'listing' ? await loadPublicListing(route.listingId) : null;
  const listing = detail?.listing;
  const listingTitle = listing?.title;
  const description = listing?.description?.trim().slice(0, 180)
    || (route.name === 'home' ? 'Поиск и аренда квартир и домов на нужные даты.' : undefined);
  const canIndex = indexable && !(route.name === 'listing' && detail?.notFound);

  return {
    title: routeTitle(route, listingTitle),
    description,
    alternates: canIndex ? { canonical: appRoutePath(route) } : undefined,
    openGraph: listing ? {
      title: listing.title,
      description,
      type: 'website',
      images: listing.coverUrl ? [{ url: listing.coverUrl, alt: listing.title }] : undefined,
    } : undefined,
    robots: canIndex
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

export default async function ApplicationRoute(props: ApplicationRouteProps) {
  const initialLocation = await resolveLocation(props);
  const bootstrap = await loadRouteBootstrap(initialLocation);
  return <NextClientApplication initialLocation={initialLocation} bootstrap={bootstrap} />;
}
