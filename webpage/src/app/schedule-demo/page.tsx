'use client';
import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getProductById, allProducts } from '@/lib/productData';
import { Calendar, Clock, Mail, Phone, ArrowRight, Check } from 'lucide-react';
import mixpanel from 'mixpanel-browser';

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
  const productId = searchParams.get('product');
  const utmSource = searchParams.get('utm_source');
  const utmMedium = searchParams.get('utm_medium');
  const utmCampaign = searchParams.get('utm_campaign');

  const [selectedProduct, setSelectedProduct] = useState(allProducts[0]);
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

  // Set product from URL parameter
  useEffect(() => {
    if (productId) {
      const product = getProductById(productId);
      if (product) {
        setSelectedProduct(product);
      }
    }
  }, [productId]);

  // Track page view with UTM parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        mixpanel.track('Demo Scheduling Page Viewed', {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          product_category: selectedProduct.category,
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
  }, [selectedProduct, utmSource, utmMedium, utmCampaign]);

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
    
    // Get first day of month and total days
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: CalendarDay[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({
        date: new Date(year, monthIndex, 0),
        available: false,
        dayOfWeek: i
      });
    }

    // Generate days for the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthIndex, day);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
      
      // Generate random busy dates (excluding weekends)
      const isBusy = !isWeekend && Math.random() < 0.3; // 30% chance of being busy on weekdays
      
      days.push({
        date,
        available: !isWeekend && !isBusy,
        dayOfWeek
      });
    }

    setCalendarDays(days);
  };

  const generateTimeSlots = (date: Date) => {
    const slots: TimeSlot[] = [
      { time: '09:00', available: Math.random() > 0.4 },
      { time: '10:00', available: Math.random() > 0.3 },
      { time: '11:00', available: Math.random() > 0.2 },
      { time: '13:00', available: Math.random() > 0.3 },
      { time: '14:00', available: Math.random() > 0.4 },
      { time: '15:00', available: Math.random() > 0.2 },
      { time: '16:00', available: Math.random() > 0.3 },
      { time: '17:00', available: Math.random() > 0.4 }
    ];
    setTimeSlots(slots);
  };

  const handleDateSelect = (date: Date) => {
    if (date.getDay() === 0 || date.getDay() === 6) return; // Block weekends
    setSelectedDate(date);
    setSelectedTime('');
  };

  const handleProductChange = (productId: string) => {
    const product = getProductById(productId);
    if (product) {
      setSelectedProduct(product);
      try {
        mixpanel.track('Product Changed', {
          previous_product: selectedProduct.name,
          new_product: product.name,
          new_product_id: product.id,
          utm_source: utmSource,
        });
      } catch (error) {
        console.error('Mixpanel tracking error:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    if (!selectedDate || !selectedTime || !email || !name) {
      setSubmitMessage('Please fill in all required fields.');
      setIsSubmitting(false);
      return;
    }

    const scheduledDate = selectedDate.toLocaleDateString('en-CA');
    const generatedProductId = `${selectedProduct.id}-${Date.now().toString(36)}`;

    try {
      // Track demo request
      mixpanel.track('Demo Request Submitted', {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        product_category: selectedProduct.category,
        scheduled_date: scheduledDate,
        scheduled_time: selectedTime,
        name: name,
        email: email,
        phone: phone || '',
        business_domain: businessDomain || '',
        business_description: businessDescription || '',
        generated_product_id: generatedProductId,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        referrer: utmSource || document.referrer || 'direct',
        timestamp: new Date().toISOString(),
      });

      // Send to n8n webhook
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
          productId: generatedProductId,
          productName: selectedProduct.name,
          productCategory: selectedProduct.category,
          referrer: utmSource || document.referrer || 'direct',
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign
        }),
      });

      if (response.ok) {
        setSubmitMessage('Demo request submitted successfully! We will contact you shortly.');
        // Reset form
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
    <div className="min-h-screen bg-color">
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        {/* Header */}
        <div className="mb-12">
          <span className="text-sm paragraph-color opacity-40">Schedule a Demo</span>
          <h1 className="text-3xl md:text-4xl font-bold paragraph-color mt-2 mb-4">
            Book Your Demo
          </h1>
          <p className="paragraph-color opacity-70 max-w-2xl">
            Select a product and choose a convenient time for your personalized demo session.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column - Product Selection */}
          <div>
            <h2 className="text-sm paragraph-color opacity-40 mb-4 uppercase tracking-wider">
              Select Product
            </h2>
            <div className="space-y-3">
              {allProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductChange(product.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedProduct.id === product.id
                      ? 'border-[#5F1F2F] bg-[#5F1F2F]/20'
                      : 'border-color border-opacity-20 hover:border-opacity-40 bg-black/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="paragraph-color font-medium">{product.name}</h3>
                      <p className="text-sm paragraph-color opacity-60 mt-1">
                        {product.description}
                      </p>
                    </div>
                    {selectedProduct.id === product.id && (
                      <Check className="text-[#5F1F2F]" size={20} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column - Calendar and Form */}
          <div className="space-y-8">
            {/* Calendar */}
            <div>
              <h2 className="text-sm paragraph-color opacity-40 mb-4 uppercase tracking-wider">
                Select Date
              </h2>
              <div className="bg-black/30 border border-color rounded-lg p-6">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="paragraph-color opacity-60 hover:opacity-100 transition-opacity"
                  >
                    ←
                  </button>
                  <span className="paragraph-color font-medium">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </span>
                  <button
                    onClick={() => navigateMonth('next')}
                    className="paragraph-color opacity-60 hover:opacity-100 transition-opacity"
                  >
                    →
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {dayNames.map((day) => (
                    <div key={day} className="text-center text-xs paragraph-color opacity-40 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, index) => (
                    <button
                      key={index}
                      onClick={() => day.date.getDate() !== 0 && handleDateSelect(day.date)}
                      disabled={!day.available || day.date.getDate() === 0}
                      className={`aspect-square rounded-lg flex items-center justify-center text-sm transition-all ${
                        day.date.getDate() === 0
                          ? 'invisible'
                          : !day.available
                          ? 'paragraph-color opacity-20 cursor-not-allowed'
                          : selectedDate && 
                            day.date.getDate() === selectedDate.getDate() &&
                            day.date.getMonth() === selectedDate.getMonth()
                          ? 'bg-[#5F1F2F] text-white'
                          : 'paragraph-color opacity-60 hover:opacity-100 hover:bg-black/20'
                      }`}
                    >
                      {day.date.getDate()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div>
                <h2 className="text-sm paragraph-color opacity-40 mb-4 uppercase tracking-wider">
                  Select Time
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`p-3 rounded-lg border transition-all ${
                        !slot.available
                          ? 'border-color border-opacity-20 paragraph-color opacity-20 cursor-not-allowed'
                          : selectedTime === slot.time
                          ? 'border-[#5F1F2F] bg-[#5F1F2F]/20 paragraph-color'
                          : 'border-color border-opacity-20 paragraph-color opacity-60 hover:border-opacity-40 hover:bg-black/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={16} />
                        <span>{slot.time}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-sm paragraph-color opacity-40 mb-4 uppercase tracking-wider">
                  Your Information
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm paragraph-color opacity-60 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-black/30 border border-color rounded-lg paragraph-color placeholder:opacity-40 focus:outline-none focus:border-[#5F1F2F]"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm paragraph-color opacity-60 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-black/30 border border-color rounded-lg paragraph-color placeholder:opacity-40 focus:outline-none focus:border-[#5F1F2F]"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm paragraph-color opacity-60 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-black/30 border border-color rounded-lg paragraph-color placeholder:opacity-40 focus:outline-none focus:border-[#5F1F2F]"
                      placeholder="+1 234 567 890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm paragraph-color opacity-60 mb-2">
                      Business Domain
                    </label>
                    <input
                      type="text"
                      value={businessDomain}
                      onChange={(e) => setBusinessDomain(e.target.value)}
                      className="w-full px-4 py-3 bg-black/30 border border-color rounded-lg paragraph-color placeholder:opacity-40 focus:outline-none focus:border-[#5F1F2F]"
                      placeholder="yourcompany.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm paragraph-color opacity-60 mb-2">
                      Business Description
                    </label>
                    <textarea
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      className="w-full px-4 py-3 bg-black/30 border border-color rounded-lg paragraph-color placeholder:opacity-40 focus:outline-none focus:border-[#5F1F2F] resize-none"
                      placeholder="Tell us about your business..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              {selectedDate && selectedTime && (
                <div className="bg-black/20 border border-color rounded-lg p-4">
                  <h3 className="text-sm paragraph-color opacity-40 mb-3 uppercase tracking-wider">
                    Booking Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="paragraph-color opacity-60">Product:</span>
                      <span className="paragraph-color">{selectedProduct.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="paragraph-color opacity-60">Date:</span>
                      <span className="paragraph-color">{selectedDate.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="paragraph-color opacity-60">Time:</span>
                      <span className="paragraph-color">{selectedTime}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !selectedDate || !selectedTime || !email || !name}
                className="w-full py-4 bg-[#5F1F2F] text-white rounded-lg hover:bg-[#8B2F4F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Submitting...' : 'Schedule Demo'}
                <ArrowRight size={20} />
              </button>

              {submitMessage && (
                <div className={`text-sm ${submitMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                  {submitMessage}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
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