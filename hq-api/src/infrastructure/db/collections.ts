import { Collection, Decimal128, ObjectId } from 'mongodb';
import { getDb } from './mongo';
import type { CurrencyCode } from '../../domain/accounting/money';
import type { DbUserRole, UserRole } from '../../domain/auth/rbac';
import type { AssociateStatus, AssociateType } from '../../domain/associates/associateDomain';

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: DbUserRole;
  status: 'ACTIVE' | 'DISABLED';
  version: number;
  lastLoginAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoogleDriveSheetTab {
  id: string;
  label: string;
  spreadsheetId: string;
  gid: string;
  source: CrmLeadSource;
  enabled: boolean;
}

export interface GoogleDriveSyncSummary {
  tabsScanned: number;
  rowsRead: number;
  imported: number;
  skippedDuplicates: number;
  errors: string[];
}

export interface GoogleDriveSyncConfig {
  driveFolderId: string;
  driveFolderUrl: string;
  sheets: GoogleDriveSheetTab[];
  lastSyncedAt: Date | null;
  lastSyncSummary: GoogleDriveSyncSummary | null;
}

export interface SystemSettingsDoc {
  _id: 'global';
  baseCurrency: CurrencyCode;
  companyLegalName: string;
  fiscalYearStartMonth: number;
  defaultBadgeValidityDays: number;
  googleDriveSync?: GoogleDriveSyncConfig;
  version: number;
  updatedBy: string;
  updatedAt: Date;
}

