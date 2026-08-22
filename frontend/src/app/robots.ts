import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/listing/'],
      disallow: [
        '/booking/',
        '/bookings',
        '/chat/',
        '/code',
        '/create',
        '/email',
        '/incoming',
        '/messages',
        '/my-listings',
        '/my-reviews',
        '/notifications',
        '/phone',
        '/profile',
        '/profile-setup',
        '/promotion',
        '/review/',
        '/ui-kit',
        '/welcome',
      ],
    },
  };
}
