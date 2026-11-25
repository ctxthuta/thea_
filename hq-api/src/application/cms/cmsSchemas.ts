import { z } from 'zod';
import type { CmsSectionKey } from '../../infrastructure/db/collections';
import { AppError } from '../../domain/errors';
import { safeUrlSchema } from '../../domain/validation';

const heroSchema = z.object({
  eyebrow: z.string().min(1),
  headline: z.string().min(1),
  subheadline: z.string().min(1),
  primaryCta: z.string().min(1),
  trustBullets: z.array(z.string().min(1)),
  videoPosterUrl: safeUrlSchema,
  stats: z
    .array(
      z.object({
        value: z.string().min(1),
        label: z.string().min(1),
        sublabel: z.string(),
      })
    )
    .optional(),
});

const servicesSchema = z.object({
  eyebrow: z.string().min(1),
  headline: z.string().min(1),
  intro: z.string().min(1),
  items: z.array(
    z.object({
      tag: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
    })
  ),
});

const deliveryPipelineSchema = z.object({
  eyebrow: z.string().min(1),
  headline: z.string().min(1),
  intro: z.string().optional(),
  phases: z.array(
    z.object({
      step: z.string().min(1),
      tag: z.string().min(1),
      title: z.string().min(1),
      timeframe: z.string().min(1),
      summary: z.string().min(1),
      businessOutcome: z.string().min(1),
      deliverables: z.array(z.string().min(1)),
      touchpoint: z.string().min(1),
      iconKey: z.string().min(1),
    })
  ),
});

const productsSchema = z.object({
  categories: z.record(
    z.string(),
    z.object({
      name: z.string().min(1),
      description: z.string().min(1),
    })
  ),
  items: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      category: z.enum([
        'corporate-agents',
        'corporate-intelligence',
        'legal-compliance-intelligence',
        'actions',
      ]),
      subCategory: z.string().optional(),
      description: z.string().min(1),
      features: z.array(z.string().min(1)),
      targetAudience: z.array(z.string().min(1)),
      jurisdictions: z.array(z.string().min(1)).optional(),
      demoAvailable: z.boolean(),
    })
  ),
});

const pricingSchema = z.object({
  eyebrow: z.string().min(1),
  headline: z.string().min(1),
  intro: z.string().min(1),
  engagementModels: z.array(
    z.object({
      name: z.string().min(1),
      eyebrow: z.string().min(1),
      tagline: z.string().min(1),
      timeline: z.string().min(1),
      features: z.array(z.string().min(1)),
      actionText: z.string().min(1),
      popular: z.boolean(),
    })
  ),
});

const careersSchema = z.object({
  eyebrow: z.string().optional(),
  headline: z.string().min(1),
  intro: z.string().min(1),
  openings: z.array(
    z.object({
      title: z.string().min(1),
      level: z.string().min(1),
      team: z.string().min(1),
      location: z.string().min(1),
      type: z.string().min(1),
      description: z.string().min(1),
      skills: z.array(z.string().min(1)),
      focus: z.array(z.string().min(1)),
      isOpen: z.boolean().default(true),
    })
  ),
});

const faqsSchema = z.object({
  eyebrow: z.string().optional(),
  headline: z.string().optional(),
  intro: z.string().optional(),
  items: z.array(
    z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
      category: z.string().min(1).default('General'),
      sortOrder: z.number().int().default(0),
    })
  ),
});

const siteSettingsSchema = z.object({
  contactEmail: z.string().email(),
  careersEmail: z.string().email().optional(),
  salesPhone: z.string(),
  locations: z.array(z.string()),
  socialLinks: z.record(z.string(), safeUrlSchema),
  announcementBanner: z
    .object({
      enabled: z.boolean(),
      text: z.string(),
      href: safeUrlSchema.optional(),
    })
    .optional(),
  seoDefaults: z.object({
    siteName: z.string().min(1),
    defaultTitle: z.string().min(1),
    defaultDescription: z.string().min(1),
  }),
});

export const CMS_SECTION_SCHEMAS: Record<CmsSectionKey, z.ZodType<Record<string, unknown>>> = {
  hero: heroSchema as unknown as z.ZodType<Record<string, unknown>>,
  services: servicesSchema as unknown as z.ZodType<Record<string, unknown>>,
  delivery_pipeline: deliveryPipelineSchema as unknown as z.ZodType<Record<string, unknown>>,
  products: productsSchema as unknown as z.ZodType<Record<string, unknown>>,
  pricing: pricingSchema as unknown as z.ZodType<Record<string, unknown>>,
  careers: careersSchema as unknown as z.ZodType<Record<string, unknown>>,
  faqs: faqsSchema as unknown as z.ZodType<Record<string, unknown>>,
  site_settings: siteSettingsSchema as unknown as z.ZodType<Record<string, unknown>>,
};

export function validateCmsSectionData(
  section: CmsSectionKey,
  data: unknown
): Record<string, unknown> {
  const schema = CMS_SECTION_SCHEMAS[section];
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw AppError.badRequest(
      `Invalid CMS payload for section "${section}".`,
      parsed.error.issues.map((i) => ({
        field: `draftData.${i.path.join('.')}`,
        message: i.message,
      })),
      'cms-validation-error'
    );
  }
  return parsed.data;
}
