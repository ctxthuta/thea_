import { createHash } from 'node:crypto';
import { MongoServerError, ObjectId } from 'mongodb';
import { AppError } from '../../domain/errors';
import {
  Collections,
  type CrmLeadDoc,
  type CrmLeadSource,
  type GoogleDriveSheetTab,
  type GoogleDriveSyncConfig,
} from '../../infrastructure/db/collections';
import { writeAuditLog, type AuditEntryInput } from '../../infrastructure/audit/auditLogger';

export const GOOGLE_ID_REGEX = /^[A-Za-z0-9_-]{10,128}$/;
export const GOOGLE_GID_REGEX = /^\d{1,20}$/;

export const DEFAULT_GOOGLE_DRIVE_SYNC: GoogleDriveSyncConfig = {
  driveFolderId: '1hpCrwbDwsZA0auPSB0QFmd1Q8evzBdWL',
  driveFolderUrl:
    'https://drive.google.com/drive/folders/1hpCrwbDwsZA0auPSB0QFmd1Q8evzBdWL?usp=sharing',
  sheets: [
    {
      id: 'leads-contact',
      label: 'Emails to Contact (01_Leads_Landing_Page)',
      spreadsheetId: '1sD2VUVTKTC0SucePM1V_249Eoj4n0M-jvDR2ZUmPy7E',
      gid: '0',
      source: 'WEB_CONTACT',
      enabled: true,
    },
    {
      id: 'leads-demo',
      label: 'Requests for Demo (01_Leads_Landing_Page)',
      spreadsheetId: '1sD2VUVTKTC0SucePM1V_249Eoj4n0M-jvDR2ZUmPy7E',
      gid: '1776889329',
      source: 'WEB_DEMO_REQUEST',
      enabled: true,
    },
    {
      id: 'leads-quote',
      label: 'Quote Requests (01_Leads_Landing_Page)',
      spreadsheetId: '1sD2VUVTKTC0SucePM1V_249Eoj4n0M-jvDR2ZUmPy7E',
      gid: '680829825',
      source: 'WEB_QUOTE',
      enabled: true,
    },
  ],
  lastSyncedAt: null,
  lastSyncSummary: null,
};

export function isValidGoogleDriveUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'drive.google.com' || parsed.hostname === 'docs.google.com')
    );
  } catch {
    return false;
  }
}

/**
 * RFC-4180 compliant CSV parser supporting quoted fields, embedded commas, escaped quotes (""),
 * CRLF/LF line breaks, UTF-8 BOM, and trimmed column headers.
 */
export function parseRfc4180Csv(csvText: string): {
  headers: string[];
  rows: Array<Record<string, string>>;
} {
  const cleaned = csvText.replace(/^\uFEFF/, '');
  const matrix: string[][] = [];
  let currentRow: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(field);
      field = '';
    } else if (ch === '\r') {
      if (cleaned[i + 1] === '\n') i++;
      currentRow.push(field);
      matrix.push(currentRow);
      currentRow = [];
      field = '';
    } else if (ch === '\n') {
      currentRow.push(field);
      matrix.push(currentRow);
      currentRow = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || currentRow.length > 0) {
    currentRow.push(field);
    matrix.push(currentRow);
  }

  const nonEmpty = matrix.filter((row) => row.some((cell) => cell.trim().length > 0));
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = nonEmpty[0]!.map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let r = 1; r < nonEmpty.length; r++) {
    const rawRow = nonEmpty[r]!;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      obj[key] = (rawRow[c] ?? '').trim();
    }
    rows.push(obj);
  }

  return { headers, rows };
}

function pickField(normalizedRow: Map<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const val = normalizedRow.get(alias.toLowerCase());
    if (val && val.trim().length > 0) return val.trim();
  }
  return '';
}

function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface NormalizedSheetLead {
  source: CrmLeadSource;
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  externalRef: string;
  payload: Record<string, unknown>;
  utm: Record<string, unknown>;
}

