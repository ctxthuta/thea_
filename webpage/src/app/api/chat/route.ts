import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const MAX_BODY_BYTES = 12000;
const WINDOW_MS = 60_000;
const requests = new Map<string, { count: number; reset: number }>();

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const now = Date.now();
  for (const [key, entry] of requests) if (entry.reset < now) requests.delete(key);
  const entry = requests.get(ip);
  if (entry && entry.reset > now && entry.count >= 12) {
    return NextResponse.json({ error: 'Please wait a moment before sending another message.' }, { status: 429 });
  }
  requests.set(ip, entry && entry.reset > now ? { ...entry, count: entry.count + 1 } : { count: 1, reset: now + WINDOW_MS });

  try {
    if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Message is too long.' }, { status: 413 });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Message is too long.' }, { status: 413 });
    }
    let body: unknown;
    try { body = JSON.parse(raw); } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const messages = (body as { messages?: unknown })?.messages;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 6 ||
        messages.some((message) => typeof message !== 'string' || !message.trim() || message.length > 1200)) {
      return NextResponse.json({ error: 'Please enter a message of up to 1,200 characters.' }, { status: 400 });
    }

    const webhook = process.env.CHAT_WEBHOOK_URL;
    const secret = process.env.WEBHOOK_JWT_PASSPHRASE;
    if (!webhook || !secret) return NextResponse.json({ error: 'Chat is temporarily unavailable.' }, { status: 503 });
    const token = jwt.sign({}, secret, { algorithm: 'HS256', expiresIn: '1m' });
    const response = await fetch(webhook, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: messages.map((message: string) => message.trim()) }),
      signal: AbortSignal.timeout(45_000), cache: 'no-store',
    });
    if (!response.ok) throw new Error('Chat webhook failed');
    const result = await response.json();
    if (typeof result.reply !== 'string' || !result.reply.trim() || result.reply.length > 6000) throw new Error('Invalid chat response');

    let reply = result.reply;
    const lastUserMessage = messages[messages.length - 1].toLowerCase();
    const isCareerQuery =
      /\b(career|careers|job|jobs|hiring|hire|intern|internship|vacancy|vacancies|apply|resume|cv)\b/i.test(lastUserMessage) ||
      lastUserMessage.includes('အလုပ်') ||
      lastUserMessage.includes('สมัครงาน') ||
      lastUserMessage.includes('招聘') ||
      lastUserMessage.includes('работа') ||
      lastUserMessage.includes('ваканси');

    if (isCareerQuery && !reply.includes('theasolutions.co/careers')) {
      reply = `${reply.trim()}\n\nIf you think you have what it takes to ship with elite builders, check open roles and apply at https://theasolutions.co/careers.`;
    }

    return NextResponse.json({ reply }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Chat is temporarily unavailable. Please try again or contact sales@theasolutions.co.' }, { status: 503 });
  }
}
