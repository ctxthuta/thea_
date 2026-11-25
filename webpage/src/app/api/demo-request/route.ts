import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ingestLeadToHq } from '@/lib/hqClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      requestedDate,
      requestedTime,
      email,
      phone,
      name,
      businessDomain,
      businessDescription,
      scheduledDate,
      scheduledTime,
      productId,
      productName,
      productCategory,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
    } = body;

    if (!email || !scheduledDate || !scheduledTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cleanPhone = phone ? String(phone).replace(/[^0-9+\-\s]/g, '') : '';

    const hqResult = await ingestLeadToHq({
      source: 'WEB_DEMO_REQUEST',
      name: name ? String(name).trim() : undefined,
      email: String(email).trim(),
      phone: cleanPhone || undefined,
      company: businessDomain ? String(businessDomain).trim() : undefined,
      payload: {
        requestedDate: requestedDate || '',
        requestedTime: requestedTime || '',
        scheduledDate,
        scheduledTime,
        businessDomain: businessDomain || '',
        businessDescription: businessDescription || '',
        productId: productId || '',
        productName: productName || '',
        productCategory: productCategory || '',
      },
      utm: {
        source: utm_source || undefined,
        medium: utm_medium || undefined,
        campaign: utm_campaign || undefined,
        referrer: referrer || undefined,
      },
    });

    const webhookUrl = process.env.DEMO_WEBHOOK_URL;
    const passphrase =
      process.env.DEMO_WEBHOOK_JWT_PASSPHRASE || process.env.WEBHOOK_JWT_PASSPHRASE;
    let webhookOk = false;

    if (webhookUrl && passphrase) {
      try {
        const token = jwt.sign({}, passphrase, { algorithm: 'HS256', expiresIn: '1h' });
        const demoData = {
          requestedDate,
          requestedTime,
          email,
          phone: cleanPhone,
          name: name || '',
          businessDomain: businessDomain || '',
          businessDescription: businessDescription || '',
          scheduledDate,
          scheduledTime,
          productId: productId || '',
          productName: productName || '',
          productCategory: productCategory || '',
          referrer: referrer || '',
          utm_source: utm_source || '',
          utm_medium: utm_medium || '',
          utm_campaign: utm_campaign || '',
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(demoData),
        });
        webhookOk = response.ok;
        if (!response.ok) {
          console.error('Demo webhook error status:', response.status);
        }
      } catch (err) {
        console.error('Demo webhook dispatch failed:', err);
      }
    }

    if (!hqResult.ok && !webhookOk) {
      return NextResponse.json(
        { error: 'Unable to record demo request right now' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        status: 'success',
        message: 'Demo request submitted successfully',
        bookingId: hqResult.leadId || productId || 'demo-request',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error processing demo request:', error);
    return NextResponse.json(
      {
        error: 'Failed to submit demo request',
        ...(process.env.NODE_ENV !== 'production'
          ? { details: error instanceof Error ? error.message : 'Unknown error' }
          : {}),
      },
      { status: 500 }
    );
  }
}
