'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import {
  Compass,
  Layers,
  Terminal,
  ShieldCheck,
  Rocket,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  Workflow,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { CustomArrowRight } from '@/components/icons/CustomIcons';

const phases = [
  {
    step: '01',
    tag: 'Discovery',
    title: 'Discovery & Strategy',
    timeframe: 'Days 1 – 7',
    summary:
      'We analyze your workflows, interview key stakeholders, and define a clear technical roadmap aligned directly with your revenue and operational targets.',
    businessOutcome: '100% scope and budget certainty before any code is written.',
    deliverables: [
      'Technical Architecture Blueprint',
      'Scope & Fixed-Cost Feasibility Matrix',
      'Milestone Delivery Roadmap',
    ],
    touchpoint: '1x 45-min Kickoff & Alignment Workshop',
    icon: Compass,
  },
  {
    step: '02',
    tag: 'Prototyping',
    title: 'Design & Interactive Previews',
    timeframe: 'Week 2',
    summary:
      'We create clickable, interactive design prototypes and architectural diagrams so you can validate UX, data flow, and features before development begins.',
    businessOutcome: 'Zero costly reworks by validating design and user flows upfront.',
    deliverables: [
      'Clickable High-Fidelity Prototype',
      'Database & REST/GraphQL API Schema',
      'Design System Component Specs',
    ],
    touchpoint: 'Interactive Prototype Walkthrough & Sign-off',
    icon: Layers,
  },
  {
    step: '03',
    tag: 'Execution',
    title: 'Building in 2-Week Sprints',
    timeframe: 'Weeks 3 – 8+',
    summary:
      'We engineer your solution in focused 2-week agile sprints with bi-weekly live demos, giving your leadership complete visibility and zero hidden surprises.',
    businessOutcome: 'Working, deployable software deployed to staging every 14 days.',
    deliverables: [
      'Production-Ready Clean Codebase',
      'Live Staging Environment Builds',
      'Bi-Weekly Sprint Demo Recordings',
    ],
    touchpoint: 'Bi-Weekly Live Demos & Priority Reviews',
    icon: Terminal,
  },
  {
    step: '04',
    tag: 'Quality',
    title: 'Testing & Hardening',
    timeframe: 'Pre-Launch',
    summary:
      'We execute comprehensive automated testing, performance stress tests, and security audits to guarantee rock-solid stability and data protection.',
    businessOutcome: 'Enterprise-grade reliability with 99.95%+ uptime target.',
    deliverables: [
      'Automated E2E & Integration Tests',
      'Security Audit & Pen-Test Verification',
      'High-Concurrency Load Benchmarks',
    ],
    touchpoint: 'User Acceptance Testing (UAT) Final Sign-off',
    icon: ShieldCheck,
  },
  {
    step: '05',
    tag: 'Deployment',
    title: 'Smooth Production Launch',
    timeframe: 'Launch Day',
    summary:
      'We manage the zero-downtime cutover and data migration with built-in rollback safeguards and real-time observability from minute one.',
    businessOutcome: 'Seamless go-live with zero customer-facing disruption.',
    deliverables: [
      'Zero-Downtime Live Migration Plan',
      'Real-Time APM & Telemetry Dashboards',
      'Automated Rollback Safeguards',
    ],
    touchpoint: 'Dedicated Launch Day War Room & Handover',
    icon: Rocket,
  },
  {
    step: '06',
    tag: 'Evolution',
    title: 'Continuous Evolution & SLA',
    timeframe: 'Ongoing Partnership',
    summary:
      'We provide dedicated SLA support, proactive cloud monitoring, and iterative feature development to ensure your software scales as your business grows.',
    businessOutcome: 'Long-term technical peace of mind with guaranteed response times.',
    deliverables: [
      'Guaranteed Response SLA Support',
      'Cloud Spend & Performance Optimization',
      'Quarterly Feature Iteration Sprints',
    ],
    touchpoint: 'Monthly Architecture & Roadmap Reviews',
    icon: Activity,
  },
];

