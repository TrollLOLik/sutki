import type { MetadataRoute } from 'next';
import { loadPublicCatalog } from '@shared/api/publicListings.server';

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://arenda.wigaj.ru').replace(/\/$/, '');

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await loadPublicCatalog();
  return [{
    url: appUrl,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1,
  }, ...catalog.listings.map((listing) => ({
    url: `${appUrl}/listing/${listing.id}`,
    lastModified: listing.createdAt ? new Date(listing.createdAt) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
    images: listing.coverUrl ? [listing.coverUrl] : undefined,
  }))];
}
