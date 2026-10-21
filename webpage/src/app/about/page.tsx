import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
  CustomArrowRight, 
  CustomShield, 
  CustomWorkflow, 
  CustomMetrics, 
  CustomCheckCircle 
} from '@/components/icons/CustomIcons';

export const metadata: Metadata = {
  title: 'About Thea Solutions | Engineering Principles & SME Mission',
  description: 'Learn how Thea Solutions engineers bespoke software systems, workflow automation, and enterprise AI tailored specifically for growing small and mid-sized businesses.',
  openGraph: {
    title: 'About Thea Solutions | Bespoke Software & Enterprise AI',
    description: 'Our engineering philosophy, delivery standards, and remote-first team committed to SME operational scale.',
    url: 'https://theasolutions.co/about',
    siteName: 'Thea Solutions',
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#1A1816] text-[#F1F1F0]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-36 sm:pt-44 pb-20 overflow-hidden border-b border-white/[0.08]">
        {/* Ambient Wine-plum Light */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#5F1F2F]/20 rounded-full blur-[160px] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-6">
              <span className="size-1.5 rounded-full bg-[#e36a88]" />
              <span>Our Mission · Why We Exist</span>
            </div>

            <h1 className="font-ds-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
              Enterprise-grade engineering built for ambitious growing businesses
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-[#F1F1F0]/80 font-light leading-relaxed">
              We founded Thea Solutions because mid-market companies and growing SMEs are perpetually trapped between two flawed choices: overpriced enterprise software that takes 18 months to roll out, or off-the-shelf SaaS tools that force you into painful operational compromises.
            </p>
          </div>
        </div>
      </section>

      {/* Origin & Perspective */}
      <section className="py-20 sm:py-28 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            <div className="lg:col-span-5">
              <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] block mb-2">
                The Practical Reality
              </span>
              <h2 className="font-ds-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Software should conform to your operational reality — not the other way around.
              </h2>
              <div className="mt-6 p-5 rounded-2xl border border-white/10 bg-[#141312] text-xs font-ds-mono space-y-2">
                <div className="text-gray-400">Headquarters: Remote-First (Operating Globally)</div>
                <div className="text-gray-400">Primary Stack: Go, TypeScript, Next.js, Python, PostgreSQL</div>
                <div className="text-gray-400">Delivery Cadence: 2-Week Iterative Sprints</div>
                <div className="text-gray-400">Support Model: Dedicated SLA &amp; Proactive Maintenance</div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6 text-base text-gray-300 font-light leading-relaxed">
              <p>
                When a business grows beyond 20 employees, internal coordination inevitably fractures. Teams stitch together spreadsheets, Zapier triggers, and disconnected point solutions to manage inventory, billing, dispatch, and customer intake. Eventually, staff spend more hours maintaining brittle manual routines than serving customers.
              </p>
              <p>
                Off-the-shelf platforms promise a fix, but they charge steep per-seat monthly subscription taxes, hide your data behind proprietary silos, and demand that your team abandon their proven workflows to fit rigid software constraints.
              </p>
              <p>
                At <strong className="text-white font-medium">Thea Solutions</strong>, we engineer tailored software, custom AI integrations, and automated pipelines directly aligned with how your organization actually operates. We eliminate back-office friction, provide dependable long-term support, and deliver systems that your team genuinely enjoys using.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Engineering Principles */}
      <section className="py-20 sm:py-28 bg-[#181816]/40 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-16">
            <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] block mb-2">
              Our Core Tenets
            </span>
            <h2 className="font-ds-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Four principles that govern every line of code we ship
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div className="p-8 rounded-3xl border border-white/10 bg-[#141312] flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center mb-5">
                  <CustomShield size={20} />
                </div>
                <h3 className="font-ds-display text-xl font-bold text-white mb-2">
                  1. Production-Grade Security &amp; Reliability
                </h3>
                <p className="text-sm text-gray-400 font-light leading-relaxed">
                  Every system we engineer is built with hardened cloud infrastructure, automated backups, and strict access governance so your mission-critical operations run without interruption.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.08] text-xs font-ds-mono text-[#f3a6b7]">
                99.95% Uptime &amp; SLA Backed
              </div>
            </div>

            <div className="p-8 rounded-3xl border border-white/10 bg-[#141312] flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center mb-5">
                  <CustomWorkflow size={20} />
                </div>
                <h3 className="font-ds-display text-xl font-bold text-white mb-2">
                  2. 2-Week Agile Delivery Cycles
                </h3>
                <p className="text-sm text-gray-400 font-light leading-relaxed">
                  No six-month blackout periods. We demo running software on staging environments every two weeks, giving you continuous visibility, testable deliverables, and full steerage.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.08] text-xs font-ds-mono text-[#f3a6b7]">
                Bi-Weekly Interactive Check-Ins
              </div>
            </div>

            <div className="p-8 rounded-3xl border border-white/10 bg-[#141312] flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center mb-5">
                  <CustomMetrics size={20} />
                </div>
                <h3 className="font-ds-display text-xl font-bold text-white mb-2">
                  3. Measurable ROI Over Novelty
                </h3>
                <p className="text-sm text-gray-400 font-light leading-relaxed">
                  We don&apos;t chase tech fads or implement generic AI chat wrappers. Every system we architect is held to hard metrics: hours saved per coordinator, processing speed, and error reduction.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.08] text-xs font-ds-mono text-[#f3a6b7]">
                Deterministic Value &amp; Cost Control
              </div>
            </div>

            <div className="p-8 rounded-3xl border border-white/10 bg-[#141312] flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-xl bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center mb-5">
                  <CustomCheckCircle size={20} />
                </div>
                <h3 className="font-ds-display text-xl font-bold text-white mb-2">
                  4. Direct Architect Communication
                </h3>
                <p className="text-sm text-gray-400 font-light leading-relaxed">
                  You collaborate directly with senior software architects and developers who understand both your code and your commercial objectives. No layered account manager telephone games.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/[0.08] text-xs font-ds-mono text-[#f3a6b7]">
                Engineer-to-Stakeholder Collaboration
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-ds-display text-3xl sm:text-4xl font-bold text-white">
            Ready to review your technical roadmap?
          </h2>
          <p className="mt-4 text-base text-gray-400 max-w-xl mx-auto font-light">
            Book an introductory scoping discussion with our solutions architects. We will assess your existing processes and deliver an actionable architecture plan.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/#contact"
              className="inline-flex items-center gap-2 rounded-full py-3 px-8 text-sm font-semibold bg-[#F1F1F0] text-[#1A1816] hover:bg-white transition-all"
            >
              <span>Request Scoping Consultation</span>
              <CustomArrowRight size={15} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full py-3 px-8 text-sm font-medium border border-white/15 text-white hover:bg-white/[0.06] transition-all"
            >
              <span>View Engagement Models</span>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
