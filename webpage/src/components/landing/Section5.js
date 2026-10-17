'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Send, HelpCircle, Sparkles, MessageSquare } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/Accordion";

function Section5() {
  const [formData, setFormData] = useState({
    company: '',
    contactName: '',
    email: '',
    phone: '',
    serviceType: '',
    projectDescription: '',
    budgetRange: '',
    timeline: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitMessage('We will reach out to you soon with a customized scope!');
        setFormData({
          company: '',
          contactName: '',
          email: '',
          phone: '',
          serviceType: '',
          projectDescription: '',
          budgetRange: '',
          timeline: ''
        });
      } else {
        setSubmitMessage('Failed to submit quote. Please try again.');
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
    <>
      {/* Request a Quote Section */}
      <section id="contact" className="relative w-full py-24 sm:py-32 overflow-hidden bg-[#1A1816]">
        {/* Ambient Wine-plum Light */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[600px] h-[600px] bg-[#5F1F2F]/15 rounded-full blur-[220px] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12"
          >
            {/* Left Info Column */}
            <div className="lg:col-span-5 flex flex-col items-start">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-4">
                <span className="size-1.5 rounded-full bg-[#e36a88]" />
                <span>Scope &amp; Quotation · Request a Proposal</span>
              </div>

              <h2 className="font-ds-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.12]">
                Let&apos;s engineer your solution together
              </h2>

              <p className="mt-4 text-base sm:text-lg text-gray-400 font-light leading-relaxed">
                Tell us about your project requirements and technical goals. Our architects will evaluate your scope and provide an actionable, transparent proposal.
              </p>

              {/* Direct Inquiries Card (TanStack DS Card Surface) */}
              <div className="mt-8 w-full rounded-2xl border border-white/10 bg-[#181816]/75 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-3.5">
                  <div className="h-11 w-11 rounded-xl bg-[#5F1F2F]/30 text-[#f3a6b7] border border-[#5F1F2F]/50 flex items-center justify-center shrink-0">
                    <Mail size={20} />
                  </div>
                  <div className="min-w-0">
                    <span className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400">
                      Direct Sales &amp; Inquiries
                    </span>
                    <a 
                      href="mailto:sales@theasolutions.co" 
                      className="block text-base font-semibold text-white hover:text-[#f3a6b7] transition-colors truncate"
                    >
                      sales@theasolutions.co
                    </a>
                  </div>
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 text-xs font-ds-mono text-gray-400">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  <span>NDA signed prior to project deep dives upon request</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-ds-mono text-gray-400">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  <span>Fixed-sprint or dedicated team pricing models</span>
                </div>
              </div>
            </div>

            {/* Right Form Column (TanStack DS Panel) */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-white/10 bg-[#181816]/85 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.08)] relative overflow-hidden">
                {/* Accent top line */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#5F1F2F] to-transparent" />

                <div className="mb-6">
                  <h3 className="font-ds-display text-xl font-bold text-white">
                    Project Scoping Form
                  </h3>
                  <p className="font-ds-mono text-xs text-gray-400 mt-1 uppercase tracking-wider">
                    Fill in your details below for a tailored estimate
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                        Company Name *
                      </label>
                      <input 
                        className="w-full rounded-xl bg-[#121110] border border-white/10 px-3.5 py-2.5 text-sm text-[#F1F1F0] placeholder:text-gray-600 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all" 
                        type="text" 
                        name="company"
                        required
                        value={formData.company}
                        onChange={handleChange}
                        placeholder="Acme Corp" 
                      />
                    </div>
                    <div>
                      <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                        Contact Name *
                      </label>
                      <input 
                        className="w-full rounded-xl bg-[#121110] border border-white/10 px-3.5 py-2.5 text-sm text-[#F1F1F0] placeholder:text-gray-600 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all" 
                        type="text" 
                        name="contactName"
                        required
                        value={formData.contactName}
                        onChange={handleChange}
                        placeholder="Alex Morgan" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                        Email Address *
                      </label>
                      <input 
                        className="w-full rounded-xl bg-[#121110] border border-white/10 px-3.5 py-2.5 text-sm text-[#F1F1F0] placeholder:text-gray-600 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all" 
                        type="email" 
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="alex@acmecorp.com" 
                      />
                    </div>
                    <div>
                      <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                        Phone (Optional)
                      </label>
                      <input 
                        className="w-full rounded-xl bg-[#121110] border border-white/10 px-3.5 py-2.5 text-sm text-[#F1F1F0] placeholder:text-gray-600 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all" 
                        type="tel" 
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+1 (555) 123-4567" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                        Service Category *
                      </label>
                      <select 
                        className="w-full rounded-xl bg-[#121110] border border-white/10 px-3.5 py-2.5 text-sm text-[#F1F1F0] focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all cursor-pointer"
                        name="serviceType"
                        required
                        value={formData.serviceType}
                        onChange={handleChange}
                      >
                        <option value="" className="bg-[#181816]">Select category</option>
                        <option value="software" className="bg-[#181816]">Custom Software</option>
                        <option value="ai" className="bg-[#181816]">AI &amp; Machine Learning</option>
                        <option value="automation" className="bg-[#181816]">Process Automation</option>
                        <option value="other" className="bg-[#181816]">Cloud &amp; Modernization</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                        Budget Range
                      </label>
                      <select 
                        className="w-full rounded-xl bg-[#121110] border border-white/10 px-3.5 py-2.5 text-sm text-[#F1F1F0] focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all cursor-pointer"
                        name="budgetRange"
                        value={formData.budgetRange}
                        onChange={handleChange}
                      >
                        <option value="" className="bg-[#181816]">Select budget</option>
                        <option value="500-1k" className="bg-[#181816]">$500 - $1,000</option>
                        <option value="1k-3k" className="bg-[#181816]">$1,000 - $3,000</option>
                        <option value="3k-5k" className="bg-[#181816]">$3,000 - $5,000</option>
                        <option value="5k-10k" className="bg-[#181816]">$5,000 - $10,000</option>
                        <option value="10k+" className="bg-[#181816]">$10,000+</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                        Timeline
                      </label>
                      <select 
                        className="w-full rounded-xl bg-[#121110] border border-white/10 px-3.5 py-2.5 text-sm text-[#F1F1F0] focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 transition-all cursor-pointer"
                        name="timeline"
                        value={formData.timeline}
                        onChange={handleChange}
                      >
                        <option value="" className="bg-[#181816]">Select timeline</option>
                        <option value="1-2months" className="bg-[#181816]">1-2 months</option>
                        <option value="2-4months" className="bg-[#181816]">2-4 months</option>
                        <option value="4-6months" className="bg-[#181816]">4-6 months</option>
                        <option value="6months+" className="bg-[#181816]">6+ months</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-ds-mono text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                      Project Goals &amp; Scope *
                    </label>
                    <textarea 
                      className="w-full rounded-xl bg-[#121110] border border-white/10 px-3.5 py-2.5 text-sm text-[#F1F1F0] placeholder:text-gray-600 focus:outline-none focus:border-[#5F1F2F] focus:ring-2 focus:ring-[#5F1F2F]/30 h-28 resize-none transition-all" 
                      name="projectDescription"
                      required
                      value={formData.projectDescription}
                      onChange={handleChange}
                      placeholder="Outline your problem, current systems, goals, or desired features..." 
                    />
                  </div>

                  {submitMessage && (
                    <div className={`p-3.5 rounded-xl text-xs font-medium border ${
                      submitMessage.includes('soon') 
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
                        : 'bg-red-950/40 border-red-800/60 text-red-300'
                    }`}>
                      {submitMessage}
                    </div>
                  )}

                  <div className="pt-2">
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center gap-2 rounded-full py-3 px-8 text-sm font-semibold bg-[#F1F1F0] text-[#1A1816] hover:bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.2),inset_0_1px_0_0_rgba(255,255,255,0.4)] hover:-translate-y-px hover:shadow-[0_6px_20px_-4px_rgba(241,241,240,0.3)] active:translate-y-0 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Send size={15} />
                      <span>{isSubmitting ? 'Transmitting Request...' : 'Submit Proposal Request'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQs Section */}
      <section id="faqs" className="relative w-full py-24 sm:py-32 overflow-hidden bg-[#181816]/40 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14"
          >
            {/* FAQ Header Column */}
            <div className="lg:col-span-5 flex flex-col items-start">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-4">
                <HelpCircle size={13} className="text-[#e36a88]" />
                <span>Knowledge Base · FAQ</span>
              </div>

              <h2 className="font-ds-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.12]">
                Frequently asked questions
              </h2>

              <p className="mt-4 text-base sm:text-lg text-gray-400 font-light leading-relaxed">
                Everything you need to know about our engagement model, delivery cadence, and technical partnership. Have a unique question? Contact our team anytime.
              </p>

              <div className="mt-6 flex items-center gap-2">
                <a 
                  href="mailto:sales@theasolutions.co" 
                  className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] hover:underline inline-flex items-center gap-1.5"
                >
                  <MessageSquare size={13} />
                  <span>Ask a question directly</span>
                </a>
              </div>
            </div>

            {/* Accordion Column */}
            <div className="lg:col-span-7">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>
                    What services does Thea Solutions offer?
                  </AccordionTrigger>
                  <AccordionContent>
                    We specialize in bespoke software development, enterprise-grade AI solutions, and intelligent automation engineered specifically for SMEs. Our core capabilities span custom web and mobile applications, workflow and operational automation, AI/LLM integration, cloud infrastructure, and legacy modernization.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger>
                    How do I know if my business needs AI and automation?
                  </AccordionTrigger>
                  <AccordionContent>
                    If your team is weighed down by manual data entry, repetitive cross-application routines, fragmented tools, or operational bottlenecks that hinder scaling, automation will yield an immediate ROI. We evaluate your workflow to identify high-leverage intervention points that eliminate friction.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                  <AccordionTrigger>
                    How do we get started with Thea Solutions?
                  </AccordionTrigger>
                  <AccordionContent>
                    Getting started is straightforward. Submit the project scoping form above or schedule an introductory consultation. Our team will review your objectives, assess existing architecture, and draft a phased roadmap with clear deliverables and milestones.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4">
                  <AccordionTrigger>
                    How long does a typical project take?
                  </AccordionTrigger>
                  <AccordionContent>
                    Timelines depend on scope complexity: targeted automation workflows typically deploy in 2 to 4 weeks, while comprehensive enterprise software builds span 2 to 4 months delivered in transparent 2-week agile sprints with bi-weekly live demos.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}

export default Section5;
