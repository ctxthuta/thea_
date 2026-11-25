import { NextRequest, NextResponse } from 'next/server';
import { fetchPublicAssociate } from '@/lib/hqClient';
import { getEmployeeById } from '@/lib/employeeData';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const live = await fetchPublicAssociate(slug);

  if (live.status === 200 && live.employee) {
    return NextResponse.json(
      { employee: live.employee, source: 'hq-api' },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  }

  if (live.status === 404) {
    return NextResponse.json({ error: 'Associate not found', source: 'hq-api' }, { status: 404 });
  }

  const fallbackEmployee = getEmployeeById(slug);
  if (fallbackEmployee) {
    return NextResponse.json(
      { employee: fallbackEmployee, source: 'static-fallback' },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=30' } }
    );
  }

  return NextResponse.json({ error: 'Associate not found' }, { status: 404 });
}
