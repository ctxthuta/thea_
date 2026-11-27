import crypto from 'node:crypto';
import type { Employee } from '@/lib/employeeData';

export type CmsSectionName =
  | 'hero'
  | 'services'
  | 'delivery_pipeline'
  | 'products'
  | 'pricing'
  | 'careers'
  | 'faqs'
  | 'site_settings';

export interface PublicCmsResponse<T = Record<string, unknown>> {
  section: CmsSectionName;
  version: number;
  publishedAt: string | null;
  data: T;
}

export interface PublicAssociateResponse {
  slug: string;
  employeeId: string;
  associateType: string;
  name: string;
  title: string;
  department: string;
  profileImage?: string;
  bio: string;
  contact?: {
    email: string;
    phone?: string;
    location?: string;
  };
  socialLinks?: {
    linkedin?: string;
    github?: string;
    twitter?: string;
    website?: string;
  };
  skills?: string[];
  education?: Employee['education'];
  experience?: Employee['experience'];
  certifications?: Employee['certifications'];
  projects?: Employee['projects'];
  publications?: Employee['publications'];
}

export interface PublicVerifyResponse {
  employeeId: string;
  slug?: string;
  name: string;
  title: string;
  department: string;
  associateType?: string;
  profileImage?: string;
  cardExpirationDate: string;
  email?: string;
  isVerified: boolean;
  verificationStatus: 'verified' | 'expired' | 'revoked';
  verifiedAt?: string;
}

export interface LeadIngestPayload {
  source: 'WEB_CONTACT' | 'WEB_QUOTE' | 'WEB_DEMO_REQUEST';
  name?: string;
  email: string;
  phone?: string;
  company?: string;
  payload?: Record<string, unknown>;
  utm?: Record<string, unknown>;
}

const DEFAULT_TIMEOUT_MS = 2500;

export function isDynamicCmsEnabled(): boolean {
  const raw = (
    process.env.ENABLE_DYNAMIC_CMS ??
    process.env.NEXT_PUBLIC_ENABLE_DYNAMIC_CMS ??
    'false'
  )
    .trim()
    .toLowerCase();
  return raw === 'true' || raw === '1';
}

export function getHqApiBaseUrl(): string {
  const configured =
    process.env.HQ_API_BASE_URL ||
    process.env.NEXT_PUBLIC_HQ_API_BASE_URL ||
    'http://localhost:4000';
  return configured.replace(/\/+$/, '');
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { next?: { revalidate?: number } } = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCmsSection<T = Record<string, unknown>>(
  section: CmsSectionName,
  revalidateSeconds = 60
): Promise<T | null> {
  if (!isDynamicCmsEnabled()) {
    return null;
  }
  try {
    const url = `${getHqApiBaseUrl()}/api/v1/public/cms/${encodeURIComponent(section)}`;
    const response = await fetchWithTimeout(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: revalidateSeconds },
    });
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as Partial<PublicCmsResponse<T>>;
    if (json && json.data && typeof json.data === 'object') {
      return json.data;
    }
    return null;
  } catch (error) {
    console.warn(`[hqClient] CMS section "${section}" fallback triggered:`, error instanceof Error ? error.message : 'unreachable');
    return null;
  }
}

export async function fetchCmsSections(
  sections: CmsSectionName[],
  revalidateSeconds = 60
): Promise<Partial<Record<CmsSectionName, Record<string, unknown>>>> {
  if (!isDynamicCmsEnabled()) {
    return {};
  }
  try {
    const query = encodeURIComponent(sections.join(','));
    const url = `${getHqApiBaseUrl()}/api/v1/public/cms?sections=${query}`;
    const response = await fetchWithTimeout(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: revalidateSeconds },
    });
    if (!response.ok) {
      return {};
    }
    const json = (await response.json()) as {
      sections?: Record<string, { data?: Record<string, unknown> }>;
    };
    const out: Partial<Record<CmsSectionName, Record<string, unknown>>> = {};
    if (json?.sections) {
      for (const sec of sections) {
        const entry = json.sections[sec];
        if (entry?.data && typeof entry.data === 'object') {
          out[sec] = entry.data;
        }
      }
    }
    return out;
  } catch (error) {
    console.warn('[hqClient] Batch CMS fallback triggered:', error instanceof Error ? error.message : 'unreachable');
    return {};
  }
}

