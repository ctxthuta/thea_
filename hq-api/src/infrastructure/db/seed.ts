import { ObjectId } from 'mongodb';
import { closeMongo, connectMongo } from './mongo';
import { runMigrations } from './migrations';
import { CMS_SECTIONS, Collections } from './collections';
import { fxMicroToDecimal128, parseFxMicro } from '../../domain/accounting/money';
import { validateCmsSectionData } from '../../application/cms/cmsSchemas';
import { createJournalEntry } from '../../application/accounting/journalService';
import { upsertBudget } from '../../application/accounting/budgetService';
import { DEFAULT_GOOGLE_DRIVE_SYNC } from '../../application/crm/sheetSyncService';
import { getSeedAssociates, SEED_CMS_DATA } from './seedData';
import { seedMyanmarCrmProjectsTickets } from './seedMyanmarOperations';

const SYSTEM_ACTOR = {
  actorId: 'seed-script',
  actorEmail: 'system@theasolutions.co',
  actorRole: 'SYSTEM' as const,
  isStaticSuperAdmin: false,
  requestId: 'seed',
  ipAddress: '127.0.0.1',
  userAgent: 'bun-seed',
};

function isoDateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export async function runSeed(): Promise<void> {
  const db = await connectMongo();
  await runMigrations(db);

  const now = new Date();

  // Ensure default Google Drive / Sales Sheets CRM sync configuration is populated
  await Collections.systemSettings().updateOne(
    { _id: 'global', googleDriveSync: { $exists: false } },
    {
      $set: {
        googleDriveSync: DEFAULT_GOOGLE_DRIVE_SYNC,
        updatedAt: now,
      },
    }
  );

  // 1. Seed 60 daily THB -> MMK rates + historical 4-month & start-of-year anchors (132.50 - 136.00 MMK)
  const fxCol = Collections.exchangeRates();
  const currentYear = now.toISOString().slice(0, 4);
  const fxSeedEntries: Array<{ date: string; rate: string; notes: string }> = [
    { date: `${currentYear}-01-01`, rate: '132.500000', notes: 'Opening annual reference rate' },
    { date: isoDateDaysAgo(120), rate: '132.850000', notes: 'Historical monthly desk reference' },
    { date: isoDateDaysAgo(105), rate: '133.200000', notes: 'Historical bi-weekly desk reference' },
    { date: isoDateDaysAgo(90), rate: '133.600000', notes: 'Historical monthly desk reference' },
    { date: isoDateDaysAgo(75), rate: '134.100000', notes: 'Historical bi-weekly desk reference' },
  ];

  for (let d = 60; d >= 0; d--) {
    const wave = Math.sin((60 - d) / 6) * 1.15;
    const trend = ((60 - d) / 60) * 1.4;
    const rateNum = Math.min(136.0, Math.max(132.5, 133.6 + trend + wave));
    fxSeedEntries.push({
      date: isoDateDaysAgo(d),
      rate: d === 0 ? '135.000000' : rateNum.toFixed(6),
      notes: 'Daily market desk reference (THB to MMK)',
    });
  }

  for (const fx of fxSeedEntries) {
    await fxCol.updateOne(
      { date: fx.date, fromCurrency: 'THB', toCurrency: 'MMK' },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          date: fx.date,
          fromCurrency: 'THB',
          toCurrency: 'MMK',
          rate: fxMicroToDecimal128(parseFxMicro(fx.rate)),
          source: 'Market Reference / Bank Desk',
          notes: fx.notes,
          createdBy: 'seed-script',
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    );
  }

  // 2. Remove Dr. Ohnmar Than completely if present in pre-seeded DBs, then seed 8 realistic Myanmar associates
  const assocCol = Collections.associates();
  await assocCol.deleteMany({
    $or: [{ slug: 'dr-ohnmar-than' }, { employeeId: 'THEA-XWUE' }],
  });

  const seedAssociates = getSeedAssociates();
  for (const assoc of seedAssociates) {
    await assocCol.updateOne(
      { employeeId: assoc.employeeId },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          slug: assoc.slug,
          employeeId: assoc.employeeId!,
          associateType: assoc.associateType,
          name: assoc.name,
          title: assoc.title,
          department: assoc.department,
          status: assoc.status ?? 'ACTIVE',
          profileImage: assoc.profileImage ?? '',
          bio: assoc.bio,
          cardExpirationDate: assoc.cardExpirationDate,
          revokedAt: null,
          revocationReason: null,
          isPublicCardEnabled: assoc.isPublicCardEnabled ?? true,
          contact: assoc.contact ?? { email: '' },
          socialLinks: assoc.socialLinks ?? {},
          skills: assoc.skills ?? [],
          education: assoc.education ?? [],
          experience: assoc.experience ?? [],
          certifications: assoc.certifications ?? [],
          projects: assoc.projects ?? [],
          publications: assoc.publications ?? [],
          compensation: assoc.compensation,
          internalNotes: assoc.internalNotes ?? '',
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    );
  }

  // 3. Seed all 8 published CMS documents & v1 revisions
  const cmsCol = Collections.cmsDocuments();
  const revCol = Collections.cmsRevisions();
  for (const section of CMS_SECTIONS) {
    const validated = validateCmsSectionData(section, SEED_CMS_DATA[section]);
    const existing = await cmsCol.findOne({ section });
    if (!existing) {
      await cmsCol.insertOne({
        _id: new ObjectId(),
        section,
        status: 'published',
        version: 1,
        publishedVersion: 1,
        hasUnpublishedChanges: false,
        draftData: validated,
        publishedData: validated,
        updatedBy: 'seed-script',
        publishedBy: 'seed-script',
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await revCol.updateOne(
        { section, version: 1 },
        {
          $setOnInsert: {
            _id: new ObjectId(),
            section,
            version: 1,
            data: validated,
            changeSummary: 'Initial seed synced from theasolutions.co defaults',
            publishedBy: 'seed-script',
            publishedAt: now,
          },
        },
        { upsert: true }
      );
    }
  }

  // 4. Seed realistic Myanmar CRM Accounts, Contacts, Deals, Leads, Projects & Tickets
  await seedMyanmarCrmProjectsTickets();

  // 5. Seed current-month budgets across Revenue, COGS, and OpEx accounts
  const periodKey = now.toISOString().slice(0, 7);
  const existingBudgets = await Collections.budgets().countDocuments({
    periodType: 'MONTHLY',
    periodKey,
  });
  if (existingBudgets === 0) {
    const defaultBudgets: Array<{
      accountCode: string;
      currency: 'MMK' | 'THB';
      targetAmount: string;
      notes: string;
    }> = [
      { accountCode: '4010', currency: 'MMK', targetAmount: '35000000.00', notes: 'Custom software milestone revenue target (MediTrust, Shwe Taung, Yoma Fresh)' },
      { accountCode: '4020', currency: 'MMK', targetAmount: '14000000.00', notes: 'AI & automation retainers target (MediTrust AI, Ayeyarwady Agro OCR)' },
      { accountCode: '5010', currency: 'THB', targetAmount: '145000.00', notes: 'Engineering contractor sprint allocation' },
      { accountCode: '5020', currency: 'MMK', targetAmount: '2500000.00', notes: 'Product design & UX freelancer allocation' },
      { accountCode: '5030', currency: 'THB', targetAmount: '22000.00', notes: 'Client LLM API tokens & project cloud environments' },
      { accountCode: '6010', currency: 'THB', targetAmount: '16000.00', notes: 'SaaS, GitLab, Figma, AI coding tooling' },
      { accountCode: '6020', currency: 'THB', targetAmount: '12000.00', notes: 'Internal GCP, MongoDB Atlas, domains & SSL' },
      { accountCode: '6030', currency: 'MMK', targetAmount: '2000000.00', notes: 'Yangon B2B events & LinkedIn lead generation' },
      { accountCode: '6040', currency: 'MMK', targetAmount: '1200000.00', notes: 'Myanmar corporate tax & legal advisory' },
      { accountCode: '6050', currency: 'MMK', targetAmount: '1800000.00', notes: 'Yangon/Mandalay remote work & fiber stipends' },
    ];
    for (const b of defaultBudgets) {
      await upsertBudget(
        {
          periodType: 'MONTHLY',
          periodKey,
          accountCode: b.accountCode,
          currency: b.currency,
          targetAmount: b.targetAmount,
          notes: b.notes,
        },
        SYSTEM_ACTOR
      );
    }
  }

  // 6. Seed realistic 4-month Myanmar operations double-entry ledger (ONLY if journal_entries is empty)
  const existingJournals = await Collections.journalEntries().countDocuments({});
  if (existingJournals === 0) {
    const associates = await assocCol.find({}).toArray();
    const assocIdByCode = new Map(associates.map((a) => [a.employeeId, a._id.toHexString()]));

    const openingLedgerEntries: Array<{
      entryType: 'INCOME' | 'EXPENSE' | 'GENERAL';
      daysAgo: number;
      currency: 'MMK' | 'THB';
      description: string;
      reference: string;
      associateCode?: string;
      postImmediately: boolean;
      lines: Array<{ accountCode: string; memo: string; debitOrig: string; creditOrig: string }>;
    }> = [
      // Month -4: Opening Capital & Initial Client Retainer
      {
        entryType: 'GENERAL',
        daysAgo: 115,
        currency: 'MMK',
        description: 'Opening founder operating capital contribution (KBZ Operating Account)',
        reference: 'CAP-2026-001',
        postImmediately: true,
        lines: [
          { accountCode: '1020', memo: 'KBZ Bank MMK opening balance', debitOrig: '45000000.00', creditOrig: '0.00' },
          { accountCode: '3010', memo: 'Founder capital equity', debitOrig: '0.00', creditOrig: '45000000.00' },
        ],
      },
      {
        entryType: 'GENERAL',
        daysAgo: 112,
        currency: 'THB',
        description: 'Opening Bangkok operating reserve deposit (KBank THB)',
        reference: 'CAP-2026-002',
        postImmediately: true,
        lines: [
          { accountCode: '1030', memo: 'KBank THB working capital', debitOrig: '180000.00', creditOrig: '0.00' },
          { accountCode: '3010', memo: 'Founder capital equity (THB)', debitOrig: '0.00', creditOrig: '180000.00' },
        ],
      },
      {
        entryType: 'INCOME',
        daysAgo: 92,
        currency: 'THB',
        description: 'MediTrust Diagnostics Yangon — LIMS Phase 1 Discovery & Architecture Milestone',
        reference: 'INV-MT-2026-01',
        postImmediately: true,
        lines: [
          { accountCode: '1030', memo: 'KBank THB settlement', debitOrig: '95000.00', creditOrig: '0.00' },
          { accountCode: '4010', memo: 'Custom software engineering milestone', debitOrig: '0.00', creditOrig: '95000.00' },
        ],
      },
      {
        entryType: 'EXPENSE',
        daysAgo: 88,
        currency: 'THB',
        description: 'Monthly backend engineering contractor payout — Kyaw Zin Htet',
        reference: 'PAY-KZHT-M1',
        associateCode: 'THEA-KZHT',
        postImmediately: true,
        lines: [
          { accountCode: '5010', memo: 'Backend architecture & LIMS sprint delivery', debitOrig: '62000.00', creditOrig: '0.00' },
          { accountCode: '1030', memo: 'KBank THB transfer', debitOrig: '0.00', creditOrig: '62000.00' },
        ],
      },

      // Month -3: Shwe Taung Logistics & Yoma Fresh Kickoffs
      {
        entryType: 'INCOME',
        daysAgo: 60,
        currency: 'THB',
        description: 'Shwe Taung Logistics — Cold-Chain Telemetry & Driver App Milestone 1',
        reference: 'INV-ST-2026-01',
        postImmediately: true,
        lines: [
          { accountCode: '1030', memo: 'KBank THB wire receipt', debitOrig: '120000.00', creditOrig: '0.00' },
          { accountCode: '4010', memo: 'Cold-chain fleet software milestone', debitOrig: '0.00', creditOrig: '120000.00' },
        ],
      },
      {
        entryType: 'INCOME',
        daysAgo: 55,
        currency: 'MMK',
        description: 'Yoma Fresh Retail Group — Omnichannel POS HQ Phase 1 Settlement',
        reference: 'INV-YF-2026-01',
        postImmediately: true,
        lines: [
          { accountCode: '1020', memo: 'KBZ Bank MMK receipt', debitOrig: '12500000.00', creditOrig: '0.00' },
          { accountCode: '4010', memo: 'Retail HQ Phase 1 delivery', debitOrig: '0.00', creditOrig: '12500000.00' },
        ],
      },
      {
        entryType: 'EXPENSE',
        daysAgo: 52,
        currency: 'MMK',
        description: 'Monthly frontend & mobile contractor payouts — Htet Aung Lin & Nyi Nyi Zaw',
        reference: 'PAY-MM-M2',
        associateCode: 'THEA-HALN',
        postImmediately: true,
        lines: [
          { accountCode: '5010', memo: 'React HQ portal & Flutter offline POD sprints', debitOrig: '4100000.00', creditOrig: '0.00' },
          { accountCode: '1020', memo: 'KBZ Bank MMK disbursement', debitOrig: '0.00', creditOrig: '4100000.00' },
        ],
      },
      {
        entryType: 'EXPENSE',
        daysAgo: 48,
        currency: 'THB',
        description: 'Cloud infrastructure, LLM API tokens & developer SaaS (Month -2)',
        reference: 'BILL-CLD-M2',
        postImmediately: true,
        lines: [
          { accountCode: '5030', memo: 'OpenAI / Claude API & staging cloud costs', debitOrig: '14500.00', creditOrig: '0.00' },
          { accountCode: '6010', memo: 'GitLab, Figma, Linear subscriptions', debitOrig: '9800.00', creditOrig: '0.00' },
          { accountCode: '6020', memo: 'GCP & MongoDB Atlas production clusters', debitOrig: '7600.00', creditOrig: '0.00' },
          { accountCode: '1030', memo: 'Corporate card settlement (THB)', debitOrig: '0.00', creditOrig: '31900.00' },
        ],
      },

      // Month -2: Ayeyarwady Agro OCR & MediTrust AI Retainer
      {
        entryType: 'INCOME',
        daysAgo: 34,
        currency: 'MMK',
        description: 'Ayeyarwady Agro Trading — Export Documentation OCR Phase 1 & 2',
        reference: 'INV-AA-2026-01',
        postImmediately: true,
        lines: [
          { accountCode: '1020', memo: 'KBZ Bank MMK settlement', debitOrig: '14800000.00', creditOrig: '0.00' },
          { accountCode: '4020', memo: 'AI & OCR automation delivery', debitOrig: '0.00', creditOrig: '14800000.00' },
        ],
      },
      {
        entryType: 'EXPENSE',
        daysAgo: 30,
        currency: 'THB',
        description: 'AI & Automation contractor payout — Su Myat Noe',
        reference: 'PAY-SMNO-M3',
        associateCode: 'THEA-SMNO',
        postImmediately: true,
        lines: [
          { accountCode: '5010', memo: 'Export OCR & MediTrust reagent forecast models', debitOrig: '54000.00', creditOrig: '0.00' },
          { accountCode: '1030', memo: 'SCB/KBank THB transfer', debitOrig: '0.00', creditOrig: '54000.00' },
        ],
      },
      {
        entryType: 'EXPENSE',
        daysAgo: 28,
        currency: 'MMK',
        description: 'Lead Product Design retainer — May Myat Noe Win',
        reference: 'PAY-MMNW-M3',
        associateCode: 'THEA-MMNW',
        postImmediately: true,
        lines: [
          { accountCode: '5020', memo: 'Design systems & Figma prototypes', debitOrig: '1600000.00', creditOrig: '0.00' },
          { accountCode: '1020', memo: 'AYA/KBZ Bank MMK transfer', debitOrig: '0.00', creditOrig: '1600000.00' },
        ],
      },

      // Current Month: Live Revenue, Contractor Payouts, OpEx & 1 Draft
      {
        entryType: 'INCOME',
        daysAgo: 12,
        currency: 'THB',
        description: 'MediTrust Diagnostics Yangon — LIMS Phase 2 & AI Triage Retainer',
        reference: 'INV-MT-2026-03',
        postImmediately: true,
        lines: [
          { accountCode: '1030', memo: 'KBank THB receipt', debitOrig: '155000.00', creditOrig: '0.00' },
          { accountCode: '4010', memo: 'LIMS barcode & HL7 bridge milestone', debitOrig: '0.00', creditOrig: '105000.00' },
          { accountCode: '4020', memo: 'AI reagent forecasting retainer', debitOrig: '0.00', creditOrig: '50000.00' },
        ],
      },
      {
        entryType: 'INCOME',
        daysAgo: 8,
        currency: 'MMK',
        description: 'Yoma Fresh Retail Group — Executive Analytics & Replenishment Milestone',
        reference: 'INV-YF-2026-02',
        postImmediately: true,
        lines: [
          { accountCode: '1020', memo: 'KBZ Bank MMK receipt', debitOrig: '11200000.00', creditOrig: '0.00' },
          { accountCode: '4010', memo: 'Omnichannel HQ Phase 2 milestone', debitOrig: '0.00', creditOrig: '11200000.00' },
        ],
      },
      {
        entryType: 'EXPENSE',
        daysAgo: 6,
        currency: 'THB',
        description: 'Current-month backend & AI contractor payouts — Kyaw Zin Htet & Su Myat Noe',
        reference: 'PAY-THB-CUR',
        associateCode: 'THEA-KZHT',
        postImmediately: true,
        lines: [
          { accountCode: '5010', memo: 'Sprint engineering & AI delivery payouts', debitOrig: '116000.00', creditOrig: '0.00' },
          { accountCode: '1030', memo: 'KBank THB disbursements', debitOrig: '0.00', creditOrig: '116000.00' },
        ],
      },
      {
        entryType: 'EXPENSE',
        daysAgo: 5,
        currency: 'MMK',
        description: 'Current-month mobile & product design contractor payouts — Nyi Nyi Zaw & May Myat Noe Win',
        reference: 'PAY-MMK-CUR',
        associateCode: 'THEA-NNZW',
        postImmediately: true,
        lines: [
          { accountCode: '5010', memo: 'Flutter cold-chain driver app sprint', debitOrig: '1950000.00', creditOrig: '0.00' },
          { accountCode: '5020', memo: 'Client portal & dashboard UX design', debitOrig: '1600000.00', creditOrig: '0.00' },
          { accountCode: '1020', memo: 'KBZ/CB Bank MMK transfers', debitOrig: '0.00', creditOrig: '3550000.00' },
        ],
      },
      {
        entryType: 'EXPENSE',
        daysAgo: 3,
        currency: 'THB',
        description: 'Current-month LLM API usage, SaaS tooling & cloud hosting',
        reference: 'BILL-CLD-CUR',
        postImmediately: true,
        lines: [
          { accountCode: '5030', memo: 'OCR & forecasting model API tokens', debitOrig: '16800.00', creditOrig: '0.00' },
          { accountCode: '6010', memo: 'Developer tooling & Figma seats', debitOrig: '11200.00', creditOrig: '0.00' },
          { accountCode: '6020', memo: 'GCP Yangon/Singapore nodes & Atlas', debitOrig: '8900.00', creditOrig: '0.00' },
          { accountCode: '6060', memo: 'Cross-border bank wire fees', debitOrig: '850.00', creditOrig: '0.00' },
          { accountCode: '1030', memo: 'THB corporate settlement', debitOrig: '0.00', creditOrig: '37750.00' },
        ],
      },
      {
        entryType: 'EXPENSE',
        daysAgo: 2,
        currency: 'MMK',
        description: 'Yangon/Mandalay remote workspace stipends & corporate legal/accounting retainer',
        reference: 'OPEX-MM-CUR',
        postImmediately: true,
        lines: [
          { accountCode: '6050', memo: 'Team fiber, power backup & remote stipends', debitOrig: '1350000.00', creditOrig: '0.00' },
          { accountCode: '6040', memo: 'Myanmar tax filing & MSA legal review', debitOrig: '850000.00', creditOrig: '0.00' },
          { accountCode: '1020', memo: 'KBZ Bank MMK transfer', debitOrig: '0.00', creditOrig: '2200000.00' },
        ],
      },
      // 1 Realistic DRAFT journal awaiting CFO/Finance review & posting
      {
        entryType: 'EXPENSE',
        daysAgo: 1,
        currency: 'THB',
        description: 'Quarterly cloud security audit advisory fee — Min Khant Ko (Pending Review)',
        reference: 'DRAFT-SEC-Q4',
        associateCode: 'THEA-MKKO',
        postImmediately: false,
        lines: [
          { accountCode: '6040', memo: 'SOC2 & Cloud Armor quarterly review', debitOrig: '18000.00', creditOrig: '0.00' },
          { accountCode: '2010', memo: 'Contractor payable accrual', debitOrig: '0.00', creditOrig: '18000.00' },
        ],
      },
    ];

    for (const je of openingLedgerEntries) {
      await createJournalEntry(
        {
          entryType: je.entryType,
          entryDate: isoDateDaysAgo(je.daysAgo),
          currency: je.currency,
          description: je.description,
          reference: je.reference,
          associateId: je.associateCode ? (assocIdByCode.get(je.associateCode) ?? null) : null,
          lines: je.lines,
          postImmediately: je.postImmediately,
        },
        SYSTEM_ACTOR
      );
    }
  }

  console.log('[seed] Completed idempotent Myanmar seed for thea_hq.');
}

if (import.meta.main) {
  runSeed()
    .then(async () => {
      await closeMongo();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[seed] Failed:', err);
      await closeMongo();
      process.exit(1);
    });
}
