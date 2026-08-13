/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // TMDB serves all poster/backdrop imagery from image.tmdb.org.
    // Add further hosts here if you plug in another metadata provider.
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
    ],
  },
};

export default nextConfig;
