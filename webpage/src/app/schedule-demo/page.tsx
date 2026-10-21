'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  Clock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Video,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import mixpanel from 'mixpanel-browser';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface TimeSlot {
  time: string;
  available: boolean;
}

interface CalendarDay {
  date: Date;
  available: boolean;
  dayOfWeek: number;
}

function ScheduleDemoContent() {
  const searchParams = useSearchParams();
  const utmSource = searchParams.get('utm_source');
  const utmMedium = searchParams.get('utm_medium');
  const utmCampaign = searchParams.get('utm_campaign');

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessDomain, setBusinessDomain] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  // Initialize Mixpanel
  useEffect(() => {
    const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
    if (MIXPANEL_TOKEN && typeof window !== 'undefined') {
      try {
        mixpanel.init(MIXPANEL_TOKEN, {
          autocapture: false,
          persistence: 'localStorage',
          ignore_dnt: false,
          track_pageview: false,
        });
      } catch (error) {
        console.error('Mixpanel initialization error:', error);
      }
    }
  }, []);

  // Track page view with UTM parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        mixpanel.track('Demo Scheduling Page Viewed', {
          product_id: '',
          product_name: '',
          product_category: '',
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          referrer: utmSource || document.referrer || 'direct',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Mixpanel tracking error:', error);
      }
    }
  }, [utmSource, utmMedium, utmCampaign]);

  // Generate calendar with busy dates
  useEffect(() => {
    generateCalendar(currentMonth);
  }, [currentMonth]);

  // Generate time slots when date is selected
  useEffect(() => {
    if (selectedDate) {
      generateTimeSlots(selectedDate);
    }
  }, [selectedDate]);

  const generateCalendar = (month: Date) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: CalendarDay[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({
        date: new Date(year, monthIndex, 0),
        available: false,
        dayOfWeek: i,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, monthIndex, i);
      const isPast = date < today;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isBusy = (i % 4 === 0 && !isWeekend && !isPast);

      days.push({
        date,
        available: !isPast && !isWeekend && !isBusy,
        dayOfWeek: date.getDay(),
      });
    }

    setCalendarDays(days);
  };

  const generateTimeSlots = (date: Date) => {
    const allSlots = [
      '09:00 AM', '10:00 AM', '11:00 AM',
      '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'
    ];

    const slots: TimeSlot[] = allSlots.map((time, index) => {
      const dateNum = date.getDate();
      const isAvailable = (dateNum + index) % 3 !== 0;

      return {
        time,
        available: isAvailable,
      };
    });

    setTimeSlots(slots);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime('');
    try {
      mixpanel.track('Demo Date Selected', {
        selected_date: date.toISOString(),
        product_id: '',
        utm_source: utmSource,
      });
    } catch (error) {
      console.error('Mixpanel tracking error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) {
      setSubmitMessage('Please select a date and time slot.');
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const scheduledDate = selectedDate.toISOString().split('T')[0];

      mixpanel.track('Demo Request Submitted', {
        product_id: '',
        product_name: '',
        product_category: '',
        scheduled_date: scheduledDate,
        scheduled_time: selectedTime,
        user_name: name,
        user_email: email,
        phone: phone || '',
        business_domain: businessDomain || '',
        business_description: businessDescription || '',
        generated_product_id: '',
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        referrer: utmSource || (typeof document !== 'undefined' ? document.referrer : '') || 'direct',
        timestamp: new Date().toISOString(),
      });

      const response = await fetch('/api/demo-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestedDate: new Date().toLocaleDateString('en-CA'),
          requestedTime: new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
          }),
          name,
          email,
          phone,
          businessDomain,
          businessDescription,
          scheduledDate,
          scheduledTime: selectedTime,
          productId: '',
          productName: '',
          productCategory: '',
          referrer: utmSource || (typeof document !== 'undefined' ? document.referrer : '') || 'direct',
          utm_source: utmSource || '',
          utm_medium: utmMedium || '',
          utm_campaign: utmCampaign || ''
        }),
      });

      if (response.ok) {
        setSubmitMessage('Demo session scheduled successfully! We will confirm with you shortly.');
        setSelectedDate(null);
        setSelectedTime('');
        setName('');
        setEmail('');
        setPhone('');
        setBusinessDomain('');
        setBusinessDescription('');
      } else {
        setSubmitMessage('Failed to submit request. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting demo request:', error);
      setSubmitMessage('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-[#1A1816] text-[#F1F1F0] selection:bg-[#5F1F2F] selection:text-white">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 sm:pt-44 pb-24">
        {/* Back Link */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-ds-mono uppercase tracking-wider bg-white/[0.04] text-gray-400 border border-white/10 hover:text-white hover:bg-white/[0.08] transition-all mb-8"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to home</span>
        </Link>

        {/* Header in TanStack DS Style */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-3">
            <Sparkles size={13} className="text-[#e36a88]" />
            <span>Consultation & Walkthrough · Live Session</span>
          </div>
          <h1 className="font-ds-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            Schedule a Demo & Discovery Call
          </h1>
          <p className="mt-3 font-light text-base sm:text-lg text-gray-400 max-w-2xl leading-relaxed">
            Select a convenient date and time on the calendar below to book a 1-on-1 technical consultation with our engineering leads.
          </p>
        </div>

        {/* 2-Column Responsive Layout: Left Calendar & Slots, Right Attendee Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column - Calendar & Time Slots (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Calendar Card */}
            <div className="rounded-2xl border border-white/10 bg-[#181816]/85 backdrop-blur-xl p-6 sm:p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-4">
                <span className="font-ds-mono text-xs uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-2">
                  <CalendarIcon size={14} className="text-[#e36a88]" />
                  <span>01. Select Date</span>
                </span>
                <span className="font-ds-mono text-[11px] text-[#f3a6b7] flex items-center gap-1">
                  <Globe size={11} />
                  <span>APAC / UTC+6:30</span>
                </span>
              </div>

              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => navigateMonth('prev')}
                  className="h-8 w-8 rounded-lg border border-white/10 bg-white/[0.04] text-gray-300 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors"
                  aria-label="Previous month"
                >
                  ←
                </button>
                <span className="font-ds-display text-base font-bold text-white">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </span>
                <button
                  type="button"
                  onClick={() => navigateMonth('next')}
                  className="h-8 w-8 rounded-lg border border-white/10 bg-white/[0.04] text-gray-300 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors"
                  aria-label="Next month"
                >
                  →
                </button>
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {dayNames.map((day) => (
                  <div key={day} className="text-center font-ds-mono text-[11px] uppercase tracking-wider text-gray-500 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => day.date.getDate() !== 0 && handleDateSelect(day.date)}
                    disabled={!day.available || day.date.getDate() === 0}
                    className={`aspect-square rounded-xl font-ds-mono text-xs font-medium flex items-center justify-center transition-all ${
                      day.date.getDate() === 0
                        ? 'invisible'
                        : !day.available
                        ? 'text-gray-600 opacity-30 cursor-not-allowed'
                        : selectedDate && 
                          day.date.getDate() === selectedDate.getDate() &&
                          day.date.getMonth() === selectedDate.getMonth()
                        ? 'bg-[#5F1F2F] text-white font-bold ring-2 ring-[#e36a88]/60 shadow-lg'
                        : 'text-gray-300 bg-white/[0.02] border border-white/5 hover:bg-white/[0.08] hover:border-[#5F1F2F]/40'
                    }`}
                  >
                    {day.date.getDate()}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Slot Picker */}
            <div className="rounded-2xl border border-white/10 bg-[#181816]/85 backdrop-blur-xl p-6 sm:p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-4">
                <span className="font-ds-mono text-xs uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-2">
                  <Clock size={14} className="text-[#e36a88]" />
                  <span>02. Select Time Slot</span>
                </span>
                <span className="font-ds-mono text-[11px] text-gray-500">
                  30-Minute Session
                </span>
              </div>

              {selectedDate ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`p-2.5 rounded-xl border font-ds-mono text-xs transition-all flex items-center justify-center gap-1.5 ${
                        !slot.available
                          ? 'border-white/5 text-gray-600 opacity-30 cursor-not-allowed'
                          : selectedTime === slot.time
                          ? 'border-[#5F1F2F] bg-[#5F1F2F]/40 text-white font-bold ring-2 ring-[#e36a88]/60 shadow-md'
                          : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/25 hover:bg-white/[0.06]'
                      }`}
                    >
                      <Clock size={12} className="shrink-0" />
                      <span>{slot.time}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center rounded-xl border border-dashed border-white/10 bg-black/20 text-xs font-ds-mono text-gray-400">
                  Please pick a date on the calendar above to view open slots
                </div>
              )}
            </div>

          </div>

          {/* Right Column - Attendee Information & Confirmation Form (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[#181816]/85 backdrop-blur-xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
              <span className="font-ds-mono text-xs uppercase tracking-wider text-gray-400 block font-semibold mb-4">
                03. Attendee Details
              </span>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#121110] border border-white/10 rounded-xl text-sm text-[#F1F1F0] placeholder:text-gray-600 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all"
                    placeholder="Jane Doe"
                  />
                </div>

                <div>
                  <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                    Business Email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#121110] border border-white/10 rounded-xl text-sm text-[#F1F1F0] placeholder:text-gray-600 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all"
                    placeholder="jane@organization.com"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#121110] border border-white/10 rounded-xl text-sm text-[#F1F1F0] placeholder:text-gray-600 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div>
                    <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                      Company / Domain
                    </label>
                    <input
                      type="text"
                      value={businessDomain}
                      onChange={(e) => setBusinessDomain(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#121110] border border-white/10 rounded-xl text-sm text-[#F1F1F0] placeholder:text-gray-600 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all"
                      placeholder="organization.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                    What would you like to explore or build?
                  </label>
                  <textarea
                    value={businessDescription}
                    onChange={(e) => setBusinessDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#121110] border border-white/10 rounded-xl text-sm text-[#F1F1F0] placeholder:text-gray-600 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 resize-none h-24 transition-all"
                    placeholder="Tell us about your project requirements, timeline, or operational goals..."
                  />
                </div>

                {/* Booking Summary Box */}
                {selectedDate && selectedTime ? (
                  <div className="p-4 rounded-xl border border-[#5F1F2F]/50 bg-[#5F1F2F]/15 font-ds-mono text-xs">
                    <span className="uppercase tracking-wider text-[#f3a6b7] block font-semibold mb-2 flex items-center gap-1.5">
                      <CheckCircle2 size={13} />
                      <span>Session Summary</span>
                    </span>
                    <div className="grid grid-cols-2 gap-3 text-gray-300">
                      <div>
                        <span className="block text-gray-500 text-[10px] uppercase">Date</span>
                        <span className="font-semibold text-white">{selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div>
                        <span className="block text-gray-500 text-[10px] uppercase">Time</span>
                        <span className="font-semibold text-white">{selectedTime}</span>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-white/[0.08] flex items-center gap-2 text-gray-400 text-[11px]">
                        <Video size={13} className="text-[#f3a6b7] shrink-0" />
                        <span>Google Meet link will be provided upon confirmation</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.02] text-xs font-ds-mono text-gray-400 text-center">
                    Select a date & time slot to review summary
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !selectedDate || !selectedTime || !email || !name}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full py-3.5 px-6 text-sm font-semibold bg-[#F1F1F0] text-[#1A1816] hover:bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.2),inset_0_1px_0_0_rgba(255,255,255,0.4)] hover:-translate-y-px hover:shadow-[0_6px_20px_-4px_rgba(241,241,240,0.3)] active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>{isSubmitting ? 'Confirming Demo Session...' : 'Confirm Demo Session'}</span>
                  <ArrowRight size={16} />
                </button>

                {submitMessage && (
                  <div className={`p-3.5 rounded-xl text-xs font-medium border ${
                    submitMessage.includes('successfully') 
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

      <Footer />
    </div>
  );
}

export default function ScheduleDemo() {
  return (
    <Suspense fallback={null}>
      <ScheduleDemoContent />
    </Suspense>
  );
}
