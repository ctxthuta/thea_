import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Section5 from '@/components/landing/Section5';
import { CustomMail, CustomArrowRight } from '@/components/icons/CustomIcons';

export const metadata: Metadata = {
  title: 'Contact Thea Solutions | Direct Consultation & Project Scoping',
  description: 'Connect directly with Thea Solutions architects for custom software, automation systems, and enterprise AI engineering quotes. 24-hour response SLA.',
  openGraph: {
    title: 'Contact Thea Solutions | Start Your Project',
    description: 'Get in touch for bespoke software, workflow automation, and enterprise AI consultations.',
    url: 'https://theasolutions.co/contact',
    siteName: 'Thea Solutions',
  },
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#1A1816] text-[#F1F1F0]">
      <Navbar />

      {/* Header */}
      <section className="relative pt-36 sm:pt-44 pb-16 overflow-hidden border-b border-white/[0.08]">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#5F1F2F]/20 rounded-full blur-[160px] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-6">
              <span className="size-1.5 rounded-full bg-[#e36a88]" />
              <span>Direct Consultation · 24h Response SLA</span>
            </div>

            <h1 className="font-ds-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
              Connect with our solution architects
            </h1>

            <p className="mt-6 text-lg text-[#F1F1F0]/80 font-light leading-relaxed">
              Whether you need to automate a high-volume back-office process, modernize a legacy system, or architect a custom platform from scratch, we provide straightforward technical guidance.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#141312] border border-white/10">
                <span className="font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 block mb-1">Business &amp; Sales</span>
                <a href="mailto:sales@theasolutions.co" className="text-sm font-medium text-white hover:text-[#f3a6b7] transition-colors">
                  sales@theasolutions.co
                </a>
              </div>
              <div className="p-4 rounded-xl bg-[#141312] border border-white/10">
                <span className="font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 block mb-1">Partnerships</span>
                <a href="mailto:business@theasolutions.co" className="text-sm font-medium text-white hover:text-[#f3a6b7] transition-colors">
                  business@theasolutions.co
                </a>
              </div>
              <div className="p-4 rounded-xl bg-[#141312] border border-white/10">
                <span className="font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 block mb-1">Careers &amp; Talent</span>
                <a 
                  href="mailto:careers@theasolutions.co" 
                  className="text-sm font-medium text-white hover:text-[#f3a6b7] inline-flex items-center gap-1.5 transition-colors"
                >
                  <CustomMail size={14} />
                  <span>careers@theasolutions.co</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Embedded Scope Form & FAQ */}
      <Section5 />

      <Footer />
    </main>
  );
}
