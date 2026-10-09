'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getEmployeeCardById, isCardValid, EmployeeCard } from '@/lib/employeeCardUtils';
import { CheckCircle, XCircle, Calendar, Mail, Building2, AlertCircle } from 'lucide-react';
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

    // Get UTM parameters
    const utmSource = searchParams.get('utm_source');
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');

    // Initialize Mixpanel and track verification events
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

          // Track verification event
          mixpanel.track('Employee Card Verification', eventProperties);

          // Track QR scan specifically if from employee card
          if (utmMedium === 'employee-card') {
            mixpanel.track('QR Code Scanned', {
              ...eventProperties,
              scan_source: 'employee_card',
              employee_id: employee.employeeId,
              employee_name: employee.name,
            });
          }

          console.log('Mixpanel verification events tracked:', eventProperties);
        } catch (error) {
          console.error('Mixpanel tracking error:', error);
        }
      } else {
        console.log('Mixpanel token not found, skipping analytics');
      }
    }
  }, [employee, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-color">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5F1F2F] mx-auto"></div>
          <p className="mt-4 paragraph-color">Verifying employee...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-color">
        <div className="text-center p-8">
          <XCircle className="h-16 w-16 text-[#5F1F2F] mx-auto mb-4" />
          <h1 className="text-2xl font-bold paragraph-color mb-2">Employee Not Found</h1>
          <p className="paragraph-color opacity-70">The employee card could not be verified.</p>
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
    <div className="min-h-screen bg-color">
      <div className="px-6 py-8 md:px-12 md:py-16">
        <div className="max-w-2xl mx-auto">
          {/* Minimal Header */}
          <div className="flex items-center justify-between mb-12">
            <span className="text-sm paragraph-color opacity-40">Thea Solutions</span>
            <span className="text-xs accent-color opacity-60">via employee card</span>
          </div>

          {/* Verification Status Card */}
          <div className="mb-16">
            {/* Status Header */}
            <div className={`mb-8 p-6 rounded-lg ${cardValid ? 'bg-[#5F1F2F]' : 'bg-[#8B2F3F]'}`}>
              <div className="flex items-center space-x-3">
                {cardValid ? (
                  <CheckCircle className="h-8 w-8 text-[#F1F1F0]" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-[#F1F1F0]" />
                )}
                <div>
                  <h1 className="text-xl font-bold text-[#F1F1F0]">
                    {cardValid ? 'Verified Employee' : 'Former Employee'}
                  </h1>
                  <p className="text-sm text-[#F1F1F0] opacity-80">
                    {cardValid
                      ? 'This employee is currently verified with Thea Solutions'
                      : 'This employee card has expired'}
                  </p>
                </div>
              </div>
            </div>

            {/* Employee Details */}
            <div className="flex items-start gap-6 mb-8">
              {/* Profile Image */}
              <div className="flex-shrink-0">
                {employee.profileImage ? (
                  <img
                    src={employee.profileImage}
                    alt={employee.name}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setIsImageModalOpen(true)}
                  />
                ) : (
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#5F1F2F] flex items-center justify-center text-[#F1F1F0] text-2xl font-bold">
                    {employee.name.split(' ').map(n => n[0]).join('')}
                  </div>
                )}
              </div>

              {/* Employee Info */}
              <div className="flex-1">
                <h2 className="text-3xl md:text-4xl font-bold paragraph-color mb-2">{employee.name}</h2>
                <p className="text-lg accent-color mb-1">{employee.title}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm paragraph-color opacity-60">
                  <div className="flex items-center">
                    <Building2 className="h-4 w-4 mr-1" />
                    <span>{employee.department}</span>
                  </div>
                  {employee.email && (
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-1" />
                      <span>{employee.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card Information */}
            <div className="border-t border-[#5F1F2F] pt-6">
              <h3 className="text-lg font-semibold paragraph-color mb-4">Card Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-[#5F1F2F]/20">
                  <p className="text-sm paragraph-color opacity-60 mb-1">Employee ID</p>
                  <p className="text-lg font-mono font-semibold paragraph-color">{employee.employeeId}</p>
                </div>
                <div className={`p-4 rounded-lg ${cardValid ? 'bg-[#5F1F2F]/20' : 'bg-[#8B2F3F]/20'}`}>
                  <div className="flex items-center mb-1">
                    <Calendar className="h-4 w-4 mr-1" />
                    <p className="text-sm paragraph-color opacity-60">Card Expiration Date</p>
                  </div>
                  <p className={`text-lg font-semibold ${cardValid ? 'paragraph-color' : 'text-[#FF6B6B]'}`}>
                    {formattedExpiration}
                  </p>
                  {!cardValid && (
                    <p className="text-sm text-[#FF6B6B] mt-1">This card has expired</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="mb-16">
            <h3 className="text-xl font-bold paragraph-color mb-6">Terms and Conditions</h3>
            <div className="paragraph-color opacity-70 space-y-4 text-sm leading-relaxed">
              <p>
                <span className="accent-color font-semibold">1. Card Validity:</span> This identification card is valid only while the card holder
                is an active employee, or contractor of Thea Solutions. The card expires on the date shown above.
              </p>
              <p>
                <span className="accent-color font-semibold">2. Verification:</span> The verified mark indicates that the individual is
                currently affiliated with Thea Solutions and their card is valid. An expired card indicates the individual is no
                longer affiliated with the company.
              </p>
              <p>
                <span className="accent-color font-semibold">3. Usage:</span> This card is for identification purposes only and does not
                grant any unauthorized access to company premises or systems.
              </p>
              <p>
                <span className="accent-color font-semibold">4. Misuse:</span> Any unauthorized use or reproduction of this card is strictly
                prohibited and may result in legal action.
              </p>
              <p>
                <span className="accent-color font-semibold">5. Contact:</span> For any questions or concerns regarding verification,
                please contact our HR department.
              </p>
            </div>
          </div>

          {/* Contact Information */}
          <div className="p-6 rounded-lg bg-[#5F1F2F]/20 text-center">
            <p className="paragraph-color opacity-70 mb-2">Questions about this verification?</p>
            <a
              href="mailto:finance@theasolutions.co"
              className="inline-flex items-center accent-color hover:opacity-80 transition-opacity font-semibold"
            >
              <Mail className="h-5 w-5 mr-2" />
              finance@theasolutions.co
            </a>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {isImageModalOpen && employee.profileImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div className="relative max-w-4xl max-h-screen">
            <img
              src={employee.profileImage}
              alt={employee.name}
              className="max-w-full max-h-screen object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
              onClick={() => setIsImageModalOpen(false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
