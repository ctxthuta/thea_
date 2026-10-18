'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Instagram, Linkedin, Mail, ArrowRight, Send, Heart } from 'lucide-react';

function TikTokIcon({ size = 20, className = '' }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  );
}

function Footer() {
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
    <footer className="relative w-full bg-[#141312] border-t border-white/10 pt-20 pb-12 overflow-hidden">
      {/* Ambient background wine plum light */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-[#5F1F2F]/10 rounded-full blur-[180px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top CTA Banner in TanStack DS Card Style */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative rounded-3xl border border-white/10 bg-[#181816]/90 backdrop-blur-xl p-8 sm:p-12 mb-20 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.08)] overflow-hidden"
        >
          {/* Top hairline accent */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#5F1F2F] to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 flex flex-col items-start">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-ds-mono text-xs uppercase tracking-wider bg-[#5F1F2F]/20 text-[#f3a6b7] border border-[#5F1F2F]/40 mb-3">
                Ready to Accelerate?
              </span>
              <h2 className="font-ds-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
                Don&apos;t wait — transform your business{' '}
                <span className="relative text-white underline decoration-[#5F1F2F] decoration-[3px] underline-offset-[6px]">
                  today
                </span>
              </h2>
              <p className="mt-3 text-sm sm:text-base text-gray-400 font-light max-w-xl">
                Partner with an agile, remote-first team of experts committed to building technology that moves your metrics.
              </p>
            </div>

            <div className="lg:col-span-5 w-full">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input 
                    id="footer-email"
                    className="flex-1 rounded-xl bg-[#121110] border border-white/10 px-4 py-2.5 text-sm text-[#F1F1F0] placeholder:text-gray-400 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all" 
                    type="email" 
                    name="email"
                    aria-label="Email address for updates"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email" 
                  />
                  <input 
                    id="footer-phone"
                    className="flex-1 rounded-xl bg-[#121110] border border-white/10 px-4 py-2.5 text-sm text-[#F1F1F0] placeholder:text-gray-400 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all" 
                    type="tel" 
                    name="phone"
                    aria-label="Phone number"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Phone (optional)" 
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full py-3 px-6 text-sm font-semibold bg-[#F1F1F0] text-[#1A1816] hover:bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.2),inset_0_1px_0_0_rgba(255,255,255,0.4)] hover:-translate-y-px hover:shadow-[0_6px_20px_-4px_rgba(241,241,240,0.3)] active:translate-y-0 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Send size={15} />
                  <span>{isSubmitting ? 'Sending...' : 'Connect With Us'}</span>
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
        </motion.div>

        {/* Bottom Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-16 border-b border-white/[0.08]">
          {/* Brand Info */}
          <div className="lg:col-span-2 flex flex-col items-start pr-6">
            <Link href="/" className="mb-4 inline-block">
              <img 
                src="/dark_tranStacked_logo.png" 
                alt="Thea Solutions" 
                width={200}
                height={50}
                className="h-10 w-auto object-contain" 
              />
            </Link>
            <p className="text-sm text-gray-400 font-light leading-relaxed max-w-sm">
              Engineering bespoke software systems, enterprise-grade AI integrations, and operational automation for ambitious SMEs worldwide.
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              <Link 
                href="https://www.linkedin.com/company/theasolutionss" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="LinkedIn"
                className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-[#F1F1F0]/70 hover:text-white hover:bg-white/[0.08] hover:border-[#5F1F2F]/60 transition-colors"
              >
                <Linkedin size={18} />
              </Link>
              <Link 
                href="https://www.tiktok.com/@theasolutions_?_r=1&_t=ZS-980MdkL0X9J" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="TikTok"
                className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-[#F1F1F0]/70 hover:text-white hover:bg-white/[0.08] hover:border-[#5F1F2F]/60 transition-colors"
              >
                <TikTokIcon size={18} />
              </Link>
              <Link 
                href="https://www.instagram.com/theasolutions_?igsh=ODc3ZmFrN2tkbDYw" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="Instagram"
                className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-[#F1F1F0]/70 hover:text-white hover:bg-white/[0.08] hover:border-[#5F1F2F]/60 transition-colors"
              >
                <Instagram size={18} />
              </Link>
            </div>
          </div>

          {/* Navigation Column */}
          <div className="flex flex-col items-start">
            <span className="font-ds-mono text-xs uppercase tracking-wider text-gray-400 mb-4 font-semibold">
              Navigation
            </span>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/#about" className="text-gray-400 hover:text-white transition-colors">
                  About Firm
                </Link>
              </li>
              <li>
                <Link href="/#services" className="text-gray-400 hover:text-white transition-colors">
                  Capabilities
                </Link>
              </li>
              <li>
                <Link href="/#faqs" className="text-gray-400 hover:text-white transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <Link href="/#contact" className="text-gray-400 hover:text-white transition-colors">
                  Get a Quote
                </Link>
              </li>
              <li>
                <Link href="/careers" className="text-gray-400 hover:text-white transition-colors inline-flex items-center gap-1.5">
                  <span>Careers</span>
                  <span className="font-ds-mono text-[9px] px-1 py-0.2 rounded-full bg-[#5F1F2F]/40 text-[#f3a6b7]">We&apos;re Hiring</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Capabilities Column */}
          <div className="flex flex-col items-start">
            <span className="font-ds-mono text-xs uppercase tracking-wider text-gray-400 mb-4 font-semibold">
              Capabilities
            </span>
            <ul className="space-y-2.5 text-sm text-gray-400 font-light">
              <li>Custom Software Development</li>
              <li>Intelligent Process Automation</li>
              <li>Enterprise AI &amp; ML</li>
              <li>Cloud &amp; DevOps Engineering</li>
              <li>Legacy Modernization</li>
            </ul>
          </div>

          {/* Contact Column */}
          <div className="flex flex-col items-start">
            <span className="font-ds-mono text-xs uppercase tracking-wider text-gray-400 mb-4 font-semibold">
              Inquiries
            </span>
            <div className="space-y-3 text-sm">
              <a 
                href="mailto:business@theasolutions.co" 
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <Mail size={16} className="text-[#f3a6b7] shrink-0" />
                <span className="truncate">business@theasolutions.co</span>
              </a>
              <a 
                href="mailto:sales@theasolutions.co" 
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <Mail size={16} className="text-[#f3a6b7] shrink-0" />
                <span className="truncate">sales@theasolutions.co</span>
              </a>
              <p className="font-ds-mono text-xs text-gray-400 pt-2">
                Remote-first · Operating globally
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Credits & Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-ds-mono text-gray-400">
          <p>© {new Date().getFullYear()} Thea Solutions. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <span>Engineered with precision for SMEs worldwide</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
