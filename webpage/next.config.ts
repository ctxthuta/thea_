import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/about',
        destination: '/#about',
        permanent: true,
      },
      {
        source: '/services',
        destination: '/#services',
        permanent: true,
      },
      {
        source: '/contact',
        destination: '/#contact',
        permanent: true,
      },
      {
        source: '/faq',
        destination: '/#faqs',
        permanent: true,
      },
      {
        source: '/faqs',
        destination: '/#faqs',
        permanent: true,
      },
      {
        source: '/demo',
        destination: '/schedule-demo',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;