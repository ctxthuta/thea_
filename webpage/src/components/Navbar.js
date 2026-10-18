'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Instagram, Linkedin, Menu, X, ArrowUpRight } from 'lucide-react';

function TikTokIcon({ size = 18, className = '' }) {
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

function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 px-3 sm:px-6 pt-3 pointer-events-none">
      <div className="max-w-7xl mx-auto pointer-events-auto">
        <div className="h-[60px] px-4 sm:px-6 flex items-center justify-between rounded-2xl bg-[#1A1816]/85 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <img 
              src="/dark_tranStacked_logo.png" 
              alt="Thea Solutions" 
              className="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-[1.02]" 
            />
          </Link>

          {/* Desktop Nav Links (TanStack DS Pill Items) */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1 lg:gap-1.5">
            <Link 
              href="/#about" 
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
              href="/#faqs" 
              className="px-3 py-1.5 text-[13px] font-medium text-[#F1F1F0]/75 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              FAQ
            </Link>
            <Link 
              href="/#contact" 
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
                <Linkedin size={18} />
              </Link>
              <Link 
                href="https://www.tiktok.com/@theasolutions_?_r=1&_t=ZS-980MdkL0X9J" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="TikTok"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F1F1F0]/65 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <TikTokIcon size={18} />
              </Link>
              <Link 
                href="https://www.instagram.com/theasolutions_?igsh=ODc3ZmFrN2tkbDYw" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="Instagram"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F1F1F0]/65 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <Instagram size={18} />
              </Link>
            </div>

            <Link 
              href="/#contact"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold bg-[#F1F1F0] text-[#1A1816] hover:bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.35)] hover:-translate-y-px hover:shadow-[0_4px_14px_-2px_rgba(241,241,240,0.25)] active:translate-y-0 transition-all"
            >
              <span>Get a Quote</span>
              <ArrowUpRight size={14} />
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
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 rounded-2xl bg-[#1A1816]/95 backdrop-blur-2xl border border-white/10 p-4 shadow-2xl shadow-black/80 space-y-1">
            <Link 
              href="/#about" 
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
              href="/#faqs" 
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-[#F1F1F0]/85 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              FAQ
            </Link>
            <Link 
              href="/#contact" 
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
              <span className="font-ds-mono text-xs text-gray-400 uppercase tracking-wider">Follow Us</span>
              <div className="flex gap-2">
                <Link 
                  href="https://www.linkedin.com/company/theasolutionss" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F1F1F0]/70 hover:text-white hover:bg-white/[0.08]"
                >
                  <Linkedin size={18} />
                </Link>
                <Link 
                  href="https://www.tiktok.com/@theasolutions_?_r=1&_t=ZS-980MdkL0X9J" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F1F1F0]/70 hover:text-white hover:bg-white/[0.08]"
                >
                  <TikTokIcon size={18} />
                </Link>
                <Link 
                  href="https://www.instagram.com/theasolutions_?igsh=ODc3ZmFrN2tkbDYw" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-[#F1F1F0]/70 hover:text-white hover:bg-white/[0.08]"
                >
                  <Instagram size={18} />
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
