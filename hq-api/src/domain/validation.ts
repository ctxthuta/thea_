import { z } from 'zod';

export function isSafeUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === '') return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const safeUrlSchema = z
  .string()
  .max(500)
  .refine(isSafeUrl, 'URL must be empty, a relative path starting with "/", or an http(s):// URL.');
