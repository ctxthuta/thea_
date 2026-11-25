import { Db, IndexDescription } from 'mongodb';
import { getDb } from './mongo';
import type { CoaCategory, NormalBalance } from './collections';

interface CollectionSpec {
  name: string;
  validator: Record<string, unknown>;
  indexes: IndexDescription[];
}

export interface SeedCoaAccount {
  code: string;
  name: string;
  category: CoaCategory;
  normalBalance: NormalBalance;
  parentCode: string | null;
  description: string;
}

export const DEFAULT_COA_ACCOUNTS: SeedCoaAccount[] = [
  // 1000 Assets
  { code: '1000', name: 'Assets', category: 'ASSET', normalBalance: 'DEBIT', parentCode: null, description: 'Master Assets parent account' },
  { code: '1010', name: 'Cash on Hand (MMK)', category: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Petty cash and vault balances in MMK' },
  { code: '1020', name: 'Bank Account (MMK)', category: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Primary operating bank account in Myanmar Kyat' },
  { code: '1030', name: 'Bank Account (THB)', category: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Regional operating bank account in Thai Baht' },
  { code: '1100', name: 'Accounts Receivable', category: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Issued client invoices awaiting settlement' },
  { code: '1200', name: 'Prepaid Expenses', category: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Annual SaaS, cloud reservations, and advance payments' },
  { code: '1500', name: 'Computer & Equipment Assets', category: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000', description: 'Hardware, laptops, and server assets' },

  // 2000 Liabilities
  { code: '2000', name: 'Liabilities', category: 'LIABILITY', normalBalance: 'CREDIT', parentCode: null, description: 'Master Liabilities parent account' },
  { code: '2010', name: 'Contractor Payables', category: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000', description: 'Approved contractor invoices pending disbursement' },
  { code: '2100', name: 'Accrued Expenses', category: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000', description: 'Incurred expenses not yet billed' },
  { code: '2200', name: 'Client Retainer Deposits / Unearned Revenue', category: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000', description: 'Advance client deposits for upcoming sprints' },
  { code: '2300', name: 'Tax Payables', category: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2000', description: 'Withholding and corporate tax obligations' },

  // 3000 Equity
  { code: '3000', name: 'Equity', category: 'EQUITY', normalBalance: 'CREDIT', parentCode: null, description: 'Master Equity parent account' },
  { code: '3010', name: 'Founder Capital', category: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3000', description: 'Paid-in founder capital contributions' },
  { code: '3100', name: 'Retained Earnings', category: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3000', description: 'Accumulated net profits retained in the business' },
  { code: '3200', name: 'Owner Drawings', category: 'EQUITY', normalBalance: 'CREDIT', parentCode: '3000', description: 'Distributions and drawings by founders' },

  // 4000 Revenue
  { code: '4000', name: 'Revenue', category: 'REVENUE', normalBalance: 'CREDIT', parentCode: null, description: 'Master Revenue parent account' },
  { code: '4010', name: 'Custom Software Engineering Revenue', category: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000', description: 'Milestone and sprint engineering fees' },
  { code: '4020', name: 'AI & Automation Retainer Revenue', category: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000', description: 'Recurring AI agent and workflow automation retainers' },
  { code: '4030', name: 'Consulting & Advisory Revenue', category: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000', description: 'Architecture audits, scoping, and technical advisory' },
  { code: '4090', name: 'FX Gain', category: 'REVENUE', normalBalance: 'CREDIT', parentCode: '4000', description: 'Realized foreign exchange gain on multi-currency settlements' },

  // 5000 Direct Contractor Costs / COGS
  { code: '5000', name: 'Direct Contractor Costs (COGS)', category: 'COGS', normalBalance: 'DEBIT', parentCode: null, description: 'Master Cost of Goods Sold parent account' },
  { code: '5010', name: 'Engineering Contractor Payouts', category: 'COGS', normalBalance: 'DEBIT', parentCode: '5000', description: 'Direct sprint payouts to external engineering contractors' },
  { code: '5020', name: 'Design & Product Freelancer Payouts', category: 'COGS', normalBalance: 'DEBIT', parentCode: '5000', description: 'UI/UX and product specialist contractor payouts' },
  { code: '5030', name: 'Project Cloud & API Usage Costs', category: 'COGS', normalBalance: 'DEBIT', parentCode: '5000', description: 'Client-attributable LLM API tokens and cloud runtime costs' },
  { code: '5040', name: 'Third-Party Software Subcontractors', category: 'COGS', normalBalance: 'DEBIT', parentCode: '5000', description: 'Specialized external vendor delivery fees' },

  // 6000 Operating Expenses
  { code: '6000', name: 'Operating Expenses', category: 'OPEX', normalBalance: 'DEBIT', parentCode: null, description: 'Master Operating Expenses parent account' },
  { code: '6010', name: 'SaaS & Developer Tooling', category: 'OPEX', normalBalance: 'DEBIT', parentCode: '6000', description: 'GitLab, Figma, AI coding assistants, and internal SaaS' },
  { code: '6020', name: 'Internal Cloud Hosting & Domains', category: 'OPEX', normalBalance: 'DEBIT', parentCode: '6000', description: 'Internal hosting, MongoDB Atlas, DNS, and SSL' },
  { code: '6030', name: 'Marketing & Lead Generation', category: 'OPEX', normalBalance: 'DEBIT', parentCode: '6000', description: 'Campaigns, events, and outbound acquisition expenses' },
  { code: '6040', name: 'Legal, Accounting & Advisory', category: 'OPEX', normalBalance: 'DEBIT', parentCode: '6000', description: 'Corporate registration, legal review, and bookkeeping' },
  { code: '6050', name: 'Office & Remote Stipends', category: 'OPEX', normalBalance: 'DEBIT', parentCode: '6000', description: 'Coworking, internet, and workspace stipends' },
  { code: '6060', name: 'Bank Charges & Transfer Fees', category: 'OPEX', normalBalance: 'DEBIT', parentCode: '6000', description: 'Wire fees, cross-border remittance charges, and bank fees' },
  { code: '6090', name: 'FX Loss', category: 'OPEX', normalBalance: 'DEBIT', parentCode: '6000', description: 'Realized foreign exchange loss on multi-currency settlements' },
];

const COLLECTION_SPECS: CollectionSpec[] = [
  {
    name: 'users',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['email', 'name', 'passwordHash', 'role', 'status', 'version', 'createdAt', 'updatedAt'],
        properties: {
          email: { bsonType: 'string' },
          name: { bsonType: 'string' },
          passwordHash: { bsonType: 'string' },
          role: { enum: ['ADMIN', 'FINANCE', 'CMS_EDITOR', 'CRM_MANAGER', 'VIEWER'] },
          status: { enum: ['ACTIVE', 'DISABLED'] },
          version: { bsonType: 'int', minimum: 1 },
          lastLoginAt: { bsonType: ['date', 'null'] },
          createdBy: { bsonType: 'string' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { email: 1 }, name: 'uq_users_email', unique: true },
      { key: { role: 1, status: 1 }, name: 'idx_users_role_status' },
    ],
  },
  {
    name: 'system_settings',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'baseCurrency', 'companyLegalName', 'fiscalYearStartMonth', 'version', 'updatedAt'],
        properties: {
          _id: { bsonType: 'string' },
          baseCurrency: { enum: ['MMK', 'THB'] },
          companyLegalName: { bsonType: 'string' },
          fiscalYearStartMonth: { bsonType: 'int', minimum: 1, maximum: 12 },
          defaultBadgeValidityDays: { bsonType: 'int', minimum: 1 },
          googleDriveSync: { bsonType: ['object', 'null'] },
          version: { bsonType: 'int', minimum: 1 },
          updatedBy: { bsonType: 'string' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [],
  },
  {
    name: 'audit_logs',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['actorId', 'actorRole', 'isStaticSuperAdmin', 'action', 'resourceType', 'resourceId', 'createdAt'],
        properties: {
          actorId: { bsonType: 'string' },
          actorEmail: { bsonType: 'string' },
          actorRole: { bsonType: 'string' },
          isStaticSuperAdmin: { bsonType: 'bool' },
          action: { bsonType: 'string' },
          resourceType: { bsonType: 'string' },
          resourceId: { bsonType: 'string' },
          requestId: { bsonType: 'string' },
          ipAddress: { bsonType: 'string' },
          userAgent: { bsonType: 'string' },
          beforeSnapshot: { bsonType: ['object', 'null'] },
          afterSnapshot: { bsonType: ['object', 'null'] },
          createdAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { createdAt: -1, _id: -1 }, name: 'idx_audit_created_id' },
      { key: { resourceType: 1, resourceId: 1, createdAt: -1 }, name: 'idx_audit_resource' },
      { key: { actorId: 1, createdAt: -1 }, name: 'idx_audit_actor' },
      { key: { action: 1, createdAt: -1 }, name: 'idx_audit_action' },
    ],
  },
  {
    name: 'exchange_rates',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['date', 'fromCurrency', 'toCurrency', 'rate', 'source', 'createdAt', 'updatedAt'],
        properties: {
          date: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          fromCurrency: { enum: ['MMK', 'THB'] },
          toCurrency: { enum: ['MMK', 'THB'] },
          rate: { bsonType: 'decimal' },
          source: { bsonType: 'string' },
          notes: { bsonType: 'string' },
          createdBy: { bsonType: 'string' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { date: 1, fromCurrency: 1, toCurrency: 1 }, name: 'uq_fx_date_pair', unique: true },
      { key: { fromCurrency: 1, toCurrency: 1, date: -1 }, name: 'idx_fx_pair_date_desc' },
    ],
  },
  {
    name: 'coa_accounts',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['code', 'name', 'category', 'normalBalance', 'isSystem', 'isActive', 'version', 'createdAt', 'updatedAt'],
        properties: {
          code: { bsonType: 'string', pattern: '^[1-6]\\d{3}$' },
          name: { bsonType: 'string' },
          category: { enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'OPEX'] },
          normalBalance: { enum: ['DEBIT', 'CREDIT'] },
          parentCode: { bsonType: ['string', 'null'] },
          description: { bsonType: 'string' },
          isSystem: { bsonType: 'bool' },
          isActive: { bsonType: 'bool' },
          version: { bsonType: 'int', minimum: 1 },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { code: 1 }, name: 'uq_coa_code', unique: true },
      { key: { category: 1, code: 1 }, name: 'idx_coa_category_code' },
      { key: { parentCode: 1 }, name: 'idx_coa_parent' },
    ],
  },
  {
    name: 'journal_entries',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'entryNumber',
          'entryType',
          'status',
          'entryDate',
          'currency',
          'baseCurrency',
          'fxRateUsed',
          'fxRateDate',
          'description',
          'lines',
          'totalDebitOrig',
          'totalCreditOrig',
          'totalDebitBase',
          'totalCreditBase',
          'version',
          'createdBy',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          entryNumber: { bsonType: 'string' },
          entryType: { enum: ['INCOME', 'EXPENSE', 'GENERAL'] },
          status: { enum: ['DRAFT', 'POSTED', 'REVERSED', 'VOIDED'] },
          entryDate: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          currency: { enum: ['MMK', 'THB'] },
          baseCurrency: { enum: ['MMK', 'THB'] },
          fxRateUsed: { bsonType: 'decimal' },
          fxRateDate: { bsonType: 'string' },
          description: { bsonType: 'string' },
          reference: { bsonType: 'string' },
          associateId: { bsonType: ['objectId', 'null'] },
          lines: { bsonType: 'array', minItems: 2 },
          totalDebitOrig: { bsonType: 'decimal' },
          totalCreditOrig: { bsonType: 'decimal' },
          totalDebitBase: { bsonType: 'decimal' },
          totalCreditBase: { bsonType: 'decimal' },
          reversedByEntryId: { bsonType: ['objectId', 'null'] },
          reversesEntryId: { bsonType: ['objectId', 'null'] },
          version: { bsonType: 'int', minimum: 1 },
          createdBy: { bsonType: 'string' },
          postedBy: { bsonType: ['string', 'null'] },
          postedAt: { bsonType: ['date', 'null'] },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { entryNumber: 1 }, name: 'uq_je_entry_number', unique: true },
      { key: { status: 1, entryDate: -1, _id: -1 }, name: 'idx_je_status_date_id' },
      { key: { 'lines.accountCode': 1, status: 1, entryDate: 1 }, name: 'idx_je_lines_account_status_date' },
      { key: { entryType: 1, entryDate: -1 }, name: 'idx_je_type_date' },
      { key: { associateId: 1, entryDate: -1 }, name: 'idx_je_associate', sparse: true },
    ],
  },
  {
    name: 'budgets',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['periodType', 'periodKey', 'accountCode', 'currency', 'targetAmount', 'version', 'createdAt', 'updatedAt'],
        properties: {
          periodType: { enum: ['MONTHLY', 'QUARTERLY'] },
          periodKey: { bsonType: 'string' },
          accountCode: { bsonType: 'string', pattern: '^[1-6]\\d{3}$' },
          currency: { enum: ['MMK', 'THB'] },
          targetAmount: { bsonType: 'decimal' },
          notes: { bsonType: 'string' },
          version: { bsonType: 'int', minimum: 1 },
          createdBy: { bsonType: 'string' },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { periodType: 1, periodKey: 1, accountCode: 1 }, name: 'uq_budget_period_account', unique: true },
      { key: { periodKey: 1, accountCode: 1 }, name: 'idx_budget_period_key' },
    ],
  },
  {
    name: 'associates',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: [
          'slug',
          'employeeId',
          'associateType',
          'name',
          'title',
          'department',
          'status',
          'cardExpirationDate',
          'isPublicCardEnabled',
          'version',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          slug: { bsonType: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
          employeeId: { bsonType: 'string', pattern: '^THEA-[A-Z0-9]{4}$' },
          associateType: { enum: ['contractor', 'freelancer', 'advisor', 'executive'] },
          name: { bsonType: 'string' },
          title: { bsonType: 'string' },
          department: { bsonType: 'string' },
          status: { enum: ['ACTIVE', 'INACTIVE', 'REVOKED'] },
          profileImage: { bsonType: 'string' },
          bio: { bsonType: 'string' },
          cardExpirationDate: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          revokedAt: { bsonType: ['date', 'null'] },
          revocationReason: { bsonType: ['string', 'null'] },
          isPublicCardEnabled: { bsonType: 'bool' },
          version: { bsonType: 'int', minimum: 1 },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { slug: 1 }, name: 'uq_associates_slug', unique: true },
      { key: { employeeId: 1 }, name: 'uq_associates_employee_id', unique: true },
      { key: { status: 1, associateType: 1, name: 1 }, name: 'idx_associates_status_type' },
    ],
  },
  {
    name: 'cms_documents',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['section', 'status', 'version', 'publishedVersion', 'hasUnpublishedChanges', 'draftData', 'createdAt', 'updatedAt'],
        properties: {
          section: {
            enum: ['hero', 'services', 'delivery_pipeline', 'products', 'pricing', 'careers', 'faqs', 'site_settings'],
          },
          status: { enum: ['draft', 'published'] },
          version: { bsonType: 'int', minimum: 1 },
          publishedVersion: { bsonType: 'int', minimum: 0 },
          hasUnpublishedChanges: { bsonType: 'bool' },
          draftData: { bsonType: 'object' },
          publishedData: { bsonType: ['object', 'null'] },
          updatedBy: { bsonType: 'string' },
          publishedBy: { bsonType: ['string', 'null'] },
          publishedAt: { bsonType: ['date', 'null'] },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { section: 1 }, name: 'uq_cms_section', unique: true },
      { key: { status: 1 }, name: 'idx_cms_status' },
    ],
  },
  {
    name: 'cms_revisions',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['section', 'version', 'data', 'publishedBy', 'publishedAt'],
        properties: {
          section: {
            enum: ['hero', 'services', 'delivery_pipeline', 'products', 'pricing', 'careers', 'faqs', 'site_settings'],
          },
          version: { bsonType: 'int', minimum: 1 },
          data: { bsonType: 'object' },
          changeSummary: { bsonType: 'string' },
          publishedBy: { bsonType: 'string' },
          publishedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { section: 1, version: -1 }, name: 'uq_cms_rev_section_version', unique: true },
    ],
  },
  {
    name: 'crm_accounts',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['name', 'status', 'version', 'createdAt', 'updatedAt'],
        properties: {
          name: { bsonType: 'string' },
          normalizedDomain: { bsonType: ['string', 'null'] },
          industry: { bsonType: 'string' },
          country: { bsonType: 'string' },
          website: { bsonType: 'string' },
          status: { enum: ['PROSPECT', 'ACTIVE_CLIENT', 'PAST_CLIENT', 'CHURNED'] },
          ownerId: { bsonType: ['string', 'null'] },
          notes: { bsonType: 'string' },
          version: { bsonType: 'int', minimum: 1 },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      {
        key: { normalizedDomain: 1 },
        name: 'uq_crm_accounts_domain',
        unique: true,
        partialFilterExpression: { normalizedDomain: { $type: 'string', $gt: '' } },
      },
      { key: { status: 1, createdAt: -1, _id: -1 }, name: 'idx_crm_accounts_status_created' },
    ],
  },
  {
    name: 'crm_contacts',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['fullName', 'email', 'status', 'version', 'createdAt', 'updatedAt'],
        properties: {
          accountId: { bsonType: ['objectId', 'null'] },
          fullName: { bsonType: 'string' },
          email: { bsonType: 'string' },
          phone: { bsonType: 'string' },
          roleTitle: { bsonType: 'string' },
          status: { enum: ['ACTIVE', 'INACTIVE'] },
          version: { bsonType: 'int', minimum: 1 },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { email: 1 }, name: 'uq_crm_contacts_email', unique: true },
      { key: { accountId: 1, fullName: 1 }, name: 'idx_crm_contacts_account' },
    ],
  },
  {
    name: 'crm_deals',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['accountId', 'title', 'stage', 'currency', 'estimatedValue', 'probability', 'version', 'createdAt', 'updatedAt'],
        properties: {
          accountId: { bsonType: 'objectId' },
          primaryContactId: { bsonType: ['objectId', 'null'] },
          title: { bsonType: 'string' },
          stage: { enum: ['DISCOVERY', 'SCOPING', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] },
          currency: { enum: ['MMK', 'THB'] },
          estimatedValue: { bsonType: 'decimal' },
          probability: { bsonType: 'int', minimum: 0, maximum: 100 },
          expectedCloseDate: { bsonType: ['string', 'null'] },
          ownerId: { bsonType: ['string', 'null'] },
          lostReason: { bsonType: ['string', 'null'] },
          version: { bsonType: 'int', minimum: 1 },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { stage: 1, updatedAt: -1, _id: -1 }, name: 'idx_crm_deals_stage_updated' },
      { key: { accountId: 1, createdAt: -1 }, name: 'idx_crm_deals_account' },
    ],
  },
  {
    name: 'crm_leads',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['source', 'status', 'email', 'version', 'createdAt', 'updatedAt'],
        properties: {
          source: { enum: ['WEB_CONTACT', 'WEB_QUOTE', 'WEB_DEMO_REQUEST', 'MANUAL', 'REFERRAL'] },
          status: { enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'DISQUALIFIED'] },
          name: { bsonType: 'string' },
          email: { bsonType: 'string' },
          phone: { bsonType: 'string' },
          company: { bsonType: 'string' },
          notes: { bsonType: 'string' },
          externalRef: { bsonType: ['string', 'null'] },
          payload: { bsonType: 'object' },
          utm: { bsonType: 'object' },
          convertedAccountId: { bsonType: ['objectId', 'null'] },
          convertedContactId: { bsonType: ['objectId', 'null'] },
          convertedDealId: { bsonType: ['objectId', 'null'] },
          convertedAt: { bsonType: ['date', 'null'] },
          version: { bsonType: 'int', minimum: 1 },
          createdAt: { bsonType: 'date' },
          updatedAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { status: 1, createdAt: -1, _id: -1 }, name: 'idx_crm_leads_status_created' },
      { key: { source: 1, createdAt: -1 }, name: 'idx_crm_leads_source_created' },
      { key: { email: 1, createdAt: -1 }, name: 'idx_crm_leads_email' },
      {
        key: { externalRef: 1 },
        name: 'uq_crm_leads_external_ref',
        unique: true,
        partialFilterExpression: { externalRef: { $type: 'string', $gt: '' } },
      },
    ],
  },
  {
    name: 'idempotency_keys',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'requestHash', 'statusCode', 'createdAt', 'expiresAt'],
        properties: {
          _id: { bsonType: 'string' },
          requestHash: { bsonType: 'string' },
          statusCode: { bsonType: 'int' },
          createdAt: { bsonType: 'date' },
          expiresAt: { bsonType: 'date' },
        },
      },
    },
    indexes: [
      { key: { expiresAt: 1 }, name: 'ttl_idempotency_expires', expireAfterSeconds: 0 },
    ],
  },
  {
    name: 'counters',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'seq'],
        properties: {
          _id: { bsonType: 'string' },
          seq: { bsonType: 'int', minimum: 0 },
        },
      },
    },
    indexes: [],
  },
];

