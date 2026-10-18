'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  CustomLinkedIn, 
  CustomInstagram, 
  CustomTikTok, 
  CustomMenu, 
  CustomClose, 
  CustomArrowUpRight 
} from '@/components/icons/CustomIcons';

function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 px-3 sm:px-6 pt-3 pointer-events-none">
      <div className="max-w-7xl mx-auto pointer-events-auto">
        <div className="h-[60px] px-4 sm:px-6 flex items-center justify-between rounded-2xl bg-[#1A1816]/85 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0" aria-label="Thea Solutions Home">
            <img 
              src="/dark_tranStacked_logo.png" 
              alt="Thea Solutions" 
              width={200}
              height={50}
              className="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-[1.02]" 
            />
          </Link>

          {/* Desktop Nav Links (TanStack DS Pill Items) */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1 lg:gap-1.5">
            <Link 
              href="/about" 
              className="px-3 py-1.5 text-[13px] font-medium text-[#F1F1F0]/75 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              About
            </Link>
            <Link 
              href="/#services" 
              className="px-3 py-1.5 text-[13px] font-medium text-[#F1F1F0]/75 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              Services
            </Link>
            <Link 
              href="/pricing" 
              className="px-3 py-1.5 text-[13px] font-medium text-[#F1F1F0]/75 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              Pricing
            </Link>
            <Link 
              href="/#faqs" 
              className="px-3 py-1.5 text-[13px] font-medium text-[#F1F1F0]/75 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              FAQ
            </Link>
            <Link 
              href="/contact" 
              className="px-3 py-1.5 text-[13px] font-medium text-[#F1F1F0]/75 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              Contact
            </Link>
            <Link 
              href="/careers" 
              className="px-3 py-1.5 text-[13px] font-medium text-[#F1F1F0]/75 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors inline-flex items-center gap-1"
            >
              <span>Careers</span>
              <span className="font-ds-mono text-[10px] px-1.5 py-0.2 rounded-full bg-[#5F1F2F]/40 text-[#f3a6b7] border border-[#5F1F2F]/50">
                Hiring
              </span>
            </Link>
          </nav>

          {/* Right Actions & Socials */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1 border-r border-white/10 pr-3">
              <Link 
                href="https://www.linkedin.com/company/theasolutionss" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="LinkedIn"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F1F1F0]/65 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <CustomLinkedIn size={17} />
              </Link>
              <Link 
                href="https://www.tiktok.com/@theasolutions.co?_r=1&_t=ZS-980MdkL0X9J" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="TikTok"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F1F1F0]/65 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <CustomTikTok size={17} />
              </Link>
              <Link 
                href="https://www.instagram.com/theasolutions_?igsh=ODc3ZmFrN2tkbDYw" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="Instagram"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F1F1F0]/65 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <CustomInstagram size={17} />
              </Link>
            </div>

            <Link 
              href="/#contact"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold bg-[#F1F1F0] text-[#1A1816] hover:bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.35)] hover:-translate-y-px hover:shadow-[0_4px_14px_-2px_rgba(241,241,240,0.25)] active:translate-y-0 transition-all"
            >
              <span>Get a Quote</span>
              <CustomArrowUpRight size={14} />
            </Link>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
            <Link 
              href="/#contact"
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold bg-[#F1F1F0] text-[#1A1816]"
            >
              Quote
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-[#F1F1F0] hover:bg-white/[0.1] transition-colors"
            >
              {mobileMenuOpen ? <CustomClose size={18} /> : <CustomMenu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 rounded-2xl bg-[#1A1816]/95 backdrop-blur-2xl border border-white/10 p-4 shadow-2xl shadow-black/80 space-y-1">
            <Link 
              href="/about" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-[#F1F1F0]/85 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              About
            </Link>
            <Link 
              href="/#services" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-[#F1F1F0]/85 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              Services
            </Link>
            <Link 
              href="/pricing" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-[#F1F1F0]/85 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              Pricing
            </Link>
            <Link 
              href="/#faqs" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-[#F1F1F0]/85 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              FAQ
            </Link>
            <Link 
              href="/contact" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-[#F1F1F0]/85 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              Contact
            </Link>
            <Link 
              href="/careers" 
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-sm font-medium text-[#F1F1F0]/85 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              <span>Careers</span>
              <span className="font-ds-mono text-[10px] px-1.5 py-0.5 rounded-full bg-[#5F1F2F]/40 text-[#f3a6b7]">Hiring</span>
            </Link>

            <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between px-2">
              <span className="font-ds-mono text-xs text-gray-400 uppercase tracking-wider">Connect</span>
              <div className="flex gap-2">
                <Link 
                  href="https://www.linkedin.com/company/theasolutionss" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  aria-label="LinkedIn"
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F1F1F0]/70 hover:text-white hover:bg-white/[0.08]"
                >
                  <CustomLinkedIn size={17} />
                </Link>
                <Link 
                  href="https://www.tiktok.com/@theasolutions.co?_r=1&_t=ZS-980MdkL0X9J" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  aria-label="TikTok"
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F1F1F0]/70 hover:text-white hover:bg-white/[0.08]"
                >
                  <CustomTikTok size={17} />
                </Link>
                <Link 
                  href="https://www.instagram.com/theasolutions_?igsh=ODc3ZmFrN2tkbDYw" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  aria-label="Instagram"
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F1F1F0]/70 hover:text-white hover:bg-white/[0.08]"
                >
                  <CustomInstagram size={17} />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;
