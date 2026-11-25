import type { Context } from 'hono';
import { MongoServerError } from 'mongodb';
import { ZodError } from 'zod';
import { AppError } from '../domain/errors';
import type { AppEnv } from './context';
import { getEnv } from '../config/env';

const PROBLEM_BASE_URI = 'https://hq.theasolutions.co/errors';

export function errorHandler(err: Error, c: Context<AppEnv>): Response {
  const requestId = c.get('requestId') ?? 'unknown';
  const instance = c.req.path;

  if (err instanceof AppError) {
    return c.json(
      {
        type: `${PROBLEM_BASE_URI}/${err.code}`,
        title: err.title,
        status: err.status,
        detail: err.detail,
        instance,
        requestId,
        ...(err.errors && err.errors.length > 0 ? { errors: err.errors } : {}),
      },
      err.status as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
      { 'Content-Type': 'application/problem+json; charset=utf-8' }
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        type: `${PROBLEM_BASE_URI}/validation-error`,
        title: 'Bad Request',
        status: 400,
        detail: 'Request validation failed.',
        instance,
        requestId,
        errors: err.issues.map((i) => ({
          field: i.path.join('.') || 'input',
          message: i.message,
        })),
      },
      400,
      { 'Content-Type': 'application/problem+json; charset=utf-8' }
    );
  }

  if (err instanceof MongoServerError) {
    if (err.code === 11000) {
      const fields = Object.keys((err.keyPattern as Record<string, unknown>) ?? {});
      return c.json(
        {
          type: `${PROBLEM_BASE_URI}/duplicate-key`,
          title: 'Conflict',
          status: 409,
          detail: `A resource with the same unique ${fields.join(', ') || 'key'} already exists.`,
          instance,
          requestId,
          errors: fields.map((field) => ({ field, message: 'Already exists.' })),
        },
        409,
        { 'Content-Type': 'application/problem+json; charset=utf-8' }
      );
    }

    if (err.code === 121) {
      return c.json(
        {
          type: `${PROBLEM_BASE_URI}/schema-validation-failed`,
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'Document violated database schema invariants.',
          instance,
          requestId,
        },
        422,
        { 'Content-Type': 'application/problem+json; charset=utf-8' }
      );
    }
  }

  const isProd = getEnv().NODE_ENV === 'production';
  if (!isProd) {
    console.error(`[error][${requestId}]`, err);
  }

  return c.json(
    {
      type: `${PROBLEM_BASE_URI}/internal-server-error`,
      title: 'Internal Server Error',
      status: 500,
      detail: isProd ? 'An unexpected server error occurred.' : err.message,
      instance,
      requestId,
    },
    500,
    { 'Content-Type': 'application/problem+json; charset=utf-8' }
  );
}
