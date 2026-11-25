import { NextRequest, NextResponse } from 'next/server';
import { fetchPublicVerification } from '@/lib/hqClient';
import { getEmployeeCardById, getVerificationStatus, isCardValid } from '@/lib/employeeCardUtils';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ employeeId: string }> }
) {
  const { employeeId } = await context.params;
  const live = await fetchPublicVerification(employeeId);

  if (live.status === 200 && live.record) {
    return NextResponse.json(
      { record: live.record, source: 'hq-api' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (live.status === 404) {
    return NextResponse.json(
      { error: 'Credential not found', source: 'hq-api' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const fallback = getEmployeeCardById(employeeId);
  if (fallback) {
    return NextResponse.json(
      {
        record: {
          ...fallback,
          isVerified: isCardValid(fallback.cardExpirationDate),
          verificationStatus: getVerificationStatus(fallback.cardExpirationDate),
          verifiedAt: new Date().toISOString(),
        },
        source: 'static-fallback',
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    { error: 'Credential not found' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } }
  );
}
