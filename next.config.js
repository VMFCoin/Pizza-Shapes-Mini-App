/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: 'warpcast.com' },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Optional deps pulled in by some wallet connectors
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };
    return config;
  },
}

module.exports = nextConfig
