import React from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Section1 from '@/components/landing/Section1';

const Section2 = dynamic(() => import('@/components/landing/Section2'));
const Section3 = dynamic(() => import('@/components/landing/Section3'));
const Section4 = dynamic(() => import('@/components/landing/Section4'));
const Section5 = dynamic(() => import('@/components/landing/Section5'));
const Footer = dynamic(() => import('@/components/Footer'));

export default function Home() {
  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <Navbar />
      <Section1 />
      <Section2 />
      <Section3 />
      <Section4 />
      <Section5 />
      <Footer />
    </main>
  );
}
