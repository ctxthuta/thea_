'use client';

import React from 'react';
import { motion } from 'framer-motion';
import LandingCard from '@/components/LandingCard';

const services = [
  {
    tag: 'Engineering',
    title: 'Custom Software Development',
    description:
      'We design and build bespoke web, desktop, and mobile applications that scale seamlessly as your business transaction volume and user base expand.',
  },
  {
    tag: 'Operations',
    title: 'Intelligent Process Automation',
    description:
      'We automate manual and routine operational tasks, reducing human error, eliminating bottlenecks, and freeing your team to focus on high-leverage growth.',
  },
  {
    tag: 'Intelligence',
    title: 'Data Analytics & Business Intelligence',
    description:
      'We transform fragmented business data into unified, real-time dashboards and predictive insights that guide faster, confident decisions.',
  },
  {
    tag: 'Infrastructure',
    title: 'Cloud Infrastructure & DevOps',
    description:
      'We architect, automate, and monitor your cloud environments on GCP and AWS so your operations stay resilient, highly available, and cost-optimized.',
  },
  {
    tag: 'Modernization',
    title: 'Legacy System Modernisation',
    description:
      'We safely re-engineer aging systems and databases, unlocking modern security, speed, and API connectivity without disrupting ongoing operations.',
  },
  {
    tag: 'AI Integration',
    title: 'AI & Machine Learning Integration',
    description:
      'We integrate custom LLMs, intelligent document processing, and predictive algorithms directly into your existing business workflows for tangible ROI.',
  },
];

function Section2() {
  return (
    <section id="services" className="relative w-full py-24 sm:py-32 overflow-hidden bg-[#1A1816]">
      {/* Ambient wine-plum glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#5F1F2F]/15 rounded-full blur-[200px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header in TanStack DS Style */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-start mb-12 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-4">
            <span className="size-1.5 rounded-full bg-[#e36a88]" />
            <span>Core Capabilities · What We Do</span>
          </div>

          <h2 className="font-ds-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white max-w-3xl leading-[1.12]">
            End-to-end technology solutions tailored to your business model
          </h2>

          <p className="mt-4 text-base sm:text-lg text-gray-400 font-light max-w-2xl leading-relaxed">
            Operating as a fully remote firm, our dedicated team of expert engineers, solution architects, and product designers delivers enterprise-quality technology accessible to growing businesses.
          </p>
        </motion.div>

        {/* Services Grid with TanStack DS Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {services.map((service, index) => (
            <LandingCard
              key={index}
              tag={service.tag}
              title={service.title}
              description={service.description}
              actionText="Explore capability"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Section2;