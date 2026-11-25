import { ObjectId } from 'mongodb';
import { closeMongo, connectMongo } from './mongo';
import { runMigrations } from './migrations';
import { CMS_SECTIONS, Collections } from './collections';
import { fxMicroToDecimal128, parseFxMicro } from '../../domain/accounting/money';
import { validateCmsSectionData } from '../../application/cms/cmsSchemas';
import { createJournalEntry } from '../../application/accounting/journalService';
import { upsertBudget } from '../../application/accounting/budgetService';
import { DEFAULT_GOOGLE_DRIVE_SYNC } from '../../application/crm/sheetSyncService';
import { SEED_ASSOCIATES, SEED_CMS_DATA } from './seedData';

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

  // 1. Seed daily THB -> MMK exchange rates (start of year + recent 14 days)
  const fxCol = Collections.exchangeRates();
  const currentYear = now.toISOString().slice(0, 4);
  const fxSeedEntries: Array<{ date: string; rate: string; notes: string }> = [
    { date: `${currentYear}-01-01`, rate: '132.500000', notes: 'Opening annual reference rate' },
  ];
  for (let d = 14; d >= 0; d--) {
    const rateVal = (134.5 + ((14 - d) % 3) * 0.25).toFixed(6);
    fxSeedEntries.push({
      date: isoDateDaysAgo(d),
      rate: d === 0 ? '135.000000' : rateVal,
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

  // 2. Seed real associates from webpage/src/lib/employeeData.ts & employeeCardUtils.ts
  const assocCol = Collections.associates();
  for (const assoc of SEED_ASSOCIATES) {
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

  // 4. Seed current-month budgets if none exist for this period
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
      { accountCode: '4010', currency: 'MMK', targetAmount: '25000000.00', notes: 'Monthly software sprint revenue target' },
      { accountCode: '4020', currency: 'MMK', targetAmount: '10000000.00', notes: 'AI & automation retainers target' },
      { accountCode: '5010', currency: 'THB', targetAmount: '80000.00', notes: 'Engineering contractor sprint allocation' },
      { accountCode: '6010', currency: 'THB', targetAmount: '15000.00', notes: 'SaaS, AI APIs, and dev tooling' },
      { accountCode: '6020', currency: 'THB', targetAmount: '10000.00', notes: 'Cloud hosting, Atlas, and domains' },
      { accountCode: '6050', currency: 'MMK', targetAmount: '1500000.00', notes: 'Remote stipends and coworking' },
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

  // 5. Seed opening double-entry journal entries ONLY if journal_entries is empty
  const existingJournals = await Collections.journalEntries().countDocuments({});
  if (existingJournals === 0) {
    const thiri = await assocCol.findOne({ employeeId: 'THEA-UWIS' });

    await createJournalEntry(
      {
        entryType: 'GENERAL',
        entryDate: isoDateDaysAgo(10),
        currency: 'MMK',
        description: 'Opening founder operating capital contribution',
        reference: 'CAP-OPEN-001',
        lines: [
          { accountCode: '1020', memo: 'Opening bank balance MMK', debitOrig: '40000000.00', creditOrig: '0.00' },
          { accountCode: '3010', memo: 'Founder capital equity', debitOrig: '0.00', creditOrig: '40000000.00' },
        ],
        postImmediately: true,
      },
      SYSTEM_ACTOR
    );

    await createJournalEntry(
      {
        entryType: 'INCOME',
        entryDate: isoDateDaysAgo(6),
        currency: 'THB',
        description: 'Milestone 1 custom software engineering sprint settlement',
        reference: 'INV-2026-001',
        lines: [
          { accountCode: '1030', memo: 'KBank THB receipt', debitOrig: '140000.00', creditOrig: '0.00' },
          { accountCode: '4010', memo: 'Custom software milestone revenue', debitOrig: '0.00', creditOrig: '140000.00' },
        ],
        postImmediately: true,
      },
      SYSTEM_ACTOR
    );

    await createJournalEntry(
      {
        entryType: 'INCOME',
        entryDate: isoDateDaysAgo(4),
        currency: 'MMK',
        description: 'Monthly AI & workflow automation retainer invoice',
        reference: 'INV-2026-002',
        lines: [
          { accountCode: '1020', memo: 'MMK bank deposit', debitOrig: '8500000.00', creditOrig: '0.00' },
          { accountCode: '4020', memo: 'AI & automation retainer', debitOrig: '0.00', creditOrig: '8500000.00' },
        ],
        postImmediately: true,
      },
      SYSTEM_ACTOR
    );

    await createJournalEntry(
      {
        entryType: 'EXPENSE',
        entryDate: isoDateDaysAgo(3),
        currency: 'THB',
        description: 'Engineering contractor sprint payout',
        reference: 'PAY-CON-001',
        associateId: thiri ? thiri._id.toHexString() : null,
        lines: [
          { accountCode: '5010', memo: 'Sprint delivery payout', debitOrig: '45000.00', creditOrig: '0.00' },
          { accountCode: '1030', memo: 'THB bank wire', debitOrig: '0.00', creditOrig: '45000.00' },
        ],
        postImmediately: true,
      },
      SYSTEM_ACTOR
    );

    await createJournalEntry(
      {
        entryType: 'EXPENSE',
        entryDate: isoDateDaysAgo(2),
        currency: 'THB',
        description: 'Monthly SaaS tooling, LLM API credits, and cloud hosting',
        reference: 'BILL-CLOUD-001',
        lines: [
          { accountCode: '6010', memo: 'GitLab, Figma, AI coding subscriptions', debitOrig: '9500.00', creditOrig: '0.00' },
          { accountCode: '6020', memo: 'GCP & MongoDB Atlas clusters', debitOrig: '6200.00', creditOrig: '0.00' },
          { accountCode: '1030', memo: 'Corporate card settlement (THB)', debitOrig: '0.00', creditOrig: '15700.00' },
        ],
        postImmediately: true,
      },
      SYSTEM_ACTOR
    );

    await createJournalEntry(
      {
        entryType: 'EXPENSE',
        entryDate: isoDateDaysAgo(1),
        currency: 'MMK',
        description: 'Monthly remote workspace and connectivity stipends',
        reference: 'STIPEND-001',
        lines: [
          { accountCode: '6050', memo: 'Remote work stipends', debitOrig: '950000.00', creditOrig: '0.00' },
          { accountCode: '1020', memo: 'MMK bank transfer', debitOrig: '0.00', creditOrig: '950000.00' },
        ],
        postImmediately: true,
      },
      SYSTEM_ACTOR
    );
  }

  console.log('[seed] Completed idempotent seed for thea_hq.');
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
