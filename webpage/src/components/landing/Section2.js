'use client';

import React from 'react';
import { motion } from 'framer-motion';
import LandingCard from '@/components/LandingCard';

const services = [
  {
    tag: 'Engineering',
    title: 'Custom Software Development',
    description:
      'We architect and build tailored web, desktop, and mobile applications engineered to handle 10x spikes in transaction throughput and concurrent users without latency degradation or system downtime.',
  },
  {
    tag: 'Operations',
    title: 'Intelligent Process Automation',
    description:
      'We automate repetitive operational workflows and back-office pipelines, reducing data-entry errors by over 90% and freeing your core staff for high-value client work.',
  },
  {
    tag: 'Intelligence',
    title: 'Data Analytics & Business Intelligence',
    description:
      'We aggregate data from disparate ERPs and payment processors into unified, real-time executive dashboards that provide sub-second reporting and cash-flow visibility.',
  },
  {
    tag: 'Infrastructure',
    title: 'Cloud Infrastructure & DevOps',
    description:
      'We architect, automate, and monitor containerized cloud environments on GCP and AWS, maintaining 99.95% uptime SLA while reducing unnecessary cloud spend.',
  },
  {
    tag: 'Modernization',
    title: 'Legacy System Modernisation',
    description:
      'We refactor brittle codebases and migrate on-prem databases to modern cloud architectures, slashing query times by up to 70% and exposing documented REST/GraphQL APIs with zero cutover downtime.',
  },
  {
    tag: 'AI Integration',
    title: 'AI & Machine Learning Integration',
    description:
      'We embed domain-specific LLM pipelines, automated document extraction, and predictive scoring directly into your existing business tools with strict privacy guardrails.',
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