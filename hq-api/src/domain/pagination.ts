import { ObjectId } from 'mongodb';
import { AppError } from './errors';

export interface KeysetCursor {
  s: string | number;
  id: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function clampLimit(raw?: string | number | null, defaultLimit = 25, maxLimit = 100): number {
  if (raw === undefined || raw === null || raw === '') return defaultLimit;
  const parsed = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return defaultLimit;
  return Math.min(parsed, maxLimit);
}

export function encodeCursor(sortValue: string | number | Date, id: ObjectId | string): string {
  const s = sortValue instanceof Date ? sortValue.toISOString() : sortValue;
  const payload: KeysetCursor = {
    s,
    id: typeof id === 'string' ? id : id.toHexString(),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(raw?: string | null): KeysetCursor | null {
  if (!raw) return null;
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('s' in decoded) ||
      !('id' in decoded) ||
      typeof (decoded as KeysetCursor).id !== 'string' ||
      !ObjectId.isValid((decoded as KeysetCursor).id)
    ) {
      throw new Error('Malformed cursor payload');
    }
    const { s, id } = decoded as KeysetCursor;
    if (typeof s !== 'string' && typeof s !== 'number') {
      throw new Error('Malformed cursor sort value');
    }
    return { s, id };
  } catch {
    throw AppError.badRequest('Invalid pagination cursor.', [
      { field: 'cursor', message: 'Cursor could not be decoded.' },
    ]);
  }
}

export function buildKeysetFilter(
  sortField: string,
  cursor: KeysetCursor | null,
  options: { direction?: 'asc' | 'desc'; isDate?: boolean } = {}
): Record<string, unknown> | null {
  if (!cursor) return null;
  const op = options.direction === 'asc' ? '$gt' : '$lt';
  const sortVal = options.isDate ? new Date(String(cursor.s)) : cursor.s;
  const oid = new ObjectId(cursor.id);

  return {
    $or: [
      { [sortField]: { [op]: sortVal } },
      { [sortField]: sortVal, _id: { [op]: oid } },
    ],
  };
}

export function slicePaginated<T>(
  rows: T[],
  limit: number,
  getCursorParts: (item: T) => { sortValue: string | number | Date; id: ObjectId | string }
): PaginatedResult<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? (() => {
          const { sortValue, id } = getCursorParts(last);
          return encodeCursor(sortValue, id);
        })()
      : null;

  return { items, nextCursor, hasMore };
}
