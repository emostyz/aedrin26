import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AEDRIN',
    short_name: 'AEDRIN',
    description: 'An operating system for your soul. Capture memories, preserve your story.',
    start_url: '/app/dashboard',
    display: 'standalone',
    background_color: '#0f0f0f',
    theme_color: '#0f0f0f',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['lifestyle', 'productivity'],
    screenshots: [],
  }
}
