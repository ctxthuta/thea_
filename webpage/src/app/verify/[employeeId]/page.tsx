'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getEmployeeCardById, isCardValid, EmployeeCard } from '@/lib/employeeCardUtils';
import { CheckCircle2, AlertCircle, XCircle, Calendar, Mail, Building2, X } from 'lucide-react';
import mixpanel from 'mixpanel-browser';

export default function EmployeeVerification({ params }: { params: Promise<{ employeeId: string }> }) {
  const searchParams = useSearchParams();
  const [employee, setEmployee] = useState<EmployeeCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  useEffect(() => {
    params.then((resolvedParams) => {
      setEmployeeId(resolvedParams.employeeId);
    });
  }, [params]);

  useEffect(() => {
    if (!employeeId) return;

    const foundEmployee = getEmployeeCardById(employeeId);
    setEmployee(foundEmployee || null);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    if (!employee) return;

    const utmSource = searchParams.get('utm_source');
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');

    if (typeof window !== 'undefined') {
      const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

      if (MIXPANEL_TOKEN) {
        try {
          mixpanel.init(MIXPANEL_TOKEN, {
            autocapture: false,
            persistence: 'localStorage',
            ignore_dnt: false,
            track_pageview: false,
          });

          const cardValid = isCardValid(employee.cardExpirationDate);
          const eventProperties = {
            employee_id: employee.employeeId,
            employee_name: employee.name,
            employee_title: employee.title,
            employee_department: employee.department,
            card_expiration_date: employee.cardExpirationDate,
            is_verified: cardValid,
            verification_status: cardValid ? 'verified' : 'expired',
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
            is_qr_scan: utmMedium === 'employee-card',
            referrer: document.referrer || undefined,
            page_url: window.location.href,
            timestamp: new Date().toISOString(),
          };

          mixpanel.track('Employee Card Verification', eventProperties);

          if (utmMedium === 'employee-card') {
            mixpanel.track('QR Code Scanned', {
              ...eventProperties,
              scan_source: 'employee_card',
              employee_id: employee.employeeId,
              employee_name: employee.name,
            });
          }
        } catch (error) {
          console.error('Mixpanel verification tracking error:', error);
        }
      }
    }
  }, [employee, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1816]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#5F1F2F] border-t-transparent mx-auto"></div>
          <p className="mt-4 font-ds-mono text-xs uppercase tracking-wider text-gray-400">Verifying credential...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1816] px-6">
        <div className="text-center max-w-md">
          <XCircle className="h-12 w-12 text-[#5F1F2F] mx-auto mb-4" />
          <h1 className="font-ds-display text-2xl font-bold text-white mb-2">Employee Not Found</h1>
          <p className="text-sm text-gray-400 mb-6">The employee card could not be verified.</p>
          <Link 
            href="/"
            className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] hover:underline"
          >
            ← Return to home
          </Link>
        </div>
      </div>
    );
  }

  const cardValid = isCardValid(employee.cardExpirationDate);
  const expirationDate = new Date(employee.cardExpirationDate);
  const formattedExpiration = expirationDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#1A1816] text-[#F1F1F0] selection:bg-[#5F1F2F] selection:text-white">
      <div className="px-6 py-10 md:px-12 md:py-16">
        <div className="max-w-2xl mx-auto">
          
          {/* Minimal Header */}
          <div className="flex items-center justify-between mb-12">
            <Link 
              href="/" 
              className="font-ds-mono text-xs uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
            >
              Thea Solutions
            </Link>
            <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7]">
              via employee card
            </span>
          </div>

          {/* Verification Status Banner */}
          <div className={`mb-10 p-6 rounded-2xl ${
            cardValid ? 'bg-[#5F1F2F] text-white' : 'bg-[#8B2F3F] text-white'
          }`}>
            <div className="flex items-start gap-4">
              {cardValid ? (
                <CheckCircle2 className="h-7 w-7 text-white shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-7 w-7 text-white shrink-0 mt-0.5" />
              )}
              <div>
                <h1 className="font-ds-display text-xl font-bold text-white leading-snug">
                  {cardValid ? 'Verified Employee' : 'Former Employee'}
                </h1>
                <p className="text-sm text-white/80 mt-1 font-light leading-relaxed">
                  {cardValid
                    ? 'This employee is currently verified with Thea Solutions.'
                    : 'This employee card has expired.'}
                </p>
              </div>
            </div>
          </div>

          {/* Employee Details (Unboxed typography layout) */}
          <div className="flex items-start gap-6 sm:gap-8 mb-12">
            <div className="shrink-0">
              {employee.profileImage ? (
                <img
                  src={employee.profileImage}
                  alt={employee.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-[#5F1F2F]/40"
                  onClick={() => setIsImageModalOpen(true)}
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#5F1F2F] flex items-center justify-center text-white text-2xl font-bold font-ds-display">
                  {employee.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-ds-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-1">
                {employee.name}
              </h2>
              <p className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-3">
                {employee.title}
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-ds-mono text-gray-400">
                <div className="flex items-center gap-1.5">
                  <Building2 size={13} className="text-[#f3a6b7]" />
                  <span>{employee.department}</span>
                </div>
                {employee.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail size={13} className="text-[#f3a6b7]" />
                    <span className="text-gray-300">{employee.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card Information - Clean typography, no blocks */}
          <div className="border-t border-white/10 pt-8 mb-14">
            <h3 className="font-ds-mono text-xs uppercase tracking-wider text-gray-500 mb-6">
              Card Information
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-baseline py-2 border-b border-white/[0.06]">
                <span className="font-ds-mono text-xs uppercase tracking-wider text-gray-400">Employee ID</span>
                <span className="font-ds-mono text-sm font-bold text-white tracking-wider">{employee.employeeId}</span>
              </div>
              <div className="flex justify-between items-baseline py-2 border-b border-white/[0.06]">
                <span className="font-ds-mono text-xs uppercase tracking-wider text-gray-400">Card Expiration Date</span>
                <span className={`font-ds-mono text-sm font-semibold ${cardValid ? 'text-white' : 'text-red-400'}`}>
                  {formattedExpiration} {!cardValid && '(Expired)'}
                </span>
              </div>
            </div>
          </div>

          {/* Terms and Conditions - Clean typography, no blocks */}
          <div className="border-t border-white/10 pt-8 mb-14">
            <h3 className="font-ds-mono text-xs uppercase tracking-wider text-gray-500 mb-6">
              Terms and Conditions
            </h3>
            <div className="space-y-4 text-xs sm:text-sm text-gray-400 font-light leading-relaxed">
              <p>
                <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] font-semibold mr-1.5">1. Card Validity:</span>
                This identification card is valid only while the cardholder is an active employee or contractor of Thea Solutions. The card expires on the date shown above.
              </p>
              <p>
                <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] font-semibold mr-1.5">2. Verification:</span>
                The verified mark indicates that the individual is currently affiliated with Thea Solutions and their card is valid. An expired card indicates the individual is no longer affiliated with the company.
              </p>
              <p>
                <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] font-semibold mr-1.5">3. Usage:</span>
                This card is for identification purposes only and does not grant any unauthorized access to company premises or systems.
              </p>
              <p>
                <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] font-semibold mr-1.5">4. Misuse:</span>
                Any unauthorized use or reproduction of this card is strictly prohibited and may result in legal action.
              </p>
              <p>
                <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] font-semibold mr-1.5">5. Contact:</span>
                For any questions or concerns regarding verification, please contact our HR department.
              </p>
            </div>
          </div>

          {/* Contact Information - Clean typography, no blocks */}
          <div className="border-t border-white/10 pt-8 pb-4">
            <p className="font-ds-mono text-xs text-gray-500 mb-1">Questions about this verification?</p>
            <a
              href="mailto:finance@theasolutions.co"
              className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] hover:underline font-semibold"
            >
              finance@theasolutions.co
            </a>
          </div>

          {/* Minimal Footer */}
          <div className="pt-8 mt-8 border-t border-white/10 flex items-center justify-between font-ds-mono text-xs text-gray-600">
            <p>© {new Date().getFullYear()} Thea Solutions</p>
            <Link href="/" className="hover:text-white transition-colors">theasolutions.co</Link>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {isImageModalOpen && employee.profileImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div className="relative max-w-2xl max-h-[90vh]">
            <img
              src={employee.profileImage}
              alt={employee.name}
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 h-9 w-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors"
              onClick={() => setIsImageModalOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
