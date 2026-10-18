import React from 'react';
import { CustomArrowRight } from '@/components/icons/CustomIcons';

function LandingCard({ 
  title, 
  description, 
  tag = '', 
  step = '',
  actionText = 'Learn more'
}) {
  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#181816]/75 backdrop-blur-xl p-6 sm:p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.4)] hover:border-[#5F1F2F]/70 hover:-translate-y-1.5 hover:shadow-[0_16px_36px_-6px_rgba(95,31,47,0.35),inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-300 overflow-hidden">
      
      {/* Top subtle hairline glow on hover */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#5F1F2F] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div>
        {/* Monospace Eyebrow / Step Indicator */}
        {(tag || step) && (
          <div className="mb-4 flex items-center justify-between">
            {tag && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-ds-mono uppercase tracking-wider bg-[#5F1F2F]/20 text-[#f3a6b7] border border-[#5F1F2F]/30">
                {tag}
              </span>
            )}
            {step && (
              <span className="font-ds-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-white/[0.05] text-[#F1F1F0]/60 border border-white/10">
                {step}
              </span>
            )}
          </div>
        )}

        {/* Title in TanStack Bricolage Grotesque Display font */}
        <h3 className="font-ds-display text-lg sm:text-xl font-bold text-white tracking-tight group-hover:text-white transition-colors">
          {title}
        </h3>

        {/* Description in readable body copy */}
        <p className="mt-3 text-sm sm:text-[15px] leading-relaxed text-[#F1F1F0]/75 font-light">
          {description}
        </p>
      </div>

      {/* Subtle Link / Footer Affordance */}
      <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
        <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] inline-flex items-center gap-1.5 transition-colors">
          <span>{actionText}</span>
          <CustomArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
        </span>
        <span className="size-1.5 rounded-full bg-[#5F1F2F] opacity-40 group-hover:opacity-100 group-hover:scale-125 transition-all" />
      </div>
    </div>
  );
}

export default LandingCard;