export interface AuditLogDoc {
  _id: ObjectId;
  actorId: string;
  actorEmail: string;
  actorRole: UserRole | 'SYSTEM' | 'PUBLIC_INGEST';
  isStaticSuperAdmin: boolean;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
  ipAddress: string;
  userAgent: string;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ExchangeRateDoc {
  _id: ObjectId;
  date: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: Decimal128;
  source: string;
  notes: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CoaCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'COGS' | 'OPEX';
export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface CoaAccountDoc {
  _id: ObjectId;
  code: string;
  name: string;
  category: CoaCategory;
  normalBalance: NormalBalance;
  parentCode: string | null;
  description: string;
  isSystem: boolean;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type JournalEntryType = 'INCOME' | 'EXPENSE' | 'GENERAL';
export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'REVERSED' | 'VOIDED';

export interface JournalLineDoc {
  lineNo: number;
  accountCode: string;
  accountNameSnapshot: string;
  memo: string;
  debitOrig: Decimal128;
  creditOrig: Decimal128;
  debitBase: Decimal128;
  creditBase: Decimal128;
}

export interface JournalEntryDoc {
  _id: ObjectId;
  entryNumber: string;
  entryType: JournalEntryType;
  status: JournalEntryStatus;
  entryDate: string;
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  fxRateUsed: Decimal128;
  fxRateDate: string;
  description: string;
  reference: string;
  associateId: ObjectId | null;
  lines: JournalLineDoc[];
  totalDebitOrig: Decimal128;
  totalCreditOrig: Decimal128;
  totalDebitBase: Decimal128;
  totalCreditBase: Decimal128;
  reversedByEntryId: ObjectId | null;
  reversesEntryId: ObjectId | null;
  version: number;
  createdBy: string;
  postedBy: string | null;
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BudgetPeriodType = 'MONTHLY' | 'QUARTERLY';

export interface BudgetDoc {
  _id: ObjectId;
  periodType: BudgetPeriodType;
  periodKey: string;
  accountCode: string;
  currency: CurrencyCode;
  targetAmount: Decimal128;
  notes: string;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssociateCompensationDoc {
  rateType: 'MONTHLY_RETAINER' | 'DAILY' | 'HOURLY' | 'MILESTONE' | 'ADVISORY' | 'NONE';
  rateAmount: string;
  currency: CurrencyCode;
  payoutMethod: string;
  ndaSigned: boolean;
  msaSigned: boolean;
}

export interface AssociateDoc {
  _id: ObjectId;
  slug: string;
  employeeId: string;
  associateType: AssociateType;
  name: string;
  title: string;
  department: string;
  status: AssociateStatus;
  profileImage: string;
  bio: string;
  cardExpirationDate: string;
  revokedAt: Date | null;
  revocationReason: string | null;
  isPublicCardEnabled: boolean;
  contact: {
    email: string;
    phone?: string;
    location?: string;
  };
  socialLinks: {
    linkedin?: string;
    github?: string;
    twitter?: string;
    website?: string;
  };
  skills: string[];
  education: Array<{
    degree: string;
    institution: string;
    location: string;
    startDate: string;
    endDate: string;
    description?: string;
  }>;
  experience: Array<{
    position: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    current?: boolean;
    description: string[];
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    date: string;
    credentialUrl?: string;
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
    url?: string;
  }>;
  publications: Array<{
    title: string;
    type: string;
    date: string;
    authors: string[];
    description: string;
    url: string;
  }>;
  compensation?: AssociateCompensationDoc;
  internalNotes: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export const CMS_SECTIONS = [
  'hero',
  'services',
  'delivery_pipeline',
  'products',
  'pricing',
  'careers',
  'faqs',
  'site_settings',
] as const;

export type CmsSectionKey = (typeof CMS_SECTIONS)[number];

export interface CmsDocumentDoc {
  _id: ObjectId;
  section: CmsSectionKey;
  status: 'draft' | 'published';
  version: number;
  publishedVersion: number;
  hasUnpublishedChanges: boolean;
  draftData: Record<string, unknown>;
  publishedData: Record<string, unknown> | null;
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CmsRevisionDoc {
  _id: ObjectId;
  section: CmsSectionKey;
  version: number;
  data: Record<string, unknown>;
  changeSummary: string;
  publishedBy: string;
  publishedAt: Date;
}

export type CrmAccountStatus = 'PROSPECT' | 'ACTIVE_CLIENT' | 'PAST_CLIENT' | 'CHURNED';

export interface CrmAccountDoc {
  _id: ObjectId;
  name: string;
  normalizedDomain: string | null;
  industry: string;
  country: string;
  website: string;
  status: CrmAccountStatus;
  ownerId: string | null;
  notes: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmContactDoc {
  _id: ObjectId;
  accountId: ObjectId | null;
  fullName: string;
  email: string;
  phone: string;
  roleTitle: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CrmDealStage = 'DISCOVERY' | 'SCOPING' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';

export interface CrmDealDoc {
  _id: ObjectId;
  accountId: ObjectId;
  primaryContactId: ObjectId | null;
  title: string;
  stage: CrmDealStage;
  currency: CurrencyCode;
  estimatedValue: Decimal128;
  probability: number;
  expectedCloseDate: string | null;
  ownerId: string | null;
  lostReason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CrmLeadSource = 'WEB_CONTACT' | 'WEB_QUOTE' | 'WEB_DEMO_REQUEST' | 'MANUAL' | 'REFERRAL';
export type CrmLeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'DISQUALIFIED';

export interface CrmLeadDoc {
  _id: ObjectId;
  source: CrmLeadSource;
  status: CrmLeadStatus;
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  externalRef?: string | null;
  payload: Record<string, unknown>;
  utm: Record<string, unknown>;
  convertedAccountId: ObjectId | null;
  convertedContactId: ObjectId | null;
  convertedDealId: ObjectId | null;
  convertedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdempotencyKeyDoc {
  _id: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
  createdAt: Date;
  expiresAt: Date;
}

export interface CounterDoc {
  _id: string;
  seq: number;
}

export const Collections = {
  users: (): Collection<UserDoc> => getDb().collection<UserDoc>('users'),
  systemSettings: (): Collection<SystemSettingsDoc> =>
    getDb().collection<SystemSettingsDoc>('system_settings'),
  auditLogs: (): Collection<AuditLogDoc> => getDb().collection<AuditLogDoc>('audit_logs'),
  exchangeRates: (): Collection<ExchangeRateDoc> =>
    getDb().collection<ExchangeRateDoc>('exchange_rates'),
  coaAccounts: (): Collection<CoaAccountDoc> => getDb().collection<CoaAccountDoc>('coa_accounts'),
  journalEntries: (): Collection<JournalEntryDoc> =>
    getDb().collection<JournalEntryDoc>('journal_entries'),
  budgets: (): Collection<BudgetDoc> => getDb().collection<BudgetDoc>('budgets'),
  associates: (): Collection<AssociateDoc> => getDb().collection<AssociateDoc>('associates'),
  cmsDocuments: (): Collection<CmsDocumentDoc> => getDb().collection<CmsDocumentDoc>('cms_documents'),
  cmsRevisions: (): Collection<CmsRevisionDoc> => getDb().collection<CmsRevisionDoc>('cms_revisions'),
  crmAccounts: (): Collection<CrmAccountDoc> => getDb().collection<CrmAccountDoc>('crm_accounts'),
  crmContacts: (): Collection<CrmContactDoc> => getDb().collection<CrmContactDoc>('crm_contacts'),
  crmDeals: (): Collection<CrmDealDoc> => getDb().collection<CrmDealDoc>('crm_deals'),
  crmLeads: (): Collection<CrmLeadDoc> => getDb().collection<CrmLeadDoc>('crm_leads'),
  idempotencyKeys: (): Collection<IdempotencyKeyDoc> =>
    getDb().collection<IdempotencyKeyDoc>('idempotency_keys'),
  counters: (): Collection<CounterDoc> => getDb().collection<CounterDoc>('counters'),
};
