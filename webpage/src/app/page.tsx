import React from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Section1 from '@/components/landing/Section1';
import { fetchCmsSections } from '@/lib/hqClient';

const Section2 = dynamic(() => import('@/components/landing/Section2'));
const Section3 = dynamic(() => import('@/components/landing/Section3'));
const Section4 = dynamic(() => import('@/components/landing/Section4'));
const Section5 = dynamic(() => import('@/components/landing/Section5'));
const Footer = dynamic(() => import('@/components/Footer'));

export default async function Home() {
  const cms = await fetchCmsSections(
    ['hero', 'services', 'delivery_pipeline', 'faqs', 'site_settings'],
    60
  );

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <Navbar />
      <Section1 cms={cms.hero} />
      <Section2 cms={cms.services} />
      <Section3 cms={cms.delivery_pipeline} />
      <Section4 />
      <Section5 faqsCms={cms.faqs} siteSettings={cms.site_settings} />
      <Footer />
    </main>
  );
}
