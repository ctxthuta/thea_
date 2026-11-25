import type { ProblemDetail } from '@/types/hq';

export class ApiError extends Error {
  public readonly status: number;
  public readonly problem: ProblemDetail;

  constructor(status: number, problem: ProblemDetail) {
    super(problem.detail || problem.title || `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

let inMemoryToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeIdFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeIdFields(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
      normalized[k] = normalizeIdFields(v);
    }
    if (typeof record._id === 'string' && typeof normalized.id !== 'string') {
      normalized.id = record._id;
    }
    return normalized as T;
  }
  return value;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotent?: boolean;
  skipUnauthorizedRedirect?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, idempotent = false, skipUnauthorizedRedirect = false } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (inMemoryToken) {
    headers.Authorization = `Bearer ${inMemoryToken}`;
  }

  if (idempotent) {
    headers['Idempotency-Key'] = createIdempotencyKey();
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { detail: rawText };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !skipUnauthorizedRedirect && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const problem: ProblemDetail = {
      status: response.status,
      ...(typeof parsed === 'object' && parsed !== null ? (parsed as Partial<ProblemDetail>) : {}),
    };
    throw new ApiError(response.status, problem);
  }

  return normalizeIdFields(parsed as T);
}
