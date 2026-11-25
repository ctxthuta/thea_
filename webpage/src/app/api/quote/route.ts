import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ingestLeadToHq } from '@/lib/hqClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim();

    if (!email) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    const quotePayload = {
      company: body.company || '',
      contactName: body.contactName || '',
      email,
      phone: body.phone || '',
      serviceType: body.serviceType || '',
      projectDescription: body.projectDescription || '',
      budgetRange: body.budgetRange || '',
      timeline: body.timeline || '',
    };

    const hqResult = await ingestLeadToHq({
      source: 'WEB_QUOTE',
      name: quotePayload.contactName || undefined,
      email,
      phone: quotePayload.phone || undefined,
      company: quotePayload.company || undefined,
      payload: {
        serviceType: quotePayload.serviceType,
        projectDescription: quotePayload.projectDescription,
        budgetRange: quotePayload.budgetRange,
        timeline: quotePayload.timeline,
      },
    });

    const webhookUrl = process.env.QUOTE_WEBHOOK_URL;
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
          body: JSON.stringify([quotePayload]),
        });
        webhookOk = response.ok;
        if (!response.ok) {
          console.error('Quote webhook error status:', response.status);
        }
      } catch (err) {
        console.error('Quote webhook dispatch failed:', err);
      }
    }

    if (!hqResult.ok && !webhookOk) {
      return NextResponse.json(
        { error: 'Unable to record quote request right now' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Quote submitted successfully',
        leadId: hqResult.leadId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error submitting quote:', error);
    return NextResponse.json(
      {
        error: 'Failed to submit quote',
        ...(process.env.NODE_ENV !== 'production'
          ? { details: error instanceof Error ? error.message : 'Unknown error' }
          : {}),
      },
      { status: 500 }
    );
  }
}
