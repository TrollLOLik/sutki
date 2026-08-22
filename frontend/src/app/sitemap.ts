import type { MetadataRoute } from 'next';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://arenda.wigaj.ru';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: appUrl,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1,
  }];
}
