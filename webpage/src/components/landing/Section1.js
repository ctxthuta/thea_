'use client';

import React, { useState } from 'react';
import { CustomCheckCircle, CustomSparkles, CustomSend } from '@/components/icons/CustomIcons';

function Section1() {
  const [formData, setFormData] = useState({
    email: '',
    phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitMessage('We will reach out to you soon!');
        setFormData({ email: '', phone: '' });
      } else {
        setSubmitMessage('Failed to submit. Please try again.');
      }
    } catch (error) {
      setSubmitMessage('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <section id="about" className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-[#1A1816]">
      {/* Background Video with TanStack style dark depth gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <video 
          className="w-full h-full object-cover brightness-[0.45] contrast-125 scale-105" 
          autoPlay 
          loop 
          muted 
          playsInline
          aria-hidden="true"
        >
          <source src="/assets/videos/LandingBG.webm" type="video/webm" />
          <track kind="captions" src="/assets/captions.vtt" srcLang="en" label="Ambient background video" default />
        </video>
        {/* Subtle Brand Ambient Glows */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#5F1F2F]/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A1816]/70 via-[#1A1816]/60 to-[#1A1816]" />
      </div>

      {/* Main Hero Container */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-28 sm:pt-36 lg:pt-40 pb-16 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Heading & Mission */}
          <div className="lg:col-span-7 flex flex-col items-start">
            
            {/* TanStack DS Monospace Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#5F1F2F]/50 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-6 shadow-sm">
              <span className="size-2 rounded-full bg-[#e36a88] animate-pulse" />
              <span>Bespoke Software · Enterprise AI · Automation</span>
            </div>

            {/* Display Heading with TanStack typography & highlight */}
            <h1 className="font-ds-display text-3xl sm:text-5xl lg:text-[54px] font-extrabold tracking-[-0.03em] leading-[1.08] text-white">
              Bridge the gap between{' '}
              <span className="relative text-white underline decoration-[#5F1F2F] decoration-[4px] underline-offset-[8px]">
                complex technology
              </span>{' '}
              and your growing business
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-base sm:text-lg text-[#F1F1F0]/80 leading-relaxed font-light max-w-2xl">
              At Thea Solutions, we specialize in bespoke software development, enterprise-grade AI, and automation solutions engineered specifically for SMEs to streamline operations and scale with confidence.
            </p>

            {/* Feature Pills (TanStack DS Badges) */}
            <div className="mt-8 flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-ds-mono bg-white/[0.04] text-[#F1F1F0]/85 border border-white/10">
                <CustomCheckCircle size={13} className="text-[#e36a88]" />
                Remote-First Elite Engineers
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-ds-mono bg-white/[0.04] text-[#F1F1F0]/85 border border-white/10">
                <CustomCheckCircle size={13} className="text-[#e36a88]" />
                2-Week Agile Delivery Cycles
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-ds-mono bg-white/[0.04] text-[#F1F1F0]/85 border border-white/10">
                <CustomCheckCircle size={13} className="text-[#e36a88]" />
                Full IP &amp; Code Ownership
              </span>
            </div>
          </div>

          {/* Right Column: Hero Contact Card (TanStack DS Card Surface) */}
          <div className="lg:col-span-5 w-full">
            <div className="relative rounded-2xl border border-white/10 bg-[#181816]/80 backdrop-blur-xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.08)] overflow-hidden">
              {/* Top Accent Gradient Line */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#5F1F2F] to-transparent opacity-80" />

              <div className="mb-5">
                <span className="inline-flex items-center gap-1.5 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7]">
                  <CustomSparkles size={13} className="text-[#e36a88]" />
                  Direct Consultation
                </span>
                <h2 className="font-ds-display text-xl font-bold text-white mt-1">
                  Start Your Transformation
                </h2>
                <p className="text-xs sm:text-sm text-gray-300 mt-1">
                  Leave your email or phone, our solution architects will contact you within 24 hours.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label htmlFor="hero-email" className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-300 mb-1.5">
                      Email Address *
                    </label>
                    <input 
                      id="hero-email"
                      className="w-full rounded-xl bg-[#121110] border border-white/10 px-3.5 py-2.5 text-sm text-[#F1F1F0] placeholder:text-gray-400 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all" 
                      type="email" 
                      name="email"
                      aria-label="Email Address"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="name@business.com" 
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="hero-phone" className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-300 mb-1.5">
                      Phone (Optional)
                    </label>
                    <input 
                      id="hero-phone"
                      className="w-full rounded-xl bg-[#121110] border border-white/10 px-3.5 py-2.5 text-sm text-[#F1F1F0] placeholder:text-gray-400 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all" 
                      type="tel" 
                      name="phone"
                      aria-label="Phone Number"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+1 (555) 000-0000" 
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full py-3 px-5 text-sm font-semibold bg-[#F1F1F0] text-[#1A1816] hover:bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.2),inset_0_1px_0_0_rgba(255,255,255,0.4)] hover:-translate-y-px hover:shadow-[0_6px_20px_-4px_rgba(241,241,240,0.3)] active:translate-y-0 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <CustomSend size={15} />
                  <span>{isSubmitting ? 'Submitting...' : 'Request Consultation'}</span>
                </button>

                {submitMessage && (
                  <div className={`p-3 rounded-xl text-xs font-medium border ${
                    submitMessage.includes('soon') 
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
                      : 'bg-red-950/40 border-red-800/60 text-red-300'
                  }`}>
                    {submitMessage}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* TanStack DS Stats Section (/ds/stats pattern) */}
      <div className="border-t border-white/10 bg-[#141312]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div className="flex flex-col">
              <span className="font-ds-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">100%</span>
              <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mt-1">Remote-First Firm</span>
              <p className="text-xs text-gray-400 mt-0.5">Top-tier global engineering talent</p>
            </div>
            <div className="flex flex-col">
              <span className="font-ds-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">2-Week</span>
              <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mt-1">Sprint Cadence</span>
              <p className="text-xs text-gray-400 mt-0.5">Rapid prototypes &amp; transparent updates</p>
            </div>
            <div className="flex flex-col">
              <span className="font-ds-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Enterprise</span>
              <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mt-1">AI &amp; Automation</span>
              <p className="text-xs text-gray-400 mt-0.5">High-ROI workflows built for scale</p>
            </div>
            <div className="flex flex-col">
              <span className="font-ds-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Zero</span>
              <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mt-1">Vendor Lock-In</span>
              <p className="text-xs text-gray-400 mt-0.5">100% client-owned code &amp; IP</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Section1;