export async function runMigrations(dbInstance?: Db): Promise<void> {
  const db = dbInstance ?? getDb();
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const spec of COLLECTION_SPECS) {
    if (!existing.has(spec.name)) {
      await db.createCollection(spec.name, {
        validator: spec.validator,
        validationLevel: 'strict',
        validationAction: 'error',
      });
    } else {
      await db.command({
        collMod: spec.name,
        validator: spec.validator,
        validationLevel: 'strict',
        validationAction: 'error',
      });
    }

    if (spec.indexes.length > 0) {
      await db.collection(spec.name).createIndexes(spec.indexes);
    }
  }

  // Ensure singleton system_settings exists
  const now = new Date();
  await db.collection('system_settings').updateOne(
    { _id: 'global' as unknown as never },
    {
      $setOnInsert: {
        _id: 'global',
        baseCurrency: 'MMK',
        companyLegalName: 'Thea Solutions',
        fiscalYearStartMonth: 1,
        defaultBadgeValidityDays: 365,
        version: 1,
        updatedBy: 'system',
        updatedAt: now,
      },
    },
    { upsert: true }
  );

  // Idempotently ensure default 1000-6000 Chart of Accounts exist
  const coaCol = db.collection('coa_accounts');
  for (const acct of DEFAULT_COA_ACCOUNTS) {
    await coaCol.updateOne(
      { code: acct.code },
      {
        $setOnInsert: {
          code: acct.code,
          name: acct.name,
          category: acct.category,
          normalBalance: acct.normalBalance,
          parentCode: acct.parentCode,
          description: acct.description,
          isSystem: true,
          isActive: true,
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    );
  }
}
