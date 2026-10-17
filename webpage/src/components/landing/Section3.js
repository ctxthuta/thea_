'use client';

import React from 'react';
import { motion } from 'framer-motion';
import LandingCard from '@/components/LandingCard';

const howWeDoIt = [
  {
    step: '01',
    tag: 'Discovery',
    title: 'Discovery & Strategy',
    description:
      'We analyze your workflows, interview key stakeholders, and define a clear technical roadmap aligned directly with your revenue and efficiency targets.',
  },
  {
    step: '02',
    tag: 'Prototyping',
    title: 'Design & Previews',
    description:
      'We create clickable, interactive design prototypes and architectural diagrams so you can validate UX, data flow, and features before code is written.',
  },
  {
    step: '03',
    tag: 'Execution',
    title: 'Building in 2-Week Sprints',
    description:
      'We engineer your solution in focused 2-week agile sprints with bi-weekly demo check-ins, giving you complete visibility and zero hidden surprises.',
  },
  {
    step: '04',
    tag: 'Quality',
    title: 'Testing & Hardening',
    description:
      'We execute comprehensive automated testing, performance stress tests, and security audits to guarantee rock-solid stability and data protection.',
  },
  {
    step: '05',
    tag: 'Deployment',
    title: 'Smooth Production Launch',
    description:
      'We manage the zero-downtime cutover and data migration with built-in rollback safeguards and real-time observability from minute one.',
  },
  {
    step: '06',
    tag: 'Evolution',
    title: 'Continuous Evolution',
    description:
      'We provide dedicated SLA support, proactive cloud monitoring, and iterative feature development to ensure your software scales as your business grows.',
  },
];

function Section3() {
  return (
    <section className="relative w-full py-24 sm:py-32 overflow-hidden bg-[#181816]/50 border-y border-white/[0.06]">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-[#5F1F2F]/12 rounded-full blur-[220px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-start mb-12 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-4">
            <span className="size-1.5 rounded-full bg-[#e36a88]" />
            <span>Methodology · How We Do It</span>
          </div>

          <h2 className="font-ds-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white max-w-3xl leading-[1.12]">
            A proven, predictable path from vision to production
          </h2>

          <p className="mt-4 text-base sm:text-lg text-gray-400 font-light max-w-2xl leading-relaxed">
            We combine remote-first collaboration, agile delivery, and deep technical expertise to turn complex challenges into reliable, high-ROI solutions — with your business outcomes at the center.
          </p>
        </motion.div>

        {/* Process Step Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {howWeDoIt.map((step, index) => (
            <LandingCard
              key={index}
              step={`PHASE ${step.step}`}
              tag={step.tag}
              title={step.title}
              description={step.description}
              actionText="Phase details"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Section3;