export function mapCsvRowToLead(
  row: Record<string, string>,
  source: CrmLeadSource,
  originLabel: string
): NormalizedSheetLead | null {
  const norm = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) {
    norm.set(k.trim().toLowerCase(), v.trim());
  }

  const emailRaw = pickField(norm, ['email', 'email address', 'e-mail', 'work email']);
  const email = emailRaw.toLowerCase();
  if (!isPlausibleEmail(email)) {
    return null;
  }

  const phone = pickField(norm, ['phone', 'mobile phone', 'mobile', 'telephone', 'contact number']);
  const date = pickField(norm, ['date', 'requested date', 'submitted date', 'timestamp']);
  const time = pickField(norm, ['time', 'requested time', 'submitted time']);

  let name = '';
  let company = '';
  let notes = '';
  const payload: Record<string, unknown> = {
    importOrigin: originLabel,
    ...(date ? { submittedDate: date } : {}),
    ...(time ? { submittedTime: time } : {}),
  };
  const utm: Record<string, unknown> = {};

  if (source === 'WEB_CONTACT') {
    name = pickField(norm, ['name', 'contact name', 'full name']);
    company = pickField(norm, ['company', 'company name', 'organization']);
    notes = pickField(norm, ['notes', 'message', 'description']);
  } else if (source === 'WEB_DEMO_REQUEST') {
    name = pickField(norm, ['name', 'contact name', 'full name']);
    const businessDomain = pickField(norm, ['business domain', 'domain', 'industry']);
    const businessDesc = pickField(norm, ['business description', 'description', 'notes']);
    const scheduledDate = pickField(norm, ['scheduled date']);
    const scheduledTime = pickField(norm, ['scheduled time']);
    const productId = pickField(norm, ['scheduled product id', 'product id', 'product']);
    const referrer = pickField(norm, ['referrer', 'source', 'utm_source']);

    company = pickField(norm, ['company', 'company name', 'organization']) || businessDomain;
    notes = businessDesc;
    if (businessDomain) payload.businessDomain = businessDomain;
    if (businessDesc) payload.businessDescription = businessDesc;
    if (scheduledDate) payload.scheduledDate = scheduledDate;
    if (scheduledTime) payload.scheduledTime = scheduledTime;
    if (productId) payload.productId = productId;
    if (referrer) utm.referrer = referrer;
  } else if (source === 'WEB_QUOTE') {
    company = pickField(norm, ['company name', 'company', 'organization']);
    name = pickField(norm, ['contact name', 'name', 'full name']);
    const serviceType = pickField(norm, ['service type', 'service']);
    const projectDesc = pickField(norm, ['project description', 'description', 'notes']);
    const budgetRange = pickField(norm, ['budget range', 'budget']);
    const timeline = pickField(norm, ['timeline']);

    notes = projectDesc;
    if (serviceType) payload.serviceType = serviceType;
    if (projectDesc) payload.projectDescription = projectDesc;
    if (budgetRange) payload.budgetRange = budgetRange;
    if (timeline) payload.timeline = timeline;
  } else {
    name = pickField(norm, ['name', 'contact name', 'contact', 'full name']);
    company = pickField(norm, ['company', 'company name', 'organization']);
    notes = pickField(norm, ['notes', 'description', 'project description', 'message']);
  }

  // Deterministic SHA-256 fingerprint prevents duplicates across repeated syncs/imports
  const fingerprintParts = [
    source,
    email,
    date.toLowerCase(),
    time.toLowerCase(),
    company.toLowerCase(),
    name.toLowerCase(),
    String(payload.productId ?? payload.serviceType ?? '').toLowerCase(),
  ];
  const externalRef = `sheet:${createHash('sha256')
    .update(fingerprintParts.join('|'), 'utf8')
    .digest('hex')}`;

  return {
    source,
    name,
    email,
    phone,
    company,
    notes,
    externalRef,
    payload,
    utm,
  };
}

async function persistDedupedLeads(
  rows: Array<Record<string, string>>,
  source: CrmLeadSource,
  originLabel: string
): Promise<{ rowsRead: number; imported: number; skippedDuplicates: number; invalidRows: number }> {
  let imported = 0;
  let skippedDuplicates = 0;
  let invalidRows = 0;

  const col = Collections.crmLeads();

  for (const row of rows) {
    const mapped = mapCsvRowToLead(row, source, originLabel);
    if (!mapped) {
      invalidRows++;
      continue;
    }

    const exists = await col.findOne(
      { externalRef: mapped.externalRef },
      { projection: { _id: 1 } }
    );
    if (exists) {
      skippedDuplicates++;
      continue;
    }

    const now = new Date();
    const doc: CrmLeadDoc = {
      _id: new ObjectId(),
      source: mapped.source,
      status: 'NEW',
      name: mapped.name,
      email: mapped.email,
      phone: mapped.phone,
      company: mapped.company,
      notes: mapped.notes,
      externalRef: mapped.externalRef,
      payload: mapped.payload,
      utm: mapped.utm,
      convertedAccountId: null,
      convertedContactId: null,
      convertedDealId: null,
      convertedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await col.insertOne(doc);
      imported++;
    } catch (err) {
      if (err instanceof MongoServerError && err.code === 11000) {
        skippedDuplicates++;
      } else {
        throw err;
      }
    }
  }

  return {
    rowsRead: rows.length,
    imported,
    skippedDuplicates,
    invalidRows,
  };
}

