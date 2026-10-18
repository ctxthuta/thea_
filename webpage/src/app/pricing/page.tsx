import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
  CustomArrowRight, 
  CustomCheck, 
  CustomShield, 
  CustomWorkflow, 
  CustomMetrics,
  CustomSparkles 
} from '@/components/icons/CustomIcons';

export const metadata: Metadata = {
  title: 'Pricing & Engagement Models | Thea Solutions',
  description: 'Transparent, milestone-based pricing models for bespoke software, workflow automation, and enterprise AI engineering. Zero vendor lock-in, 100% client code ownership.',
  openGraph: {
    title: 'Pricing & Engagement Models | Thea Solutions',
    description: 'Transparent software engineering pricing. 100% IP ownership, 2-week agile sprints, zero perpetual seat licensing.',
    url: 'https://theasolutions.co/pricing',
    siteName: 'Thea Solutions',
  },
};

const engagementModels = [
  {
    name: 'Targeted Sprint',
    eyebrow: 'Fixed Scope · Rapid ROI',
    tagline: 'Best for specific workflow automations, custom internal dashboards, or MVP feature rollouts.',
    timeline: '2 – 4 Weeks',
    features: [
      'Comprehensive technical scoping & architectural specification',
      'End-to-end engineering in 2-week focused sprint blocks',
      'Automated data validation and document extraction pipelines',
      'Complete cloud deployment on your GCP, AWS, or VPS environment',
      '100% source code repository and IP transfer',
      '30 days of post-launch bug warranty and operational monitoring'
    ],
    actionText: 'Scope a Targeted Sprint',
    popular: false
  },
  {
    name: 'Dedicated Engineering Pod',
    eyebrow: 'Dedicated Team · Ongoing Velocity',
    tagline: 'Best for scaling businesses requiring continuous software feature delivery and architectural leadership.',
    timeline: 'Monthly Retainer',
    features: [
      'Dedicated senior software engineers + lead solutions architect',
      'Full-stack web, mobile (Flutter/KMP), and backend (Go/Python)',
      'Continuous 2-week sprint planning with bi-weekly live demos',
      'Direct communication channel via Slack, Teams, or Discord',
      'Cloud DevOps, CI/CD pipeline management, and database tuning',
      'Zero perpetual per-seat license taxes or vendor dependencies'
    ],
    actionText: 'Reserve an Engineering Pod',
    popular: true
  },
  {
    name: 'Enterprise Modernization',
    eyebrow: 'Deep Overhaul · Zero Downtime',
    tagline: 'Best for re-engineering legacy on-prem systems, brittle ERPs, and fragmented spreadsheet operations.',
    timeline: 'Phased Multi-Month',
    features: [
      'Full audit of existing legacy code, databases, and dependencies',
      'Zero-downtime database migration and automated schema reconciliation',
      'Modern REST & GraphQL API abstraction layer creation',
      'Security hardening, role-based access control (RBAC), and SOC2 readiness',
      'Comprehensive operational handover and internal team onboarding',
      'Ongoing SLA support and proactive cloud performance monitoring'
    ],
    actionText: 'Request Modernization Audit',
    popular: false
  }
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#1A1816] text-[#F1F1F0]">
      <Navbar />

      {/* Header */}
      <section className="relative pt-36 sm:pt-44 pb-20 overflow-hidden border-b border-white/[0.08]">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#5F1F2F]/20 rounded-full blur-[160px] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-6">
            <CustomSparkles size={13} className="text-[#e36a88]" />
            <span>Transparent Engagement · Zero Hidden Fees</span>
          </div>

          <h1 className="font-ds-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
            Predictable investment models aligned with measurable outcomes
          </h1>

          <p className="mt-6 text-lg text-gray-300 font-light leading-relaxed">
            We don&apos;t charge per-user monthly SaaS fees or hold your software hostage. You pay for engineering velocity and complete intellectual property ownership.
          </p>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="py-20 sm:py-28 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {engagementModels.map((model) => (
              <div 
                key={model.name}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                  model.popular 
                    ? 'border-2 border-[#5F1F2F] bg-[#1A1816] shadow-[0_20px_50px_rgba(95,31,47,0.35),inset_0_1px_0_0_rgba(255,255,255,0.12)]' 
                    : 'border border-white/10 bg-[#161514] hover:border-white/20'
                }`}
              >
                {model.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#5F1F2F] text-[#f3a6b7] font-ds-mono text-[11px] uppercase tracking-wider border border-[#f3a6b7]/40 shadow-sm">
                    Most Popular for Growing SMEs
                  </div>
                )}

                <div>
                  <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] block mb-2">
                    {model.eyebrow}
                  </span>
                  <h2 className="font-ds-display text-2xl font-bold text-white mb-2">
                    {model.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 font-light leading-relaxed mb-6">
                    {model.tagline}
                  </p>

                  <div className="py-4 border-y border-white/[0.08] mb-6 flex items-center justify-between font-ds-mono text-xs">
                    <span className="text-gray-400">Typical Timeline</span>
                    <span className="text-white font-semibold">{model.timeline}</span>
                  </div>

                  <div className="space-y-3 mb-8">
                    <span className="font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 block mb-2">
                      Deliverables Included:
                    </span>
                    {model.features.map((feat) => (
                      <div key={feat} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-300 font-light">
                        <CustomCheck size={14} className="text-[#f3a6b7] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href="/#contact"
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-full py-3 px-6 text-sm font-semibold transition-all ${
                    model.popular
                      ? 'bg-[#F1F1F0] text-[#1A1816] hover:bg-white shadow-lg'
                      : 'bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/10'
                  }`}
                >
                  <span>{model.actionText}</span>
                  <CustomArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Included Standard in Every Contract */}
      <section className="py-20 sm:py-28 bg-[#181816]/40 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-16">
            <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] block mb-2">
              The Thea Standard
            </span>
            <h2 className="font-ds-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Guaranteed in every single statement of work
            </h2>
            <p className="mt-3 text-base text-gray-400 font-light">
              Regardless of project size, every contract includes our fundamental engineering and governance protections.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#141312] border border-white/10">
              <div className="h-9 w-9 rounded-lg bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center mb-4">
                <CustomShield size={18} />
              </div>
              <h3 className="font-ds-display text-lg font-bold text-white mb-2">
                100% Code &amp; IP Ownership
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 font-light leading-relaxed">
                You receive full copyright and title to all repositories, documentation, and assets upon milestone completion.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#141312] border border-white/10">
              <div className="h-9 w-9 rounded-lg bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center mb-4">
                <CustomWorkflow size={18} />
              </div>
              <h3 className="font-ds-display text-lg font-bold text-white mb-2">
                Bi-Weekly Demo Check-Ins
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 font-light leading-relaxed">
                You inspect working code on staging every 14 days, with transparent task tracking and clear milestone burn-downs.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#141312] border border-white/10">
              <div className="h-9 w-9 rounded-lg bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center mb-4">
                <CustomMetrics size={18} />
              </div>
              <h3 className="font-ds-display text-lg font-bold text-white mb-2">
                30-Day Defect Warranty
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 font-light leading-relaxed">
                Any bug or unexpected variance from the agreed scope discovered within 30 days of release is fixed promptly at no extra charge.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Pricing FAQs */}
      <section className="py-20 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] block mb-2">
              Common Questions
            </span>
            <h2 className="font-ds-display text-3xl font-bold text-white">
              Pricing &amp; Contract Details
            </h2>
          </div>

          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-[#141312] border border-white/10">
              <h3 className="font-ds-display text-base font-semibold text-white mb-2">
                How are milestone payments structured?
              </h3>
              <p className="text-sm text-gray-400 font-light leading-relaxed">
                For fixed-scope sprints, payments are broken into clear milestones: typically 30% upon architecture kickoff, 30% upon midpoint prototype demo, and 40% upon final production deployment and code transfer. Retainers are billed monthly in advance.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#141312] border border-white/10">
              <h3 className="font-ds-display text-base font-semibold text-white mb-2">
                What happens if our project scope changes mid-sprint?
              </h3>
              <p className="text-sm text-gray-400 font-light leading-relaxed">
                Because we work in 2-week agile cycles, reprioritizing features is straightforward. If you identify a higher-value priority during a bi-weekly demo, we swap features of equivalent weight in the backlog without penalty.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#141312] border border-white/10">
              <h3 className="font-ds-display text-base font-semibold text-white mb-2">
                Do you sign an NDA before reviewing proprietary files?
              </h3>
              <p className="text-sm text-gray-400 font-light leading-relaxed">
                Yes. Before you share sample datasets, internal process spreadsheets, or legacy system credentials, we execute a mutual Non-Disclosure Agreement (NDA).
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-gray-400 mb-4">
              Have a custom enterprise scope or multi-system integration need?
            </p>
            <Link
              href="/#contact"
              className="inline-flex items-center gap-2 rounded-full py-3 px-8 text-sm font-semibold bg-[#F1F1F0] text-[#1A1816] hover:bg-white transition-all"
            >
              <span>Get a Tailored Estimate</span>
              <CustomArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