export function mapPublicAssociateToEmployee(data: PublicAssociateResponse): Employee {
  return {
    id: data.slug,
    name: data.name,
    title: data.title,
    profileImage: data.profileImage || '',
    bio: data.bio || '',
    education: data.education || [],
    experience: data.experience || [],
    skills: data.skills || [],
    certifications: data.certifications || [],
    contact: data.contact,
    socialLinks: data.socialLinks,
    projects: data.projects || [],
    publications: data.publications || [],
  };
}

export async function fetchPublicAssociate(
  slug: string
): Promise<{ status: number; employee: Employee | null }> {
  if (!isDynamicCmsEnabled()) {
    return { status: 503, employee: null };
  }
  try {
    const url = `${getHqApiBaseUrl()}/api/v1/public/associates/${encodeURIComponent(slug)}`;
    const response = await fetchWithTimeout(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (response.status === 404) {
      return { status: 404, employee: null };
    }
    if (!response.ok) {
      return { status: response.status, employee: null };
    }
    const json = (await response.json()) as PublicAssociateResponse;
    return { status: 200, employee: mapPublicAssociateToEmployee(json) };
  } catch {
    return { status: 503, employee: null };
  }
}

export async function fetchPublicVerification(
  employeeId: string
): Promise<{ status: number; record: PublicVerifyResponse | null }> {
  if (!isDynamicCmsEnabled()) {
    return { status: 503, record: null };
  }
  try {
    const url = `${getHqApiBaseUrl()}/api/v1/public/verify/${encodeURIComponent(employeeId)}`;
    const response = await fetchWithTimeout(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.status === 404) {
      return { status: 404, record: null };
    }
    if (!response.ok) {
      return { status: response.status, record: null };
    }
    const json = (await response.json()) as PublicVerifyResponse;
    return { status: 200, record: json };
  } catch {
    return { status: 503, record: null };
  }
}

export async function ingestLeadToHq(
  lead: LeadIngestPayload
): Promise<{ ok: boolean; leadId?: string; error?: string }> {
  if (!isDynamicCmsEnabled()) {
    return { ok: false, error: 'Dynamic HQ integration disabled' };
  }
  const secret = process.env.HQ_INGEST_SECRET;
  const url = `${getHqApiBaseUrl()}/api/v1/public/leads/ingest`;

  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${lead.source}:${lead.email.toLowerCase()}:${Math.floor(Date.now() / 15000)}`)
    .digest('hex')
    .slice(0, 36);

  const delays = [150, 450];
  let lastError = 'HQ ingestion unavailable';

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': idempotencyKey,
      };
      if (secret) {
        headers['X-HQ-Ingest-Key'] = secret;
      }

      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(lead),
        },
        3000
      );

      if (response.ok) {
        const body = (await response.json().catch(() => ({}))) as { leadId?: string };
        return { ok: true, leadId: body.leadId };
      }

      const errorText = await response.text().catch(() => '');
      lastError = `HQ API returned ${response.status}: ${errorText}`;
      if (response.status >= 400 && response.status < 500) {
        return { ok: false, error: lastError };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Network error';
    }

    if (attempt < delays.length) {
      const jitter = Math.floor(Math.random() * 80);
      await new Promise((resolve) => setTimeout(resolve, delays[attempt] + jitter));
    }
  }

  console.warn('[hqClient] Lead ingestion failed:', lastError);
  return { ok: false, error: lastError };
}
