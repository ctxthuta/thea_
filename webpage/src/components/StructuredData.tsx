import React from 'react';

interface StructuredDataProps {
  data: object;
}

export default function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationStructuredData() {
  const organizationData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://theasolutions.co/#organization',
    name: 'Thea Solutions',
    legalName: 'Thea Solutions Co., Ltd.',
    url: 'https://theasolutions.co',
    logo: {
      '@type': 'ImageObject',
      url: 'https://theasolutions.co/icon-512.png',
      width: 512,
      height: 512,
      caption: 'Thea Solutions Logo',
    },
    image: 'https://theasolutions.co/icon-512.png',
    description: 'Thea Solutions specializes in bespoke software development, enterprise-grade AI, and automation solutions engineered specifically for SMEs to streamline operations and scale with confidence.',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'business@theasolutions.co',
      contactType: 'business inquiries',
      availableLanguage: ['English', 'Burmese'],
    },
    sameAs: [
      'https://www.linkedin.com/company/theasolutionss',
      'https://www.tiktok.com/@theasolutions.co?_r=1&_t=ZS-980MdkL0X9J',
      'https://www.instagram.com/theasolutions_?igsh=ODc3ZmFrN2tkbDYw'
    ],
    knowsAbout: [
      'bespoke software development',
      'enterprise AI solutions',
      'business automation',
      'SME technology',
      'custom software development',
      'AI integration',
      'process automation',
      'workflow automation',
      'machine learning solutions'
    ],
  };

  return <StructuredData data={organizationData} />;
}

export function WebSiteStructuredData() {
  const webSiteData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://theasolutions.co/#website',
    name: 'Thea Solutions',
    alternateName: 'Thea',
    url: 'https://theasolutions.co',
    description: 'Thea Solutions specializes in bespoke software development, enterprise-grade AI, and automation solutions engineered specifically for SMEs.',
    publisher: {
      '@id': 'https://theasolutions.co/#organization',
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://theasolutions.co/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
    hasPart: [
      {
        '@type': 'WebPage',
        '@id': 'https://theasolutions.co/about',
        name: 'About Us',
        url: 'https://theasolutions.co/about',
        description: 'About Thea Solutions, our mission, and engineering philosophy.',
      },
      {
        '@type': 'WebPage',
        '@id': 'https://theasolutions.co/#services',
        name: 'Services & Capabilities',
        url: 'https://theasolutions.co/#services',
        description: 'Bespoke software systems, enterprise AI integration, and workflow automation.',
      },
      {
        '@type': 'WebPage',
        '@id': 'https://theasolutions.co/pricing',
        name: 'Pricing & Engagement Models',
        url: 'https://theasolutions.co/pricing',
        description: 'Transparent milestone and sprint-based engagement models with dedicated SLA support.',
      },
      {
        '@type': 'WebPage',
        '@id': 'https://theasolutions.co/careers',
        name: 'Careers',
        url: 'https://theasolutions.co/careers',
        description: 'Open engineering, product, and leadership roles at Thea Solutions.',
      },
      {
        '@type': 'WebPage',
        '@id': 'https://theasolutions.co/contact',
        name: 'Contact Us',
        url: 'https://theasolutions.co/contact',
        description: 'Get in touch for custom project estimates and consultations.',
      },
      {
        '@type': 'WebPage',
        '@id': 'https://theasolutions.co/#faqs',
        name: 'Frequently Asked Questions',
        url: 'https://theasolutions.co/#faqs',
        description: 'Answers to common questions about our delivery, pricing, and support.',
      },
    ],
  };

  return <StructuredData data={webSiteData} />;
}

export function SiteNavigationStructuredData() {
  const navigationData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: [
      {
        '@type': 'SiteNavigationElement',
        position: 1,
        name: 'About Us',
        description: 'About Thea Solutions, our mission, and engineering philosophy.',
        url: 'https://theasolutions.co/about',
      },
      {
        '@type': 'SiteNavigationElement',
        position: 2,
        name: 'Services & Capabilities',
        description: 'Bespoke software systems, enterprise AI integration, and workflow automation.',
        url: 'https://theasolutions.co/#services',
      },
      {
        '@type': 'SiteNavigationElement',
        position: 3,
        name: 'Pricing',
        description: 'Transparent milestone and retainer engagement models with dedicated SLA support.',
        url: 'https://theasolutions.co/pricing',
      },
      {
        '@type': 'SiteNavigationElement',
        position: 4,
        name: 'Careers',
        description: 'Explore remote-first engineering and product roles at Thea Solutions.',
        url: 'https://theasolutions.co/careers',
      },
      {
        '@type': 'SiteNavigationElement',
        position: 5,
        name: 'Contact & Quote',
        description: 'Get in touch with Thea Solutions for project consultations and quotes.',
        url: 'https://theasolutions.co/contact',
      },
      {
        '@type': 'SiteNavigationElement',
        position: 6,
        name: 'FAQ',
        description: 'Frequently asked questions regarding our engineering, delivery model, and support.',
        url: 'https://theasolutions.co/#faqs',
      },
    ],
  };

  return <StructuredData data={navigationData} />;
}
