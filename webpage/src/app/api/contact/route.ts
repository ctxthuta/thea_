import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ingestLeadToHq } from '@/lib/hqClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    const hqResult = await ingestLeadToHq({
      source: 'WEB_CONTACT',
      email,
      phone: phone || undefined,
      name: body.name ? String(body.name).trim() : undefined,
      company: body.company ? String(body.company).trim() : undefined,
      payload: {
        message: body.message || '',
      },
    });

    const webhookUrl = process.env.CONTACT_WEBHOOK_URL;
    const passphrase = process.env.WEBHOOK_JWT_PASSPHRASE;
    let webhookOk = false;

    if (webhookUrl && passphrase) {
      try {
        const token = jwt.sign({}, passphrase, { algorithm: 'HS256', expiresIn: '1h' });
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify([{ email, phone }]),
        });
        webhookOk = response.ok;
        if (!response.ok) {
          console.error('Contact webhook error status:', response.status);
        }
      } catch (err) {
        console.error('Contact webhook dispatch failed:', err);
      }
    }

    if (!hqResult.ok && !webhookOk) {
      return NextResponse.json(
        { error: 'Unable to record contact inquiry right now' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Contact submitted successfully',
        leadId: hqResult.leadId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error submitting contact:', error);
    return NextResponse.json(
      {
        error: 'Failed to submit contact',
        ...(process.env.NODE_ENV !== 'production'
          ? { details: error instanceof Error ? error.message : 'Unknown error' }
          : {}),
      },
      { status: 500 }
    );
  }
}
