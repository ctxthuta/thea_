import { NextRequest, NextResponse } from 'next/server';
import { fetchCmsSection, type CmsSectionName } from '@/lib/hqClient';

const ALLOWED_SECTIONS = new Set<CmsSectionName>([
  'hero',
  'services',
  'delivery_pipeline',
  'products',
  'pricing',
  'careers',
  'faqs',
  'site_settings',
]);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ section: string }> }
) {
  const { section } = await context.params;
  if (!ALLOWED_SECTIONS.has(section as CmsSectionName)) {
    return NextResponse.json({ error: 'Unknown CMS section' }, { status: 400 });
  }

  const data = await fetchCmsSection(section as CmsSectionName, 60);
  if (!data) {
    return NextResponse.json(
      { section, data: null, fallback: true },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    );
  }

  return NextResponse.json(
    { section, data, fallback: false },
    { status: 200, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
  );
}
