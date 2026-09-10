import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

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
      utm_campaign
    } = body;

    // Validate required fields
    if (!email || !scheduledDate || !scheduledTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const webhookUrl = process.env.DEMO_WEBHOOK_URL || 'https://n8n.theasolutions.co/webhook/req-a-demo/204e6ef0-63d1-4c51-b89d-ea9fb2417cea';
    
    // Try demo-specific passphrase first, then fall back to general passphrase
    const passphrase = process.env.DEMO_WEBHOOK_JWT_PASSPHRASE || process.env.WEBHOOK_JWT_PASSPHRASE;
    
    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Webhook URL not configured' },
        { status: 500 }
      );
    }

    if (!passphrase) {
      return NextResponse.json(
        { error: 'JWT passphrase not configured. Set DEMO_WEBHOOK_JWT_PASSPHRASE or WEBHOOK_JWT_PASSPHRASE' },
        { status: 500 }
      );
    }

    console.log('Using JWT passphrase for demo webhook:', passphrase ? 'configured' : 'missing');

    // Generate JWT token using the same method as contact API
    const token = jwt.sign({}, passphrase, { algorithm: 'HS256', expiresIn: '1h' });
    console.log('Generated JWT token:', token.substring(0, 20) + '...');

    // Try sending as object instead of array (some n8n parsers expect different format)
    const demoData = {
      requestedDate,
      requestedTime,
      email,
      phone: phone ? phone.replace(/[^0-9+\-\s]/g, '') : '', // Clean phone number to avoid formula errors
      name: name || '',
      businessDomain: businessDomain || '',
      businessDescription: businessDescription || '',
      scheduledDate,
      scheduledTime,
      productId,
      productName,
      productCategory,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign
    };
    
    console.log('Sending data to webhook:', JSON.stringify(demoData, null, 2));
    console.log('Webhook URL:', webhookUrl);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(demoData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Webhook error response:', errorText);
      console.error('Sent data:', JSON.stringify(demoData));
      throw new Error(`Webhook request failed with status ${response.status}: ${errorText}`);
    }

    return NextResponse.json(
      { 
        status: 'success',
        message: 'Demo request submitted successfully',
        bookingId: productId
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error processing demo request:', error);
    return NextResponse.json(
      { error: 'Failed to submit demo request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}