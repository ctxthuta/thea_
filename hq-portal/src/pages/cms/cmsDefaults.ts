import type { CmsSectionKey } from '@/types/hq';

export interface CmsSectionMeta {
  key: CmsSectionKey;
  label: string;
  description: string;
}

export const CMS_SECTIONS: CmsSectionMeta[] = [
  { key: 'hero', label: 'Hero & Stats', description: 'Homepage hero copy, CTA, and trust bullets' },
  { key: 'services', label: 'Core Services', description: 'Capability cards shown on homepage' },
  { key: 'delivery_pipeline', label: '6-Phase Pipeline', description: 'Interactive delivery phases & deliverables' },
  { key: 'products', label: 'Product Catalog', description: 'Thea AI agents & compliance suite' },
  { key: 'pricing', label: 'Pricing Models', description: 'Engagement models on /pricing' },
  { key: 'careers', label: 'Careers Openings', description: 'Open roles on /careers' },
  { key: 'faqs', label: 'Knowledge Base FAQs', description: 'Homepage accordion questions & answers' },
  { key: 'site_settings', label: 'Site Settings', description: 'Global contact, social links, SEO & banner' },
];

export const CMS_SECTION_DEFAULTS: Record<CmsSectionKey, Record<string, unknown>> = {
  hero: {
    eyebrow: 'Bespoke Software · Enterprise AI · Automation',
    headline: 'Bridge the gap between complex technology and your growing business',
    subheadline:
      'At Thea Solutions, we specialize in bespoke software development, enterprise-grade AI, and automation solutions engineered specifically for SMEs to streamline operations and scale with confidence.',
    primaryCta: 'Request Consultation',
    trustBullets: [
      'Remote-First Elite Engineers',
      '2-Week Agile Delivery Cycles',
      'Dedicated Ongoing SLA Support',
    ],
    videoPosterUrl: '/assets/images/LandingBG-Placeholder.webp',
  },
  services: {
    eyebrow: 'Core Capabilities · What We Do',
    headline: 'End-to-end technology solutions tailored to your business model',
    intro:
      'Operating as a fully remote firm, our dedicated team of expert engineers, solution architects, and product designers delivers enterprise-quality technology accessible to growing businesses.',
    items: [
      {
        tag: 'Engineering',
        title: 'Custom Software Development',
        description:
          'Tailored web, desktop, and mobile applications engineered for high transaction throughput.',
      },
      {
        tag: 'Operations',
        title: 'Intelligent Process Automation',
        description:
          'Automate repetitive back-office pipelines and reduce data-entry errors by over 90%.',
      },
    ],
  },
  delivery_pipeline: {
    eyebrow: 'Our Delivery Process · Predictable Milestones',
    headline: 'A proven, predictable path from vision to production',
    phases: [
      {
        step: '01',
        tag: 'Discovery',
        title: 'Discovery & Strategy',
        timeframe: 'Days 1 – 7',
        summary: 'Analyze workflows, interview stakeholders, and define technical roadmap.',
        businessOutcome: '100% scope and budget certainty before code is written.',
        deliverables: ['Technical Architecture Blueprint', 'Milestone Delivery Roadmap'],
        touchpoint: '1x 45-min Kickoff & Alignment Workshop',
        iconKey: 'compass',
      },
    ],
  },
  products: {
    categories: {
      'corporate-agents': {
        name: 'Thea Corporate Agents',
        description: 'AI-powered agents for enterprise operations',
      },
      'corporate-intelligence': {
        name: 'Thea Corporate Intelligence',
        description: 'Business intelligence and market analysis',
      },
      'legal-compliance-intelligence': {
        name: 'Thea Legal/Compliance Intelligence',
        description: 'Legal AI trained for regional compliance',
      },
      actions: {
        name: 'Thea Actions',
        description: 'Automated workflow and process intelligence',
      },
    },
    items: [],
  },
  pricing: {
    eyebrow: 'Transparent Engagement · Zero Hidden Fees',
    headline: 'Predictable investment models aligned with measurable outcomes',
    intro:
      'Transparent milestone and retainer models tailored to your operational goals.',
    engagementModels: [
      {
        name: 'Targeted Sprint',
        eyebrow: 'Fixed Scope · Rapid ROI',
        tagline: 'Best for workflow automations, internal dashboards, or MVP rollouts.',
        timeline: '2 – 4 Weeks',
        features: ['Technical scoping & specification', '2-week focused sprint blocks'],
        actionText: 'Scope a Targeted Sprint',
        popular: false,
      },
    ],
  },
  careers: {
    headline: 'Build thoughtful technology with us.',
    intro:
      'We bring together curious, self-directed engineers and consultants who care deeply about useful software.',
    openings: [],
  },
  faqs: {
    items: [
      {
        question: 'What services does Thea Solutions offer?',
        answer:
          'We specialize in bespoke software development, enterprise-grade AI solutions, and intelligent automation engineered specifically for SMEs.',
        category: 'General',
        sortOrder: 1,
      },
    ],
  },
  site_settings: {
    contactEmail: 'sales@theasolutions.co',
    salesPhone: '',
    locations: ['Yangon, Myanmar', 'Bangkok, Thailand'],
    socialLinks: {
      linkedin: '',
      github: '',
      twitter: '',
      facebook: '',
    },
    announcementBanner: {
      enabled: false,
      text: '',
      href: '',
    },
    seoDefaults: {
      siteName: 'Thea Solutions',
      defaultTitle: 'Thea Solutions | Bespoke Software & Enterprise AI',
      defaultDescription:
        'Bespoke software development, enterprise AI, and workflow automation for growing businesses.',
    },
  },
};