export interface GoogleDriveSyncConfigDTO {
  driveFolderId: string;
  driveFolderUrl: string;
  sheets: GoogleDriveSheetTab[];
  lastSyncedAt: string | null;
  lastSyncSummary: GoogleDriveSyncConfig['lastSyncSummary'];
  quickLinks: Array<{ label: string; url: string; kind: 'drive_folder' | 'google_sheet' }>;
}

function serializeSyncConfig(cfg: GoogleDriveSyncConfig): GoogleDriveSyncConfigDTO {
  const uniqueSheetIds = [...new Set(cfg.sheets.map((s) => s.spreadsheetId))];
  const quickLinks: GoogleDriveSyncConfigDTO['quickLinks'] = [
    {
      label: 'Shared Google Drive Folder (Sales & Legals)',
      url: cfg.driveFolderUrl,
      kind: 'drive_folder',
    },
    ...uniqueSheetIds.map((id) => ({
      label: `Sales Leads Spreadsheet (${id.slice(0, 8)}...)`,
      url: `https://docs.google.com/spreadsheets/d/${id}/edit`,
      kind: 'google_sheet' as const,
    })),
  ];

  return {
    driveFolderId: cfg.driveFolderId,
    driveFolderUrl: cfg.driveFolderUrl,
    sheets: cfg.sheets,
    lastSyncedAt: cfg.lastSyncedAt ? cfg.lastSyncedAt.toISOString() : null,
    lastSyncSummary: cfg.lastSyncSummary,
    quickLinks,
  };
}

export async function getGoogleDriveSyncConfig(): Promise<GoogleDriveSyncConfigDTO> {
  const settings = await Collections.systemSettings().findOne({ _id: 'global' });
  const cfg = settings?.googleDriveSync ?? DEFAULT_GOOGLE_DRIVE_SYNC;
  return serializeSyncConfig(cfg);
}

