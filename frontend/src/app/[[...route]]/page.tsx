import type { Metadata } from 'next';
import { listings } from '@shared/data/listings';
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

export async function generateMetadata(props: ApplicationRouteProps): Promise<Metadata> {
  const location = await resolveLocation(props);
  const route = parseAppRoute(location);
  const indexable = route.name === 'home' || route.name === 'listing';
  const listingTitle = route.name === 'listing' || route.name === 'booking'
    ? listings.find((listing) => listing.id === route.listingId)?.title
    : undefined;

  return {
    title: routeTitle(route, listingTitle),
    alternates: indexable ? { canonical: appRoutePath(route) } : undefined,
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

export default async function ApplicationRoute(props: ApplicationRouteProps) {
  const initialLocation = await resolveLocation(props);
  return <NextClientApplication initialLocation={initialLocation} />;
}
