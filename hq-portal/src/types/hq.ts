export type CurrencyCode = 'MMK' | 'THB';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'FINANCE'
  | 'CMS_EDITOR'
  | 'CRM_MANAGER'
  | 'VIEWER';

export type DbUserRole = Exclude<UserRole, 'SUPER_ADMIN'>;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isStaticSuperAdmin: boolean;
  permissions?: string[];
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: DbUserRole;
  status: 'ACTIVE' | 'DISABLED';
  version: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettingsDTO {
  id?: string;
  baseCurrency: CurrencyCode;
  companyLegalName: string;
  fiscalYearStartMonth: number;
  defaultBadgeValidityDays: number;
  version: number;
  updatedBy: string;
  updatedAt: string;
}

export interface AuditLogDTO {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  isStaticSuperAdmin: boolean;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
  ipAddress: string;
  userAgent?: string;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  createdAt: string;
}

export interface ExchangeRateDTO {
  id: string;
  date: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: string;
  source: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedFxRateDTO {
  requestedDate: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: string;
  fxRateDate: string;
  isExactDateMatch: boolean;
}

export interface GeneralLedgerEntryDTO {
  entryId: string;
  entryNumber: string;
  entryType: JournalEntryType;
  entryDate: string;
  status: JournalStatus;
  description: string;
  reference?: string;
  memo?: string;
  counterAccounts: string[];
  currency: CurrencyCode;
  fxRateUsed: string;
  fxRateDate: string;
  debitOrig: string;
  creditOrig: string;
  debitBase: string;
  creditBase: string;
  debitDisplay: string;
  creditDisplay: string;
  runningBalanceBase: string;
  runningBalanceDisplay: string;
  isReversal: boolean;
}

export interface GeneralLedgerResponse {
  mode: 'ACCOUNT';
  account: {
    code: string;
    name: string;
    category: CoaCategory;
    normalBalance: 'DEBIT' | 'CREDIT';
  };
  baseCurrency: CurrencyCode;
  displayCurrency: CurrencyCode;
  fxRateToDisplay: string;
  dateFrom: string | null;
  dateTo: string;
  openingBalanceBase: string;
  openingBalanceDisplay: string;
  periodDebitBase: string;
  periodCreditBase: string;
  periodDebitDisplay: string;
  periodCreditDisplay: string;
  closingBalanceBase: string;
  closingBalanceDisplay: string;
  entries: GeneralLedgerEntryDTO[];
}

export type CoaCategory =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'COGS'
  | 'OPEX';

export interface CoaAccountDTO {
  id: string;
  code: string;
  name: string;
  category: CoaCategory;
  normalBalance: 'DEBIT' | 'CREDIT';
  parentCode: string | null;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type JournalEntryType = 'INCOME' | 'EXPENSE' | 'GENERAL';
export type JournalStatus = 'DRAFT' | 'POSTED' | 'REVERSED' | 'VOIDED';

export interface JournalLineDTO {
  lineNo: number;
  accountCode: string;
  accountNameSnapshot?: string;
  memo?: string;
  debitOrig: string;
  creditOrig: string;
  debitBase?: string;
  creditBase?: string;
}

export interface JournalEntryDTO {
  id: string;
  entryNumber: string;
  entryType: JournalEntryType;
  status: JournalStatus;
  entryDate: string;
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  fxRateUsed: string;
  fxRateDate: string;
  description: string;
  reference?: string;
  associateId?: string | null;
  lines: JournalLineDTO[];
  totalDebitOrig: string;
  totalCreditOrig: string;
  totalDebitBase: string;
  totalCreditBase: string;
  reversedByEntryId?: string | null;
  reversesEntryId?: string | null;
  version: number;
  createdBy: string;
  postedBy?: string | null;
  postedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BudgetPeriodType = 'MONTHLY' | 'QUARTERLY';

export interface BudgetDTO {
  id: string;
  periodType: BudgetPeriodType;
  periodKey: string;
  accountCode: string;
  currency: CurrencyCode;
  targetAmount: string;
  notes?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetVsActualRow {
  accountCode: string;
  accountName: string;
  category: CoaCategory;
  targetBase: string;
  actualBase: string;
  varianceBase: string;
  variancePct: string | number;
}

export interface BudgetVsActualReport {
  periodKey: string;
  baseCurrency: CurrencyCode;
  rows: BudgetVsActualRow[];
}

export interface TrialBalanceRow {
  accountCode: string;
  name: string;
  category: CoaCategory;
  debitBase: string;
  creditBase: string;
  netBalanceBase: string;
}

export interface TrialBalanceReport {
  asOf: string;
  baseCurrency: CurrencyCode;
  rows: TrialBalanceRow[];
  totalDebitBase: string;
  totalCreditBase: string;
  isBalanced: boolean;
}

export interface StatementAccountLine {
  accountCode: string;
  name: string;
  amount: string;
}

export interface IncomeStatementReport {
  dateFrom: string;
  dateTo: string;
  baseCurrency: CurrencyCode;
  revenueTotal: string;
  cogsTotal: string;
  grossProfit: string;
  opexTotal: string;
  netIncome: string;
  sections: {
    revenue: StatementAccountLine[];
    cogs: StatementAccountLine[];
    opex: StatementAccountLine[];
  };
}

export interface BalanceSheetReport {
  asOf: string;
  baseCurrency: CurrencyCode;
  assetsTotal: string;
  liabilitiesTotal: string;
  equityTotal: string;
  currentEarnings: string;
  isBalanced: boolean;
  sections: {
    assets: StatementAccountLine[];
    liabilities: StatementAccountLine[];
    equity: StatementAccountLine[];
  };
}

export interface CashFlowSeriesPoint {
  month: string;
  inflow: string;
  outflow: string;
  net: string;
}

export interface CashFlowReport {
  dateFrom: string;
  dateTo: string;
  baseCurrency: CurrencyCode;
  cashInflow: string;
  cashOutflow: string;
  netCashFlow: string;
  series: CashFlowSeriesPoint[];
}

export interface ExecutiveOverviewDTO {
  displayCurrency: CurrencyCode;
  baseCurrency: CurrencyCode;
  fxRateToDisplay: string;
  dateFrom: string;
  dateTo: string;
  periodKey: string;
  kpis: {
    cashBalance?: string;
    totalIncome?: string;
    totalExpenses?: string;
    grossProfit?: string;
    netIncome?: string;
    activeAssociatesCount: number;
    openLeadsCount?: number;
    openDealsCount?: number;
    openDealsPipelineValue?: string;
    unpublishedCmsCount: number;
  };
  moneyInVsOut: CashFlowSeriesPoint[];
  moneyUsages: Array<{
    accountCode: string;
    name: string;
    category: 'COGS' | 'OPEX';
    amount: string;
    sharePct: number;
  }>;
  budgetVsActual: BudgetVsActualRow[];
  expiringAssociateCards: Array<{
    id: string;
    employeeId: string;
    slug: string;
    name: string;
    title: string;
    department: string;
    cardExpirationDate: string;
    isExpired: boolean;
  }>;
  recentLeads: Array<{
    id: string;
    source: LeadSource;
    status: LeadStatus;
    name?: string;
    email: string;
    company?: string;
    createdAt: string;
  }>;
}

export type AssociateType = 'contractor' | 'freelancer' | 'advisor' | 'executive';
export type AssociateStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED';

export interface AssociateEducation {
  degree: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface AssociateExperience {
  position: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current?: boolean;
  description: string[];
}

export interface AssociateCertification {
  name: string;
  issuer: string;
  date: string;
  credentialUrl?: string;
}

export interface AssociateProject {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
}

export interface AssociatePublication {
  title: string;
  type: string;
  date: string;
  authors: string[];
  description: string;
  url: string;
}

export type CompensationRateType =
  | 'MONTHLY_RETAINER'
  | 'DAILY'
  | 'HOURLY'
  | 'MILESTONE'
  | 'ADVISORY'
  | 'NONE';

export interface AssociateCompensation {
  rateType: CompensationRateType;
  rateAmount: string;
  currency: CurrencyCode;
  payoutMethod: string;
  ndaSigned: boolean;
  msaSigned: boolean;
}

export interface AssociateDTO {
  id: string;
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
  revokedAt: string | null;
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
  education: AssociateEducation[];
  experience: AssociateExperience[];
  certifications: AssociateCertification[];
  projects: AssociateProject[];
  publications: AssociatePublication[];
  compensation?: AssociateCompensation;
  internalNotes?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type CmsSectionKey =
  | 'hero'
  | 'services'
  | 'delivery_pipeline'
  | 'products'
  | 'pricing'
  | 'careers'
  | 'faqs'
  | 'site_settings';

export interface CmsSectionSummaryDTO {
  section: CmsSectionKey;
  status: 'draft' | 'published';
  version: number;
  publishedVersion: number;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export interface CmsDocumentDTO extends CmsSectionSummaryDTO {
  id?: string;
  draftData: Record<string, unknown>;
  publishedData: Record<string, unknown> | null;
  updatedBy?: string;
  publishedBy?: string | null;
}

export interface CmsRevisionDTO {
  id: string;
  section: CmsSectionKey;
  version: number;
  data: Record<string, unknown>;
  changeSummary: string;
  publishedBy: string;
  publishedAt: string;
}

export type CrmAccountStatus =
  | 'PROSPECT'
  | 'ACTIVE_CLIENT'
  | 'PAST_CLIENT'
  | 'CHURNED';

export interface CrmAccountDTO {
  id: string;
  name: string;
  normalizedDomain?: string;
  industry?: string;
  country?: string;
  website?: string;
  status: CrmAccountStatus;
  ownerId?: string | null;
  notes?: string;
  portalSlug?: string | null;
  portalAccessCode?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmContactDTO {
  id: string;
  accountId: string | null;
  fullName: string;
  email: string;
  phone?: string;
  roleTitle?: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type DealStage =
  | 'DISCOVERY'
  | 'SCOPING'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST';

export interface CrmDealDTO {
  id: string;
  accountId: string;
  primaryContactId?: string | null;
  title: string;
  stage: DealStage;
  currency: CurrencyCode;
  estimatedValue: string;
  probability: number;
  expectedCloseDate?: string;
  ownerId?: string | null;
  lostReason?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type LeadSource =
  | 'WEB_CONTACT'
  | 'WEB_QUOTE'
  | 'WEB_DEMO_REQUEST'
  | 'MANUAL'
  | 'REFERRAL';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'CONVERTED'
  | 'DISQUALIFIED';

export interface CrmLeadDTO {
  id: string;
  source: LeadSource;
  status: LeadStatus;
  name?: string;
  email: string;
  phone?: string;
  company?: string;
  notes?: string;
  payload?: Record<string, unknown>;
  utm?: Record<string, unknown>;
  convertedAccountId?: string | null;
  convertedContactId?: string | null;
  convertedDealId?: string | null;
  convertedAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmSheetTabConfig {
  id: string;
  label: string;
  spreadsheetId: string;
  gid: string;
  source: LeadSource;
  enabled: boolean;
}

export interface CrmSyncConfigDTO {
  driveFolderId: string;
  driveFolderUrl: string;
  sheets: CrmSheetTabConfig[];
  lastSyncedAt: string | null;
  lastSyncSummary: {
    tabsScanned: number;
    rowsRead: number;
    imported: number;
    skippedDuplicates: number;
    errors: string[];
  } | null;
  quickLinks?: Array<{
    label: string;
    url: string;
    kind: 'drive_folder' | 'google_sheet';
  }>;
}

export interface CrmSyncResultDTO {
  syncedAt: string;
  tabsScanned: number;
  rowsRead: number;
  imported: number;
  skippedDuplicates: number;
  tabResults: Array<{
    id: string;
    label: string;
    source: LeadSource;
    status: 'ok' | 'error';
    rowsRead: number;
    imported: number;
    skippedDuplicates: number;
    invalidRows: number;
    error?: string;
  }>;
}

export interface CrmCsvImportResultDTO {
  importedAt: string;
  label: string;
  source: LeadSource;
  rowsRead: number;
  imported: number;
  skippedDuplicates: number;
  invalidRows: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId?: string;
  errors?: Array<{ field?: string; message: string }>;
}

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type ProjectHealth = 'ON_TRACK' | 'AT_RISK' | 'DELAYED';
export type PhaseStatus = 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'AT_RISK';

export interface ProjectMilestoneDTO {
  id: string;
  title: string;
  deliveryDate: string;
  completedAt?: string | null;
  status: MilestoneStatus;
  deliverableNote?: string;
}

export interface ProjectPhaseDTO {
  id: string;
  order: number;
  name: string;
  summary?: string;
  status: PhaseStatus;
  startDate: string;
  targetDate: string;
  progressPct: number;
  milestones: ProjectMilestoneDTO[];
}

export interface ProjectDTO {
  id: string;
  code: string;
  name: string;
  accountId: string;
  accountName: string;
  accountPortalSlug: string | null;
  dealId?: string | null;
  leadAssociateId: string | null;
  leadAssociateName: string | null;
  status: ProjectStatus;
  summary: string;
  currency: CurrencyCode;
  budgetAmount: string;
  startDate: string;
  targetEndDate: string;
  overallProgressPct: number;
  openTicketCount: number;
  phases: ProjectPhaseDTO[];
  version: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_CLIENT'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TicketCategory =
  | 'BUG'
  | 'FEATURE_REQUEST'
  | 'SUPPORT'
  | 'INFRASTRUCTURE'
  | 'BILLING'
  | 'TRAINING';

export interface TicketCommentDTO {
  id: string;
  authorType: 'CLIENT' | 'TEAM';
  authorName: string;
  authorEmail: string;
  message: string;
  isInternalNote: boolean;
  createdAt: string;
}

export interface TicketDTO {
  id: string;
  ticketNumber: string;
  accountId: string;
  accountName: string;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  phaseId: string | null;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  source?: 'CLIENT_PORTAL' | 'INTERNAL' | 'EMAIL';
  requesterName: string;
  requesterEmail: string;
  assignedAssociateId: string | null;
  assignedAssociateName: string | null;
  slaDueAt: string | null;
  resolvedAt: string | null;
  comments: TicketCommentDTO[];
  version: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketSummaryDTO {
  open: number;
  inProgress: number;
  waitingClient: number;
  resolved: number;
  closed: number;
  urgentOpen: number;
}

export interface ClientPortalSessionDTO {
  accountId: string;
  portalSlug: string;
  accountName: string;
  industry?: string;
  requesterName: string;
  requesterEmail: string;
}

export interface ClientProjectDTO {
  id: string;
  code: string;
  name: string;
  accountName: string;
  leadAssociateName: string | null;
  status: ProjectStatus;
  summary: string;
  startDate: string;
  targetEndDate: string;
  overallProgressPct: number;
  openTicketCount: number;
  phases: ProjectPhaseDTO[];
  updatedAt: string;
}

export type ClientTicketDTO = TicketDTO;