export async function updateGoogleDriveSyncConfig(
  input: {
    driveFolderId: string;
    driveFolderUrl: string;
    sheets: GoogleDriveSheetTab[];
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<GoogleDriveSyncConfigDTO> {
  if (!GOOGLE_ID_REGEX.test(input.driveFolderId)) {
    throw AppError.badRequest('Invalid Google Drive folder ID.', [
      { field: 'driveFolderId', message: 'Must match [A-Za-z0-9_-]{10,128}.' },
    ]);
  }
  if (!isValidGoogleDriveUrl(input.driveFolderUrl)) {
    throw AppError.badRequest('driveFolderUrl must be a valid https://drive.google.com URL.', [
      { field: 'driveFolderUrl', message: 'Only https://drive.google.com or docs.google.com URLs are permitted.' },
    ]);
  }
  for (let i = 0; i < input.sheets.length; i++) {
    const tab = input.sheets[i]!;
    if (!GOOGLE_ID_REGEX.test(tab.spreadsheetId)) {
      throw AppError.badRequest(`Invalid spreadsheetId on sheet index ${i}.`, [
        { field: `sheets.${i}.spreadsheetId`, message: 'Must be a valid Google Sheet ID.' },
      ]);
    }
    if (!GOOGLE_GID_REGEX.test(tab.gid)) {
      throw AppError.badRequest(`Invalid numeric gid on sheet index ${i}.`, [
        { field: `sheets.${i}.gid`, message: 'gid must be numeric.' },
      ]);
    }
  }

  const existing = await Collections.systemSettings().findOne({ _id: 'global' });
  const nextConfig: GoogleDriveSyncConfig = {
    driveFolderId: input.driveFolderId,
    driveFolderUrl: input.driveFolderUrl.trim(),
    sheets: input.sheets.map((s) => ({
      ...s,
      id: s.id.trim(),
      label: s.label.trim(),
      spreadsheetId: s.spreadsheetId.trim(),
      gid: s.gid.trim(),
    })),
    lastSyncedAt: existing?.googleDriveSync?.lastSyncedAt ?? null,
    lastSyncSummary: existing?.googleDriveSync?.lastSyncSummary ?? null,
  };

  await Collections.systemSettings().updateOne(
    { _id: 'global' },
    {
      $set: {
        googleDriveSync: nextConfig,
        updatedBy: actor.actorId,
        updatedAt: new Date(),
      },
      $inc: { version: 1 },
    }
  );

  const dto = serializeSyncConfig(nextConfig);
  await writeAuditLog({
    ...actor,
    action: 'CRM_SYNC_CONFIG_UPDATED',
    resourceType: 'system_settings',
    resourceId: 'global',
    afterSnapshot: {
      driveFolderId: dto.driveFolderId,
      sheetCount: dto.sheets.length,
    },
  });

  return dto;
}

export async function syncGoogleSheetsLeads(
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<{
  syncedAt: string;
  tabsScanned: number;
  rowsRead: number;
  imported: number;
  skippedDuplicates: number;
  tabResults: Array<{
    id: string;
    label: string;
    source: CrmLeadSource;
    status: 'ok' | 'error';
    rowsRead: number;
    imported: number;
    skippedDuplicates: number;
    invalidRows: number;
    error?: string;
  }>;
}> {
  const settings = await Collections.systemSettings().findOne({ _id: 'global' });
  const cfg = settings?.googleDriveSync ?? DEFAULT_GOOGLE_DRIVE_SYNC;
  const enabledTabs = cfg.sheets.filter((s) => s.enabled);

  let totalRows = 0;
  let totalImported = 0;
  let totalSkipped = 0;
  const errors: string[] = [];
  const tabResults: Array<{
    id: string;
    label: string;
    source: CrmLeadSource;
    status: 'ok' | 'error';
    rowsRead: number;
    imported: number;
    skippedDuplicates: number;
    invalidRows: number;
    error?: string;
  }> = [];

  for (const tab of enabledTabs) {
    // Re-validate IDs defensively to prevent any SSRF even if DB was manually modified
    if (!GOOGLE_ID_REGEX.test(tab.spreadsheetId) || !GOOGLE_GID_REGEX.test(tab.gid)) {
      const msg = `Invalid spreadsheetId/gid for tab "${tab.label}".`;
      errors.push(msg);
      tabResults.push({
        id: tab.id,
        label: tab.label,
        source: tab.source,
        status: 'error',
        rowsRead: 0,
        imported: 0,
        skippedDuplicates: 0,
        invalidRows: 0,
        error: msg,
      });
      continue;
    }

    const csvUrl = `https://docs.google.com/spreadsheets/d/${tab.spreadsheetId}/export?format=csv&gid=${tab.gid}`;
    try {
      const res = await fetch(csvUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching Google Sheet CSV`);
      }

      const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
      const csvText = await res.text();
      if (contentType.includes('text/html') || csvText.trimStart().toLowerCase().startsWith('<!doctype html')) {
        throw new Error(
          'Sheet returned an HTML login page instead of CSV. Ensure link sharing is set to "Anyone with the link can view".'
        );
      }

      const parsed = parseRfc4180Csv(csvText);
      const counts = await persistDedupedLeads(parsed.rows, tab.source, tab.label);
      totalRows += counts.rowsRead;
      totalImported += counts.imported;
      totalSkipped += counts.skippedDuplicates;

      tabResults.push({
        id: tab.id,
        label: tab.label,
        source: tab.source,
        status: 'ok',
        ...counts,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown Google Sheets sync error';
      errors.push(`${tab.label}: ${msg}`);
      tabResults.push({
        id: tab.id,
        label: tab.label,
        source: tab.source,
        status: 'error',
        rowsRead: 0,
        imported: 0,
        skippedDuplicates: 0,
        invalidRows: 0,
        error: msg,
      });
    }
  }

  const syncedAt = new Date();
  const summary = {
    tabsScanned: enabledTabs.length,
    rowsRead: totalRows,
    imported: totalImported,
    skippedDuplicates: totalSkipped,
    errors,
  };

  await Collections.systemSettings().updateOne(
    { _id: 'global' },
    {
      $set: {
        googleDriveSync: {
          ...cfg,
          lastSyncedAt: syncedAt,
          lastSyncSummary: summary,
        },
        updatedAt: syncedAt,
      },
    }
  );

  await writeAuditLog({
    ...actor,
    action: 'CRM_GOOGLE_SHEETS_SYNCED',
    resourceType: 'crm_lead',
    resourceId: 'google-sheets-sync',
    afterSnapshot: summary,
  });

  return {
    syncedAt: syncedAt.toISOString(),
    tabsScanned: enabledTabs.length,
    rowsRead: totalRows,
    imported: totalImported,
    skippedDuplicates: totalSkipped,
    tabResults,
  };
}

export async function importLeadsFromCsv(
  input: {
    csvText: string;
    source: 'WEB_CONTACT' | 'WEB_QUOTE' | 'WEB_DEMO_REQUEST' | 'MANUAL';
    label?: string;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<{
  importedAt: string;
  label: string;
  source: CrmLeadSource;
  rowsRead: number;
  imported: number;
  skippedDuplicates: number;
  invalidRows: number;
}> {
  const label = (input.label ?? 'Manual CSV Import').trim();
  const parsed = parseRfc4180Csv(input.csvText);
  const counts = await persistDedupedLeads(parsed.rows, input.source, label);

  await writeAuditLog({
    ...actor,
    action: 'CRM_CSV_IMPORTED',
    resourceType: 'crm_lead',
    resourceId: 'csv-import',
    afterSnapshot: { label, source: input.source, ...counts },
  });

  return {
    importedAt: new Date().toISOString(),
    label,
    source: input.source,
    ...counts,
  };
}