function Section3() {
  const [activePhaseIndex, setActivePhaseIndex] = useState(0);
  const containerRef = useRef(null);

  // Scroll tracking across the pinned desktop section
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    // Slices 0.0 -> 1.0 into 6 discrete phase steps
    const index = Math.min(Math.floor(latest * phases.length), phases.length - 1);
    setActivePhaseIndex(index);
  });

  // Smooth jump to specific phase on click
  const scrollToPhase = (targetIndex) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const containerTop = container.getBoundingClientRect().top + window.scrollY;
    const scrollableDistance = container.offsetHeight - window.innerHeight;
    const targetScroll = containerTop + (targetIndex / (phases.length - 1)) * scrollableDistance;

    window.scrollTo({
      top: targetScroll,
      behavior: 'smooth',
    });
  };

  const activePhase = phases[activePhaseIndex];
  const ActiveIcon = activePhase.icon;

  return (
    <section id="methodology" className="relative w-full overflow-hidden bg-[#181816] border-y border-white/[0.06]">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-[#5F1F2F]/15 rounded-full blur-[240px] pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/3 translate-y-1/3 w-[600px] h-[600px] bg-[#8E2E46]/10 rounded-full blur-[260px] pointer-events-none -z-10" />

      {/* =========================================================================
          DESKTOP VIEW (lg+): SCROLL-DRIVEN STICKY STORYTELLING
          Clean, business-friendly delivery process without intrusive lines across text.
         ========================================================================= */}
      <div ref={containerRef} className="hidden lg:block relative h-[350vh]">
        <div className="sticky top-0 h-screen w-full flex flex-col justify-between pt-28 xl:pt-32 pb-6 px-8 xl:px-12 max-w-7xl mx-auto overflow-hidden">
          
          {/* Header & Section Title (positioned below fixed navbar) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7]">
                <span className="size-1.5 rounded-full bg-[#e36a88] animate-pulse" />
                <span>Our Delivery Process · Predictable Milestones</span>
              </div>

              {/* High-visibility phase counter */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/10 bg-[#1A1816]/90 font-ds-mono text-xs text-gray-300 shadow-md">
                <span className="size-1.5 rounded-full bg-[#e36a88]" />
                <span>Phase <strong className="text-white font-bold">{activePhase.step}</strong> of 06</span>
              </div>
            </div>

            <h2 className="font-ds-display text-2xl xl:text-3xl font-bold tracking-tight text-white leading-tight">
              A proven, predictable path from vision to production
            </h2>
          </div>

          {/* Clean Step Navigation Strip (No lines slicing across cards) */}
          <div className="my-3 p-1.5 rounded-2xl bg-[#1A1816]/90 border border-white/10 backdrop-blur-xl shadow-lg">
            <div className="grid grid-cols-6 gap-2">
              {phases.map((item, idx) => {
                const Icon = item.icon;
                const isActive = activePhaseIndex === idx;
                const isPassed = activePhaseIndex > idx;

                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => scrollToPhase(idx)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-300 ${
                      isActive
                        ? 'bg-[#5F1F2F] text-white shadow-[0_0_18px_rgba(227,106,136,0.4)] ring-1 ring-[#e36a88]'
                        : isPassed
                        ? 'bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white'
                        : 'bg-transparent text-gray-400 hover:bg-white/[0.03] hover:text-gray-300'
                    }`}
                  >
                    <div
                      className={`size-6 rounded-lg flex items-center justify-center font-ds-mono text-xs font-bold shrink-0 ${
                        isActive
                          ? 'bg-white text-[#181816]'
                          : isPassed
                          ? 'bg-[#e36a88]/20 text-[#f3a6b7]'
                          : 'bg-white/[0.05] text-gray-400'
                      }`}
                    >
                      {item.step}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-ds-display font-bold truncate">
                        {item.tag}
                      </div>
                      <div className="text-[10px] font-ds-mono opacity-70 truncate">
                        {item.timeframe}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Phase Spotlight Card */}
          <div className="my-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePhase.step}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35 }}
                className="rounded-3xl border border-[#5F1F2F]/60 bg-gradient-to-b from-[#1F191B] to-[#181816] p-6 xl:p-8 backdrop-blur-2xl shadow-[0_20px_50px_-10px_rgba(95,31,47,0.35),inset_0_1px_0_0_rgba(255,255,255,0.12)] relative overflow-hidden"
              >
                {/* Decorative top hairline glow */}
                <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#e36a88] to-transparent" />

                <div className="grid grid-cols-12 gap-6 xl:gap-10 items-center">
                  
                  {/* Left Column: Scope & Value Story (7 cols) */}
                  <div className="col-span-7 space-y-4">
                    
                    {/* Header tags */}
                    <div className="flex items-center gap-3">
                      <span className="font-ds-mono text-xs uppercase px-3 py-1 rounded-full bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/50 font-semibold">
                        Phase {activePhase.step} · {activePhase.tag}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-ds-mono text-gray-300 bg-white/[0.05] px-3 py-1 rounded-full border border-white/10">
                        <Clock size={12} className="text-[#f3a6b7]" />
                        <span>{activePhase.timeframe}</span>
                      </span>
                    </div>

                    {/* Title */}
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-[#5F1F2F]/40 border border-[#e36a88]/40 flex items-center justify-center text-[#f3a6b7] shrink-0 shadow-lg">
                        <ActiveIcon size={20} />
                      </div>
                      <h3 className="font-ds-display text-2xl xl:text-3xl font-bold text-white tracking-tight">
                        {activePhase.title}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="text-sm xl:text-base text-gray-300 font-light leading-relaxed">
                      {activePhase.summary}
                    </p>

                    {/* Business Value Highlight Box */}
                    <div className="p-3.5 rounded-2xl bg-black/40 border border-[#5F1F2F]/30 flex items-start gap-3">
                      <div className="size-6 rounded-lg bg-[#5F1F2F]/50 text-[#f3a6b7] flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles size={13} />
                      </div>
                      <div>
                        <div className="text-[11px] font-ds-mono uppercase tracking-wider text-[#f3a6b7] font-semibold">
                          Business Value & Guarantee
                        </div>
                        <div className="text-xs xl:text-sm text-gray-200 mt-0.5 font-medium">
                          {activePhase.businessOutcome}
                        </div>
                      </div>
                    </div>

                    {/* Client Touchpoint Pill */}
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center gap-3">
                      <Workflow size={14} className="text-[#f3a6b7] shrink-0" />
                      <div className="text-xs text-gray-300">
                        <span className="font-ds-mono text-gray-400 uppercase text-[10px] block">
                          Client Involvement:
                        </span>
                        {activePhase.touchpoint}
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Tangible Deliverables Checklist (5 cols) */}
                  <div className="col-span-5 bg-black/30 rounded-2xl p-5 xl:p-6 border border-white/10 shadow-inner">
                    <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-white/[0.08]">
                      <span className="text-xs font-ds-mono uppercase tracking-wider text-gray-300 font-semibold flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-[#e36a88]" />
                        <span>Tangible Deliverables</span>
                      </span>
                      <span className="text-[10px] font-ds-mono text-[#f3a6b7]">
                        Verified Acceptance
                      </span>
                    </div>

                    <ul className="space-y-2.5">
                      {activePhase.deliverables.map((deliv, dIdx) => (
                        <li key={dIdx} className="flex items-start gap-3 group">
                          <span className="mt-0.5 size-4 rounded-full bg-[#5F1F2F]/50 border border-[#e36a88]/60 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={11} className="text-[#f3a6b7]" />
                          </span>
                          <span className="text-xs xl:text-sm text-gray-200 group-hover:text-white transition-colors">
                            {deliv}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Next step continuity prompt */}
                    <div className="mt-5 pt-3.5 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-[11px] font-ds-mono text-gray-400">
                        {activePhaseIndex < phases.length - 1 ? (
                          <>Next: <strong className="text-white">Phase {phases[activePhaseIndex + 1].step} ({phases[activePhaseIndex + 1].tag})</strong></>
                        ) : (
                          <span className="text-emerald-400 font-semibold">Production Live & Supported</span>
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => scrollToPhase((activePhaseIndex + 1) % phases.length)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5F1F2F]/40 hover:bg-[#5F1F2F] text-xs font-ds-mono text-white border border-[#e36a88]/40 transition-all cursor-pointer"
                      >
                        <span>{activePhaseIndex < phases.length - 1 ? 'Next Step' : 'Restart'}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>

                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Bar: Scroll Indicator + CTA */}
          <div className="flex items-center justify-between border-t border-white/[0.08] pt-3">
            <div className="flex items-center gap-2 text-xs font-ds-mono text-gray-400">
              <ChevronDown size={14} className="text-[#f3a6b7] animate-bounce" />
              <span>Scroll down to advance through all delivery phases ({activePhaseIndex + 1} of 6)</span>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/schedule-demo"
                className="text-xs font-ds-mono text-[#f3a6b7] hover:text-white transition-colors flex items-center gap-1.5"
              >
                <span>Schedule Discovery Call</span>
                <CustomArrowRight size={12} />
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
          MOBILE VIEW (< lg): CLEAN VERTICAL TIMELINE WITH ZERO OVERLAPPING
          Kept exactly as you liked: dedicated left column for circle node & line,
          completely separated from the right card by clear margin and gap.
         ========================================================================= */}
      <div className="lg:hidden py-16 px-4 sm:px-6">
        
        {/* Mobile Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-3">
            <span className="size-1.5 rounded-full bg-[#e36a88] animate-pulse" />
            <span>Our Delivery Process</span>
          </div>
          <h2 className="font-ds-display text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
            A proven path from vision to production
          </h2>
          <p className="mt-2.5 text-sm text-gray-400 font-light leading-relaxed">
            Follow our sequential stages below. Each phase delivers verified production artifacts with full transparency.
          </p>
        </div>

        {/* Clean Vertical Timeline Sequence */}
        <div className="space-y-6">
          {phases.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === phases.length - 1;

            return (
              <div key={item.step} className="flex gap-4 sm:gap-5 items-stretch">
                
                {/* DEDICATED LEFT GUTTER: Circle Node + Vertical Line (Completely isolated from the card) */}
                <div className="flex flex-col items-center shrink-0 w-8 sm:w-10">
                  {/* Node Circle */}
                  <div className="size-8 sm:size-9 rounded-full bg-[#1A1816] border-2 border-[#e36a88] text-white flex items-center justify-center font-ds-mono text-xs font-bold shadow-[0_0_14px_rgba(227,106,136,0.5)] shrink-0 z-10">
                    {item.step}
                  </div>

                  {/* Continuous Connecting Line to next node */}
                  {!isLast && (
                    <div className="w-[2px] flex-1 bg-gradient-to-b from-[#e36a88] via-[#5F1F2F] to-[#5F1F2F]/40 my-1.5" />
                  )}
                </div>

                {/* DEDICATED RIGHT GUTTER: Phase Content Card (Clean separation, zero overlap) */}
                <div className="flex-1 pb-4 min-w-0">
                  <div className="rounded-2xl border border-white/10 bg-[#1A1816]/90 p-5 backdrop-blur-xl shadow-lg">
                    
                    {/* Tag + Timeframe */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-ds-mono uppercase tracking-wider bg-[#5F1F2F]/25 text-[#f3a6b7] border border-[#5F1F2F]/40">
                        {item.tag}
                      </span>
                      <span className="text-xs font-ds-mono text-gray-400 flex items-center gap-1">
                        <Clock size={11} className="text-[#f3a6b7]" />
                        <span>{item.timeframe}</span>
                      </span>
                    </div>

                    {/* Icon + Title */}
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="size-8 rounded-lg bg-[#5F1F2F]/30 border border-[#5F1F2F]/50 flex items-center justify-center text-[#f3a6b7] shrink-0">
                        <Icon size={15} />
                      </div>
                      <h3 className="font-ds-display text-base sm:text-lg font-bold text-white tracking-tight">
                        {item.title}
                      </h3>
                    </div>

                    <p className="text-xs sm:text-sm text-gray-300 font-light leading-relaxed mb-3">
                      {item.summary}
                    </p>

                    {/* Business Value */}
                    <div className="mb-3 p-2.5 rounded-xl bg-black/40 border border-[#5F1F2F]/30 text-xs text-gray-200">
                      <span className="text-[10px] font-ds-mono uppercase tracking-wider text-[#f3a6b7] block font-semibold mb-0.5">
                        Business Outcome:
                      </span>
                      {item.businessOutcome}
                    </div>

                    {/* Deliverables List */}
                    <div className="pt-3 border-t border-white/[0.08] space-y-1.5">
                      <span className="text-[10px] font-ds-mono uppercase tracking-wider text-gray-400 block font-semibold">
                        Key Deliverables:
                      </span>
                      {item.deliverables.map((deliv, dIdx) => (
                        <div key={dIdx} className="flex items-center gap-2 text-xs text-gray-300">
                          <CheckCircle2 size={12} className="text-[#e36a88] shrink-0" />
                          <span className="truncate">{deliv}</span>
                        </div>
                      ))}
                    </div>

                    {/* Client Touchpoint */}
                    <div className="mt-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-gray-300">
                      <span className="font-ds-mono text-[#f3a6b7] block text-[10px] uppercase">
                        Client Touchpoint:
                      </span>
                      {item.touchpoint}
                    </div>

                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {/* Mobile CTA */}
        <div className="mt-10 p-5 rounded-2xl border border-white/10 bg-[#1A1816] text-center">
          <h3 className="font-ds-display text-lg font-bold text-white mb-1.5">
            Ready to start Phase 01?
          </h3>
          <p className="text-xs text-gray-400 font-light mb-4">
            Book a 30-minute scoping call to map out your architecture.
          </p>
          <Link
            href="/schedule-demo"
            className="ts-btn-primary w-full py-2.5 text-xs font-medium inline-flex items-center justify-center gap-1.5"
          >
            <span>Schedule Discovery Call</span>
            <CustomArrowRight size={13} />
          </Link>
        </div>

      </div>
    </section>
  );
}

export default Section3;
