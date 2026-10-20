'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { CustomWorkflow, CustomShield, CustomMetrics, CustomCheck } from '@/components/icons/CustomIcons';

function Section4() {
  return (
    <section className="relative w-full py-24 sm:py-32 overflow-hidden bg-[#1A1816]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-4">
            <span className="size-1.5 rounded-full bg-[#e36a88]" />
            <span>Operational Excellence · Proven Systems</span>
          </div>

          <h2 className="font-ds-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.12]">
            Purpose-built operational software that replaces manual friction with precision
          </h2>

          <p className="mt-4 text-base sm:text-lg text-gray-400 font-light leading-relaxed">
            From clinical diagnostics and inventory logistics to back-office workflows, we build dedicated software systems tailored to your exact operational procedures, keeping your team focused on delivering high-quality outcomes.
          </p>
        </motion.div>

        {/* Lead Showcase: Laboratory Management & Inventory Automation */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative rounded-3xl border border-white/10 bg-[#181816]/95 backdrop-blur-xl p-6 sm:p-10 mb-12 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.08)] overflow-hidden"
        >
          {/* Top hairline accent */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#5F1F2F] to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Column: Business Value, Real Numbers, and Client Quote */}
            <div className="lg:col-span-7 flex flex-col items-start">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/50 font-ds-mono text-xs uppercase tracking-wider mb-4">
                <CustomWorkflow size={14} className="text-[#e36a88]" />
                <span>Featured Solution · Laboratory &amp; Inventory Systems</span>
              </div>

              <h3 className="font-ds-display text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
                Custom Laboratory Management &amp; Real-Time Inventory Tracking
              </h3>

              <p className="mt-3 text-sm sm:text-base text-gray-300 font-light leading-relaxed">
                Medical diagnostics and operational facilities face constant challenges tracking patient specimens, managing diagnostic queues, monitoring cold-chain reagent stocks, and generating timely reports. We architect and deploy unified Laboratory Management Systems (LIMS) and smart inventory tracking that streamline the entire lifecycle—from sample accessioning to automated stock replenishment.
              </p>

              {/* Business Numbers Grid */}
              <div className="mt-6 grid grid-cols-3 gap-4 w-full py-5 border-y border-white/[0.08]">
                <div>
                  <div className="font-ds-display text-2xl sm:text-3xl font-extrabold text-white">74%</div>
                  <div className="font-ds-mono text-[11px] text-[#f3a6b7] uppercase mt-0.5">Faster Turnaround</div>
                  <p className="text-[11px] text-gray-400 mt-0.5">Sample intake to verified report</p>
                </div>
                <div>
                  <div className="font-ds-display text-2xl sm:text-3xl font-extrabold text-white">Zero</div>
                  <div className="font-ds-mono text-[11px] text-[#f3a6b7] uppercase mt-0.5">Stockout Incidents</div>
                  <p className="text-[11px] text-gray-400 mt-0.5">Automated reorder alerts</p>
                </div>
                <div>
                  <div className="font-ds-display text-2xl sm:text-3xl font-extrabold text-white">100%</div>
                  <div className="font-ds-mono text-[11px] text-[#f3a6b7] uppercase mt-0.5">Chain of Custody</div>
                  <p className="text-[11px] text-gray-400 mt-0.5">Zero manual transcription loss</p>
                </div>
              </div>

              {/* Client Quote / Real-World Results */}
              <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] relative">
                <p className="text-xs sm:text-sm text-[#F1F1F0]/90 italic leading-relaxed">
                  &ldquo;Before Thea engineered our laboratory management and inventory platform, our coordinators spent hours manually transcribing analyzer printouts into spreadsheets and checking cold-chain reagent stocks. The new system unified our entire workflow—diagnostic test turnaround dropped from 2 days to under 3 hours, and reagent wastage was reduced by 35%.&rdquo;
                </p>
                <div className="mt-3 flex items-center justify-between text-xs font-ds-mono">
                  <span className="text-white font-medium">Head of Clinical Operations</span>
                  <span className="text-gray-400">Diagnostic Laboratory Network</span>
                </div>
              </div>
            </div>

            {/* Right Column: Clean, Professional Business Workflow Display */}
            <div className="lg:col-span-5 w-full">
              <div className="rounded-2xl border border-white/10 bg-[#141312] p-5 sm:p-6 shadow-2xl">
                
                {/* Header bar */}
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-emerald-400" />
                    <span className="font-ds-display text-sm font-semibold text-white">
                      Laboratory Operations Console
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 font-ds-mono text-[10px] tracking-wider uppercase">
                    Active Facility
                  </span>
                </div>

                {/* Operations Steps */}
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-white text-xs font-semibold">
                        <CustomCheck size={13} className="text-emerald-400 shrink-0" />
                        <span>01. Specimen Intake &amp; Barcode Accession</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                        Automatic patient registration, test requisition matching, and barcode label generation.
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/[0.06] text-gray-300 font-ds-mono text-[10px] shrink-0">
                      Verified
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-white text-xs font-semibold">
                        <CustomCheck size={13} className="text-emerald-400 shrink-0" />
                        <span>02. Diagnostic Analyzer Integration</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                        Direct digital capture from laboratory analyzers eliminates manual paper transcription.
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/[0.06] text-gray-300 font-ds-mono text-[10px] shrink-0">
                      Processed
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-white text-xs font-semibold">
                        <CustomCheck size={13} className="text-emerald-400 shrink-0" />
                        <span>03. Doctor Review &amp; Report Release</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                        Reference-range verification alerts, pathologist sign-off, and instant patient delivery via SMS &amp; portal.
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/[0.06] text-gray-300 font-ds-mono text-[10px] shrink-0">
                      Approved
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#5F1F2F]/20 border border-[#5F1F2F]/40 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[#f3a6b7] text-xs font-semibold">
                        <CustomCheck size={13} className="text-[#f3a6b7] shrink-0" />
                        <span>04. Smart Reagent &amp; Inventory Sync</span>
                      </div>
                      <p className="text-gray-300 text-xs mt-1 leading-relaxed">
                        Consumables automatically deducted per test with automated low-stock and expiry warnings.
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#5F1F2F]/40 text-[#f3a6b7] font-ds-mono text-[10px] shrink-0">
                      Stock Updated
                    </span>
                  </div>
                </div>

                {/* Footer operational summary */}
                <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between text-xs font-ds-mono text-gray-400">
                  <span>Daily volume: 850+ patient panels</span>
                  <span className="text-emerald-400 font-medium">Reagent loss down 35%</span>
                </div>

              </div>
            </div>

          </div>
        </motion.div>

        {/* Strategic Partnership, Code Ownership & Ongoing SLA Retainers */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="rounded-3xl border border-white/10 bg-[#181816]/95 backdrop-blur-xl p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.08)] overflow-hidden"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Column: Handshake Visual with Floating SLA Badge */}
            <div className="lg:col-span-5 relative order-2 lg:order-1">
              <div className="relative rounded-2xl border border-white/10 bg-[#141312] p-2.5 sm:p-3 shadow-2xl overflow-hidden">
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                  <Image 
                    src="/assets/images/section4.jpg" 
                    alt="Strategic Client Partnership & Handshake Agreement" 
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="w-full h-full object-cover contrast-110"
                  />
                  {/* Subtle dark vignette matching site theme */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141312] via-transparent to-transparent opacity-85" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#141312]/70 via-transparent to-transparent" />
                </div>

                {/* Floating Monospace SLA & Partnership Badge */}
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-5 sm:left-5 sm:right-5 rounded-xl bg-[#1A1816]/95 backdrop-blur-xl border border-white/15 p-4 shadow-2xl">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-ds-mono text-[11px] uppercase tracking-wider text-emerald-300">
                      Long-Term Alignment
                    </span>
                  </div>
                  <p className="font-ds-display text-xs sm:text-sm font-semibold text-white leading-snug">
                    Complete code ownership transferred to you, backed by dedicated SLA maintenance retainers.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Clear Explanations of Ownership, SLA Support, and Scalability */}
            <div className="lg:col-span-7 flex flex-col items-start order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/50 font-ds-mono text-xs uppercase tracking-wider mb-4">
                <CustomShield size={14} className="text-[#e36a88]" />
                <span>Strategic Partnership · Ownership &amp; SLA Retainers</span>
              </div>

              <h3 className="font-ds-display text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
                100% Client Code Ownership with Dedicated Ongoing SLA Support
              </h3>

              <p className="mt-3 text-sm sm:text-base text-gray-300 font-light leading-relaxed">
                We believe your operational software is a strategic asset that belongs exclusively to your business. You receive full intellectual property ownership of your codebase, while retaining the security of guaranteed Service Level Agreements (SLAs) for ongoing maintenance, uptime monitoring, and proactive support.
              </p>

              {/* 3 Value Rows */}
              <div className="mt-6 space-y-3.5 w-full">
                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                  <div className="h-9 w-9 rounded-lg bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center shrink-0 mt-0.5">
                    <CustomCheck size={16} />
                  </div>
                  <div>
                    <h4 className="font-ds-display text-sm font-semibold text-white">
                      100% Code &amp; IP Ownership
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                      You own the full copyright to all source code, database architectures, and deployment configurations. Zero recurring per-seat SaaS license fees or vendor lock-in traps.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                  <div className="h-9 w-9 rounded-lg bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center shrink-0 mt-0.5">
                    <CustomShield size={16} />
                  </div>
                  <div>
                    <h4 className="font-ds-display text-sm font-semibold text-white">
                      Dedicated SLA &amp; Maintenance Support
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                      Enjoy peace of mind with tailored Service Level Agreements: 99.95% uptime guarantees, 24/7 infrastructure monitoring, security updates, and rapid on-call technical support.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                  <div className="h-9 w-9 rounded-lg bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/40 flex items-center justify-center shrink-0 mt-0.5">
                    <CustomMetrics size={16} />
                  </div>
                  <div>
                    <h4 className="font-ds-display text-sm font-semibold text-white">
                      10x Operational Throughput on Stable Headcount
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                      Scale order volumes and sample processing without proportional administrative hiring, boosting operational gross margins by 20–35%.
                    </p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}

export default Section4;