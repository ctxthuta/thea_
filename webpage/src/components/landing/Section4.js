'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, ShieldCheck, TrendingUp, Check } from 'lucide-react';

function Section4() {
  return (
    <section className="relative w-full py-24 sm:py-32 overflow-hidden bg-[#1A1816]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center"
        >
          {/* Left Column: Text & Strategic Value Pillars */}
          <div className="lg:col-span-6 flex flex-col items-start">
            
            {/* TanStack DS Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-4">
              <span className="size-1.5 rounded-full bg-[#e36a88]" />
              <span>Why Partner With Us · Strategic Value</span>
            </div>

            {/* Display Headline */}
            <h2 className="font-ds-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.12]">
              Build a robust foundation for future scale through bespoke software &amp; AI
            </h2>

            {/* Lead Narrative */}
            <p className="mt-5 text-base sm:text-lg text-gray-400 font-light leading-relaxed">
              Our mission focuses on providing growing businesses with custom software, optimized workflows, and intelligent automation to eliminate manual bottlenecks and maintain a lasting competitive advantage.
            </p>

            {/* 3 Pillar Cards in TanStack DS Style */}
            <div className="mt-8 space-y-3.5 w-full">
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="h-8 w-8 rounded-lg bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap size={16} />
                </div>
                <div>
                  <h3 className="font-ds-display text-base font-semibold text-white">
                    Intelligent Operational Automation
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5 leading-relaxed">
                    Eliminate error-prone spreadsheets, disconnected SaaS silos, and repetitive manual routines across your departments.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="h-8 w-8 rounded-lg bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h3 className="font-ds-display text-base font-semibold text-white">
                    Precision Tailored Architecture
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5 leading-relaxed">
                    Engineered precisely to match your unique business processes, rather than forcing you into rigid off-the-shelf software compromises.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="h-8 w-8 rounded-lg bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <h3 className="font-ds-display text-base font-semibold text-white">
                    Built to Scale with High Margins
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5 leading-relaxed">
                    Expand transaction volumes 10x without proportional headcount growth, unlocking superior gross margins and business valuation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Frame */}
          <div className="lg:col-span-6 relative">
            <div className="relative rounded-2xl border border-white/10 bg-[#181816]/90 p-2 sm:p-3 shadow-2xl shadow-black/70 overflow-hidden">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <img 
                  src="/assets/images/section4.jpg" 
                  alt="Thea Solutions Technology Engineering" 
                  width={800}
                  height={600}
                  loading="lazy"
                  className="w-full h-full object-cover contrast-115"
                />
                {/* Subtle gradient vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#181816] via-transparent to-transparent opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#181816]/70 via-transparent to-transparent" />
              </div>

              {/* Floating Monospace Stat Badge */}
              <div className="absolute bottom-5 left-5 right-5 sm:right-auto sm:max-w-sm rounded-xl bg-[#1A1816]/95 backdrop-blur-xl border border-white/15 p-4 shadow-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-ds-mono text-[11px] uppercase tracking-wider text-emerald-300">
                    SME Scaling Benchmark
                  </span>
                </div>
                <p className="font-ds-display text-sm font-semibold text-white leading-snug">
                  40–60% reduction in manual administrative overhead within 90 days of rollout.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default Section4;