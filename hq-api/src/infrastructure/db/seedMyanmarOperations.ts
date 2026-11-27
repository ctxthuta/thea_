import { ObjectId } from 'mongodb';
import { moneyMinorToDecimal128, parseMoneyMinor, type CurrencyCode } from '../../domain/accounting/money';
import {
  Collections,
  type CrmAccountDoc,
  type CrmAccountStatus,
  type CrmContactDoc,
  type CrmDealDoc,
  type CrmDealStage,
  type CrmLeadDoc,
  type CrmLeadSource,
  type CrmLeadStatus,
  type ProjectDoc,
  type ProjectPhaseDoc,
  type ProjectStatus,
  type TicketCategory,
  type TicketDoc,
  type TicketPriority,
  type TicketSource,
  type TicketStatus,
} from './collections';

function dateOffset(daysFromToday: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function hoursAhead(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

interface SeedAccountSpec {
  portalSlug: string;
  portalAccessCode: string;
  name: string;
  normalizedDomain: string;
  website: string;
  industry: string;
  country: string;
  status: CrmAccountStatus;
  notes: string;
  contact: {
    fullName: string;
    email: string;
    phone: string;
    roleTitle: string;
  };
}

export const MYANMAR_SEED_ACCOUNTS: SeedAccountSpec[] = [
  {
    portalSlug: 'meditrust-yangon',
    portalAccessCode: 'MT-2026',
    name: 'MediTrust Diagnostics Yangon',
    normalizedDomain: 'meditrust-yangon.mm',
    website: 'https://meditrust-yangon.mm',
    industry: 'Healthcare Diagnostics',
    country: 'MM',
    status: 'ACTIVE_CLIENT',
    notes: 'Multi-branch clinical diagnostic network in Bahan, Kamayut, and Hlaing townships.',
    contact: {
      fullName: 'Dr. Zaw Min Htut',
      email: 'zawminhtut@meditrust-yangon.mm',
      phone: '+95 9 5120 88101',
      roleTitle: 'Medical & Operations Director',
    },
  },
  {
    portalSlug: 'shwetaung-logistics',
    portalAccessCode: 'ST-2026',
    name: 'Shwe Taung Logistics & Cold Chain',
    normalizedDomain: 'shwetaunglogistics.mm',
    website: 'https://shwetaunglogistics.mm',
    industry: 'Logistics & Cold Chain',
    country: 'MM',
    status: 'ACTIVE_CLIENT',
    notes: 'Refrigerated fleet operating Yangon–Mandalay–Muse and Myawaddy cross-border corridors.',
    contact: {
      fullName: 'U Myo Thant',
      email: 'myothant@shwetaunglogistics.mm',
      phone: '+95 9 4301 77290',
      roleTitle: 'Head of Fleet & Supply Chain',
    },
  },
  {
    portalSlug: 'yoma-fresh',
    portalAccessCode: 'YF-2026',
    name: 'Yoma Fresh Retail Group',
    normalizedDomain: 'yomafresh.mm',
    website: 'https://yomafresh.mm',
    industry: 'Retail & F&B',
    country: 'MM',
    status: 'ACTIVE_CLIENT',
    notes: '18 neighborhood grocery & fresh produce stores across Yangon and Nay Pyi Taw.',
    contact: {
      fullName: 'Daw Ei Mon Kyaw',
      email: 'eimonkyaw@yomafresh.mm',
      phone: '+95 9 7890 34112',
      roleTitle: 'Retail Operations Director',
    },
  },
  {
    portalSlug: 'ayeyarwady-agro',
    portalAccessCode: 'AA-2026',
    name: 'Ayeyarwady Agro Trading Co.',
    normalizedDomain: 'ayeyaragro.mm',
    website: 'https://ayeyaragro.mm',
    industry: 'Agri-Trade & Export',
    country: 'MM',
    status: 'ACTIVE_CLIENT',
    notes: 'Pulses, rice, and sesame exporter operating Pathein mills and Yangon port documentation.',
    contact: {
      fullName: 'Ko Phyo Wai Yan',
      email: 'phyowaiyan@ayeyaragro.mm',
      phone: '+95 9 7742 10984',
      roleTitle: 'Export Operations Manager',
    },
  },
  {
    portalSlug: 'bagan-heritage',
    portalAccessCode: 'BH-2026',
    name: 'Bagan Heritage Hospitality',
    normalizedDomain: 'baganheritage.mm',
    website: 'https://baganheritage.mm',
    industry: 'Hospitality',
    country: 'MM',
    status: 'PROSPECT',
    notes: 'Boutique resort group evaluating direct booking engine and PMS automation.',
    contact: {
      fullName: 'Ma Hnin Wai Lwin',
      email: 'hninwailwin@baganheritage.mm',
      phone: '+95 9 2588 64012',
      roleTitle: 'General Manager',
    },
  },
  {
    portalSlug: 'goldenstar-pharma',
    portalAccessCode: 'GS-2026',
    name: 'Golden Star Pharmacy Network',
    normalizedDomain: 'goldenstarpharma.mm',
    website: 'https://goldenstarpharma.mm',
    industry: 'Healthcare Retail',
    country: 'MM',
    status: 'PROSPECT',
    notes: 'Pharmacy chain looking for batch-expiry ERP modernization and supplier EDI.',
    contact: {
      fullName: 'U Ye Lin Aung',
      email: 'yelinaung@goldenstarpharma.mm',
      phone: '+95 9 4211 90345',
      roleTitle: 'Managing Director',
    },
  },
];

export async function seedMyanmarCrmProjectsTickets(): Promise<{
  accountBySlug: Map<string, ObjectId>;
  projectByCode: Map<string, ObjectId>;
}> {
  const now = new Date();
  const accountBySlug = new Map<string, ObjectId>();
  const contactBySlug = new Map<string, ObjectId>();

  // 1. Seed CRM Accounts & Contacts idempotently
  for (const spec of MYANMAR_SEED_ACCOUNTS) {
    let acct = await Collections.crmAccounts().findOne({
      $or: [{ portalSlug: spec.portalSlug }, { normalizedDomain: spec.normalizedDomain }],
    });
    if (!acct) {
      const doc: CrmAccountDoc = {
        _id: new ObjectId(),
        name: spec.name,
        normalizedDomain: spec.normalizedDomain,
        industry: spec.industry,
        country: spec.country,
        website: spec.website,
        status: spec.status,
        ownerId: 'static-super-admin',
        notes: spec.notes,
        portalSlug: spec.portalSlug,
        portalAccessCode: spec.portalAccessCode,
        version: 1,
        createdAt: hoursAgo(24 * 60),
        updatedAt: now,
      };
      await Collections.crmAccounts().insertOne(doc);
      acct = doc;
    } else if (!acct.portalSlug || !acct.portalAccessCode) {
      await Collections.crmAccounts().updateOne(
        { _id: acct._id },
        {
          $set: {
            portalSlug: spec.portalSlug,
            portalAccessCode: spec.portalAccessCode,
            updatedAt: now,
          },
        }
      );
    }
    accountBySlug.set(spec.portalSlug, acct._id);

    let contact = await Collections.crmContacts().findOne({ email: spec.contact.email });
    if (!contact) {
      const cDoc: CrmContactDoc = {
        _id: new ObjectId(),
        accountId: acct._id,
        fullName: spec.contact.fullName,
        email: spec.contact.email,
        phone: spec.contact.phone,
        roleTitle: spec.contact.roleTitle,
        status: 'ACTIVE',
        version: 1,
        createdAt: hoursAgo(24 * 58),
        updatedAt: now,
      };
      await Collections.crmContacts().insertOne(cDoc);
      contact = cDoc;
    }
    contactBySlug.set(spec.portalSlug, contact._id);
  }

  // 2. Seed CRM Deals across all 6 stages (only if none of these titles exist)
  const seedDeals: Array<{
    slug: string;
    title: string;
    stage: CrmDealStage;
    currency: CurrencyCode;
    estimatedValue: string;
    probability: number;
    expectedCloseDate: string;
    lostReason: string | null;
  }> = [
    {
      slug: 'meditrust-yangon',
      title: 'MediTrust Cloud LIMS & Patient Portal Phase 2',
      stage: 'WON',
      currency: 'THB',
      estimatedValue: '420000.00',
      probability: 100,
      expectedCloseDate: dateOffset(-35),
      lostReason: null,
    },
    {
      slug: 'shwetaung-logistics',
      title: 'Cold-Chain Telemetry & Driver Proof-of-Delivery Suite',
      stage: 'WON',
      currency: 'THB',
      estimatedValue: '360000.00',
      probability: 100,
      expectedCloseDate: dateOffset(-20),
      lostReason: null,
    },
    {
      slug: 'yoma-fresh',
      title: 'Yoma Fresh 18-Branch Central Replenishment & POS Sync',
      stage: 'NEGOTIATION',
      currency: 'MMK',
      estimatedValue: '38500000.00',
      probability: 80,
      expectedCloseDate: dateOffset(18),
      lostReason: null,
    },
    {
      slug: 'goldenstar-pharma',
      title: 'Golden Star Batch-Expiry ERP & Supplier EDI Rollout',
      stage: 'PROPOSAL',
      currency: 'MMK',
      estimatedValue: '46000000.00',
      probability: 60,
      expectedCloseDate: dateOffset(30),
      lostReason: null,
    },
    {
      slug: 'bagan-heritage',
      title: 'Bagan Heritage Direct Booking & Channel Manager AI',
      stage: 'SCOPING',
      currency: 'THB',
      estimatedValue: '195000.00',
      probability: 40,
      expectedCloseDate: dateOffset(45),
      lostReason: null,
    },
    {
      slug: 'ayeyarwady-agro',
      title: 'Legacy On-Prem Weighbridge Hardware Replacement',
      stage: 'LOST',
      currency: 'MMK',
      estimatedValue: '14000000.00',
      probability: 0,
      expectedCloseDate: dateOffset(-12),
      lostReason: 'Client opted for local hardware vendor bundle.',
    },
    {
      slug: 'goldenstar-pharma',
      title: 'Thea Finance AI Forecasting Pilot',
      stage: 'DISCOVERY',
      currency: 'THB',
      estimatedValue: '120000.00',
      probability: 25,
      expectedCloseDate: dateOffset(55),
      lostReason: null,
    },
  ];

  for (const d of seedDeals) {
    const existing = await Collections.crmDeals().findOne({ title: d.title });
    if (existing) continue;
    const accountId = accountBySlug.get(d.slug)!;
    const contactId = contactBySlug.get(d.slug) ?? null;
    const dealDoc: CrmDealDoc = {
      _id: new ObjectId(),
      accountId,
      primaryContactId: contactId,
      title: d.title,
      stage: d.stage,
      currency: d.currency,
      estimatedValue: moneyMinorToDecimal128(parseMoneyMinor(d.estimatedValue)),
      probability: d.probability,
      expectedCloseDate: d.expectedCloseDate,
      ownerId: 'static-super-admin',
      lostReason: d.lostReason,
      version: 1,
      createdAt: hoursAgo(24 * 30),
      updatedAt: now,
    };
    await Collections.crmDeals().insertOne(dealDoc);
  }

  // 3. Seed 8 Realistic Myanmar Website & Referral Leads
  const seedLeads: Array<{
    externalRef: string;
    source: CrmLeadSource;
    status: CrmLeadStatus;
    name: string;
    email: string;
    phone: string;
    company: string;
    notes: string;
    payload: Record<string, unknown>;
    utm: Record<string, unknown>;
    hoursOld: number;
  }> = [
    {
      externalRef: 'seed-mm-lead-01',
      source: 'WEB_DEMO_REQUEST',
      status: 'NEW',
      name: 'U Kyaw Thu Win',
      email: 'kyawthuwin@mandalaymills.mm',
      phone: '+95 9 4025 11290',
      company: 'Mandalay Crown Flour Mills',
      notes: 'Requested live demo of Thea Finance and automated mill production reporting.',
      payload: { productId: 'thea-finance', businessDomain: 'Food Manufacturing', scheduledDate: dateOffset(3), scheduledTime: '14:00' },
      utm: { source: 'linkedin', medium: 'social', campaign: 'mm-enterprise-ai' },
      hoursOld: 4,
    },
    {
      externalRef: 'seed-mm-lead-02',
      source: 'WEB_QUOTE',
      status: 'NEW',
      name: 'Daw Thinzar Oo',
      email: 'thinzaroo@yangonmedclinic.mm',
      phone: '+95 9 7910 55421',
      company: 'Yangon Specialist PolyClinic',
      notes: 'Needs bilingual patient appointment portal + KBZPay reconciliation.',
      payload: { serviceType: 'software', budgetRange: '10k+', timeline: '2-4months', projectDescription: 'Multi-doctor clinic portal with lab result PDFs and KBZPay auto-reconciliation.' },
      utm: { source: 'google', medium: 'organic' },
      hoursOld: 11,
    },
    {
      externalRef: 'seed-mm-lead-03',
      source: 'WEB_CONTACT',
      status: 'CONTACTED',
      name: 'Ko Sai Aung Kham',
      email: 'saiaungkham@shanhighlandcoffee.mm',
      phone: '+95 9 4588 73210',
      company: 'Shan Highland Specialty Coffee',
      notes: 'Initial intro call completed; preparing scoping brief for exporter traceability app.',
      payload: { serviceType: 'automation', projectDescription: 'Lot traceability and export invoice automation from Kalaw to Bangkok.' },
      utm: { source: 'direct' },
      hoursOld: 28,
    },
    {
      externalRef: 'seed-mm-lead-04',
      source: 'WEB_DEMO_REQUEST',
      status: 'QUALIFIED',
      name: 'Ma Ei Shwe Sin',
      email: 'eishwesin@mingalarlogistics.mm',
      phone: '+95 9 9723 88412',
      company: 'Mingalar Express Cargo',
      notes: 'Qualified for Dedicated Engineering Pod; reviewing fleet GPS API specs.',
      payload: { productId: 'thea-ops', businessDomain: 'Logistics & Parcel Delivery', scheduledDate: dateOffset(2), scheduledTime: '10:30' },
      utm: { source: 'referral', referrer: 'shwetaung-logistics' },
      hoursOld: 52,
    },
    {
      externalRef: 'seed-mm-lead-05',
      source: 'REFERRAL',
      status: 'QUALIFIED',
      name: 'U Ye Lin Aung',
      email: 'yelinaung@goldenstarpharma.mm',
      phone: '+95 9 4211 90345',
      company: 'Golden Star Pharmacy Network',
      notes: 'Referred by MediTrust director; active proposal stage.',
      payload: { serviceType: 'other', budgetRange: '10k+', timeline: '4-6months' },
      utm: { source: 'partner-referral' },
      hoursOld: 96,
    },
    {
      externalRef: 'seed-mm-lead-06',
      source: 'WEB_QUOTE',
      status: 'CONTACTED',
      name: 'Ma Hnin Wai Lwin',
      email: 'hninwailwin@baganheritage.mm',
      phone: '+95 9 2588 64012',
      company: 'Bagan Heritage Hospitality',
      notes: 'Discovery call booked for PMS integration.',
      payload: { serviceType: 'software', budgetRange: '5k-10k', timeline: '2-4months' },
      utm: { source: 'facebook', medium: 'paid' },
      hoursOld: 140,
    },
    {
      externalRef: 'seed-mm-lead-07',
      source: 'WEB_DEMO_REQUEST',
      status: 'CONVERTED',
      name: 'Dr. Zaw Min Htut',
      email: 'zawminhtut@meditrust-yangon.mm',
      phone: '+95 9 5120 88101',
      company: 'MediTrust Diagnostics Yangon',
      notes: 'Converted into active MediTrust LIMS & AI Lab Triage engagements.',
      payload: { productId: 'thea-actions', businessDomain: 'Healthcare Diagnostics' },
      utm: { source: 'direct' },
      hoursOld: 24 * 45,
    },
    {
      externalRef: 'seed-mm-lead-08',
      source: 'WEB_QUOTE',
      status: 'CONVERTED',
      name: 'U Myo Thant',
      email: 'myothant@shwetaunglogistics.mm',
      phone: '+95 9 4301 77290',
      company: 'Shwe Taung Logistics & Cold Chain',
      notes: 'Converted into active Cold-Chain Telemetry & Driver Mobile App projects.',
      payload: { serviceType: 'software', budgetRange: '10k+', timeline: '2-4months' },
      utm: { source: 'linkedin' },
      hoursOld: 24 * 38,
    },
  ];

  for (const lead of seedLeads) {
    const existing = await Collections.crmLeads().findOne({ externalRef: lead.externalRef });
    if (existing) continue;
    const createdAt = hoursAgo(lead.hoursOld);
    const lDoc: CrmLeadDoc = {
      _id: new ObjectId(),
      source: lead.source,
      status: lead.status,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      notes: lead.notes,
      externalRef: lead.externalRef,
      payload: lead.payload,
      utm: lead.utm,
      convertedAccountId:
        lead.status === 'CONVERTED'
          ? (lead.email.includes('meditrust')
              ? (accountBySlug.get('meditrust-yangon') ?? null)
              : (accountBySlug.get('shwetaung-logistics') ?? null))
          : null,
      convertedContactId: null,
      convertedDealId: null,
      convertedAt: lead.status === 'CONVERTED' ? hoursAgo(lead.hoursOld - 48) : null,
      version: 1,
      createdAt,
      updatedAt: now,
    };
    await Collections.crmLeads().insertOne(lDoc);
  }

  // Load associates by employeeId for project leads & ticket assignees
  const allAssociates = await Collections.associates().find({}).toArray();
  const assocByCode = new Map(allAssociates.map((a) => [a.employeeId, a._id]));

  // 4. Seed 6 Realistic Myanmar Client Projects with 4-6 Delivery Phases & Milestones each
  const seedProjects: Array<{
    code: string;
    accountSlug: string;
    leadCode: string;
    name: string;
    status: ProjectStatus;
    summary: string;
    currency: CurrencyCode;
    budgetAmount: string;
    startDate: string;
    targetEndDate: string;
    phases: ProjectPhaseDoc[];
  }> = [
    {
      code: 'PRJ-2026-001',
      accountSlug: 'meditrust-yangon',
      leadCode: 'THEA-KZHT',
      name: 'Cloud LIMS & Multi-Branch Specimen Tracking',
      status: 'ACTIVE',
      summary:
        'End-to-end Laboratory Information Management System connecting Bahan, Kamayut, and Hlaing diagnostic labs with barcode tracking, analyzer HL7 ingestion, and signed PDF reports.',
      currency: 'THB',
      budgetAmount: '280000.00',
      startDate: dateOffset(-75),
      targetEndDate: dateOffset(35),
      phases: [
        {
          id: 'mt-lims-p1',
          name: 'Phase 1: Lab Workflow Discovery & HL7 Schema',
          order: 1,
          status: 'COMPLETED',
          startDate: dateOffset(-75),
          targetDate: dateOffset(-60),
          progressPct: 100,
          summary: 'Audited hematology, chemistry, and PCR analyzers across 3 Yangon branches.',
          milestones: [
            { id: 'mt-lims-m1', title: 'Analyzer Interface Specification (HL7/ASTM)', deliveryDate: dateOffset(-65), status: 'COMPLETED', completedAt: dateOffset(-66), deliverableNote: 'Signed off by Dr. Zaw Min Htut' },
            { id: 'mt-lims-m2', title: 'Multi-Branch Database & RBAC Blueprint', deliveryDate: dateOffset(-60), status: 'COMPLETED', completedAt: dateOffset(-60), deliverableNote: 'Includes pathologist dual-signature rules' },
          ],
        },
        {
          id: 'mt-lims-p2',
          name: 'Phase 2: Specimen Barcode & Accessioning Core',
          order: 2,
          status: 'COMPLETED',
          startDate: dateOffset(-59),
          targetDate: dateOffset(-32),
          progressPct: 100,
          summary: 'Accessioning queue, Zebra thermal barcode printing, and courier chain-of-custody.',
          milestones: [
            { id: 'mt-lims-m3', title: 'Accessioning & Zebra Label Printing API', deliveryDate: dateOffset(-45), status: 'COMPLETED', completedAt: dateOffset(-44), deliverableNote: 'Tested at Bahan main lab' },
            { id: 'mt-lims-m4', title: 'Inter-Branch Courier Manifest Tracking', deliveryDate: dateOffset(-32), status: 'COMPLETED', completedAt: dateOffset(-31), deliverableNote: 'Live on staging with QR handoffs' },
          ],
        },
        {
          id: 'mt-lims-p3',
          name: 'Phase 3: Analyzer Auto-Ingestion & Pathologist Sign-Off',
          order: 3,
          status: 'IN_PROGRESS',
          startDate: dateOffset(-31),
          targetDate: dateOffset(7),
          progressPct: 75,
          summary: 'Automated Roche Cobas & Sysmex result ingestion with critical-value alerts.',
          milestones: [
            { id: 'mt-lims-m5', title: 'Sysmex XN-1000 Bidirectional Bridge', deliveryDate: dateOffset(-10), status: 'COMPLETED', completedAt: dateOffset(-9), deliverableNote: '99.98% match rate in parallel run' },
            { id: 'mt-lims-m6', title: 'Pathologist Digital Sign-Off & QR Verification PDF', deliveryDate: dateOffset(4), status: 'IN_PROGRESS', completedAt: null, deliverableNote: 'Final Myanmar Unicode font polish underway' },
            { id: 'mt-lims-m7', title: 'Critical Value SMS/Viber Escalation Alerts', deliveryDate: dateOffset(7), status: 'PENDING', completedAt: null, deliverableNote: 'Awaiting MPT SMS gateway sender ID approval' },
          ],
        },
        {
          id: 'mt-lims-p4',
          name: 'Phase 4: Patient Portal & Production Cutover',
          order: 4,
          status: 'UPCOMING',
          startDate: dateOffset(8),
          targetDate: dateOffset(35),
          progressPct: 15,
          summary: 'Zero-downtime migration from legacy FoxPro records and branch staff training.',
          milestones: [
            { id: 'mt-lims-m8', title: 'Patient Mobile Results Lookup Portal', deliveryDate: dateOffset(22), status: 'PENDING', completedAt: null, deliverableNote: 'OTP verified download with QR verification' },
            { id: 'mt-lims-m9', title: 'All-Branch Go-Live & 30-Day Hypercare', deliveryDate: dateOffset(35), status: 'PENDING', completedAt: null, deliverableNote: 'Weekend cutover with rollback drill' },
          ],
        },
      ],
    },
    {
      code: 'PRJ-2026-002',
      accountSlug: 'meditrust-yangon',
      leadCode: 'THEA-SMNO',
      name: 'AI Lab Report Triage & Reagent Inventory Forecasting',
      status: 'ACTIVE',
      summary:
        'Automated anomaly flagging for high-volume diagnostic panels and predictive reagent reorder alerts to prevent stockouts across Yangon labs.',
      currency: 'THB',
      budgetAmount: '140000.00',
      startDate: dateOffset(-40),
      targetEndDate: dateOffset(45),
      phases: [
        {
          id: 'mt-ai-p1',
          name: 'Phase 1: Historical Panel Dataset & Privacy Redaction',
          order: 1,
          status: 'COMPLETED',
          startDate: dateOffset(-40),
          targetDate: dateOffset(-25),
          progressPct: 100,
          summary: 'De-identified 18 months of lab volume and reagent consumption logs.',
          milestones: [
            { id: 'mt-ai-m1', title: 'PII Scrubbing & Clinical Taxonomy Mapping', deliveryDate: dateOffset(-30), status: 'COMPLETED', completedAt: dateOffset(-31), deliverableNote: 'Zero PII leaves Yangon VPC' },
            { id: 'mt-ai-m2', title: 'Reagent Consumption Baseline Report', deliveryDate: dateOffset(-25), status: 'COMPLETED', completedAt: dateOffset(-25), deliverableNote: 'Identified 14% cold-reagent wastage reduction target' },
          ],
        },
        {
          id: 'mt-ai-p2',
          name: 'Phase 2: Predictive Reorder Engine',
          order: 2,
          status: 'IN_PROGRESS',
          startDate: dateOffset(-24),
          targetDate: dateOffset(10),
          progressPct: 60,
          summary: 'Forecasting dengue/seasonal test surges and 21-day supplier lead times.',
          milestones: [
            { id: 'mt-ai-m3', title: 'Weekly Reagent Forecast API & Dashboard', deliveryDate: dateOffset(2), status: 'IN_PROGRESS', completedAt: null, deliverableNote: 'Accuracy within 6.4% MAPE on backtest' },
            { id: 'mt-ai-m4', title: 'Low-Stock & Expiry Alert Digest', deliveryDate: dateOffset(10), status: 'PENDING', completedAt: null, deliverableNote: 'Automated procurement draft POs' },
          ],
        },
        {
          id: 'mt-ai-p3',
          name: 'Phase 3: Clinical Anomaly Review Copilot',
          order: 3,
          status: 'UPCOMING',
          startDate: dateOffset(11),
          targetDate: dateOffset(30),
          progressPct: 0,
          summary: 'Human-in-the-loop flagging of delta-check outliers prior to pathologist release.',
          milestones: [
            { id: 'mt-ai-m5', title: 'Delta-Check Rule Engine & Audit Trail', deliveryDate: dateOffset(24), status: 'PENDING', completedAt: null, deliverableNote: 'Strict clinician approval required' },
            { id: 'mt-ai-m6', title: 'Pathologist Feedback Calibration', deliveryDate: dateOffset(30), status: 'PENDING', completedAt: null, deliverableNote: '2-week shadow validation' },
          ],
        },
        {
          id: 'mt-ai-p4',
          name: 'Phase 4: Production Rollout & SLA Handover',
          order: 4,
          status: 'UPCOMING',
          startDate: dateOffset(31),
          targetDate: dateOffset(45),
          progressPct: 0,
          summary: 'Deployment onto MediTrust private cloud with observability dashboards.',
          milestones: [
            { id: 'mt-ai-m7', title: 'Security Sign-Off & Telemetry Alerts', deliveryDate: dateOffset(40), status: 'PENDING', completedAt: null, deliverableNote: 'Reviewed by Cloud Security Advisor' },
            { id: 'mt-ai-m8', title: 'Team Training & Production Launch', deliveryDate: dateOffset(45), status: 'PENDING', completedAt: null, deliverableNote: 'Lab managers & procurement team onboarded' },
          ],
        },
      ],
    },
    {
      code: 'PRJ-2026-003',
      accountSlug: 'shwetaung-logistics',
      leadCode: 'THEA-NNZW',
      name: 'Cold-Chain Fleet Telemetry & Driver Mobile App',
      status: 'ACTIVE',
      summary:
        'Offline-first Flutter driver app and real-time cold-chain dispatch console tracking reefer truck temperatures along Yangon–Mandalay–Muse corridors.',
      currency: 'THB',
      budgetAmount: '240000.00',
      startDate: dateOffset(-65),
      targetEndDate: dateOffset(20),
      phases: [
        {
          id: 'st-fleet-p1',
          name: 'Phase 1: BLE Temperature Sensor & GPS Ingestion',
          order: 1,
          status: 'COMPLETED',
          startDate: dateOffset(-65),
          targetDate: dateOffset(-45),
          progressPct: 100,
          summary: 'MQTT/HTTPS telemetry pipeline ingesting 30-second temperature pings from 42 trucks.',
          milestones: [
            { id: 'st-fleet-m1', title: 'BLE Sensor Protocol Adapter', deliveryDate: dateOffset(-52), status: 'COMPLETED', completedAt: dateOffset(-53), deliverableNote: 'Verified on cold-box units at Hlaing Tharyar depot' },
            { id: 'st-fleet-m2', title: 'Time-Series Excursion Alert Engine', deliveryDate: dateOffset(-45), status: 'COMPLETED', completedAt: dateOffset(-45), deliverableNote: 'Triggers alert when > +8C for 10 mins' },
          ],
        },
        {
          id: 'st-fleet-p2',
          name: 'Phase 2: Offline-First Driver POD Flutter App',
          order: 2,
          status: 'COMPLETED',
          startDate: dateOffset(-44),
          targetDate: dateOffset(-15),
          progressPct: 100,
          summary: 'Myanmar-language driver mobile app with offline SQLite queue, photo POD, and e-signature.',
          milestones: [
            { id: 'st-fleet-m3', title: 'Offline Sync & Conflict Resolution Engine', deliveryDate: dateOffset(-25), status: 'COMPLETED', completedAt: dateOffset(-24), deliverableNote: 'Tested across 6-hour zero-signal stretch' },
            { id: 'st-fleet-m4', title: 'Digital Waybill & Photo Proof-of-Delivery', deliveryDate: dateOffset(-15), status: 'COMPLETED', completedAt: dateOffset(-14), deliverableNote: 'Installed on 15 pilot drivers' },
          ],
        },
        {
          id: 'st-fleet-p3',
          name: 'Phase 3: Live Dispatch Command Console',
          order: 3,
          status: 'IN_PROGRESS',
          startDate: dateOffset(-14),
          targetDate: dateOffset(8),
          progressPct: 80,
          summary: 'Real-time map, cold-chain compliance certificates, and customer tracking links.',
          milestones: [
            { id: 'st-fleet-m5', title: 'Live Fleet Map & Temperature Heatmap', deliveryDate: dateOffset(-2), status: 'COMPLETED', completedAt: dateOffset(-1), deliverableNote: 'Live for Yangon dispatchers' },
            { id: 'st-fleet-m6', title: 'Automated Cold-Chain Certificate PDF Export', deliveryDate: dateOffset(8), status: 'IN_PROGRESS', completedAt: null, deliverableNote: 'Adding customer digital stamp layout' },
          ],
        },
        {
          id: 'st-fleet-p4',
          name: 'Phase 4: Full 42-Truck Fleet Rollout',
          order: 4,
          status: 'UPCOMING',
          startDate: dateOffset(9),
          targetDate: dateOffset(20),
          progressPct: 10,
          summary: 'Driver onboarding in Yangon & Mandalay depots and 24/7 SLA alerting.',
          milestones: [
            { id: 'st-fleet-m7', title: 'Mandalay Depot Driver Training', deliveryDate: dateOffset(14), status: 'PENDING', completedAt: null, deliverableNote: '2-day onsite workshop' },
            { id: 'st-fleet-m8', title: 'Full Fleet Go-Live Sign-Off', deliveryDate: dateOffset(20), status: 'PENDING', completedAt: null, deliverableNote: 'All 42 reefers reporting live' },
          ],
        },
      ],
    },
    {
      code: 'PRJ-2026-004',
      accountSlug: 'shwetaung-logistics',
      leadCode: 'THEA-KZHT',
      name: 'Cross-Border Waybill & Billing Automation (Myawaddy/Mae Sot)',
      status: 'ACTIVE',
      summary:
        'Automated bilingual waybill generation, dual-currency MMK/THB freight invoicing, and customs checkpoint status tracking.',
      currency: 'THB',
      budgetAmount: '120000.00',
      startDate: dateOffset(-30),
      targetEndDate: dateOffset(40),
      phases: [
        {
          id: 'st-bill-p1',
          name: 'Phase 1: Freight Tariff & Dual-Currency Rules',
          order: 1,
          status: 'COMPLETED',
          startDate: dateOffset(-30),
          targetDate: dateOffset(-16),
          progressPct: 100,
          summary: 'Modeled zone-based MMK and THB freight tariffs, detention charges, and fuel surcharges.',
          milestones: [
            { id: 'st-bill-m1', title: 'Tariff Matrix & FX Stamping Spec', deliveryDate: dateOffset(-20), status: 'COMPLETED', completedAt: dateOffset(-21), deliverableNote: 'Approved by Shwe Taung Finance' },
            { id: 'st-bill-m2', title: 'Customs Checkpoint Event Model', deliveryDate: dateOffset(-16), status: 'COMPLETED', completedAt: dateOffset(-16), deliverableNote: 'Covers Myawaddy & Mae Sot crossings' },
          ],
        },
        {
          id: 'st-bill-p2',
          name: 'Phase 2: Automated Waybill & Invoice Engine',
          order: 2,
          status: 'DELAYED',
          startDate: dateOffset(-15),
          targetDate: dateOffset(10),
          progressPct: 45,
          summary: 'Auto-generates consolidated weekly client invoices from verified POD events.',
          milestones: [
            { id: 'st-bill-m3', title: 'POD-to-Invoice Batch Pipeline', deliveryDate: dateOffset(3), status: 'AT_RISK', completedAt: null, deliverableNote: 'Waiting on revised customs tax template from client' },
            { id: 'st-bill-m4', title: 'Accounting CSV & API Export Bridge', deliveryDate: dateOffset(10), status: 'PENDING', completedAt: null, deliverableNote: 'Reconciles MMK and THB receivables' },
          ],
        },
        {
          id: 'st-bill-p3',
          name: 'Phase 3: Client Billing Portal Integration',
          order: 3,
          status: 'UPCOMING',
          startDate: dateOffset(11),
          targetDate: dateOffset(28),
          progressPct: 0,
          summary: 'Self-service waybill downloads and payment proof uploads.',
          milestones: [
            { id: 'st-bill-m5', title: 'Consignee Waybill Lookup', deliveryDate: dateOffset(22), status: 'PENDING', completedAt: null, deliverableNote: 'Scoped per consignee code' },
            { id: 'st-bill-m6', title: 'Finance Reconciliation Report', deliveryDate: dateOffset(28), status: 'PENDING', completedAt: null, deliverableNote: 'Daily aging snapshot' },
          ],
        },
        {
          id: 'st-bill-p4',
          name: 'Phase 4: UAT & Go-Live',
          order: 4,
          status: 'UPCOMING',
          startDate: dateOffset(29),
          targetDate: dateOffset(40),
          progressPct: 0,
          summary: 'Parallel billing run for one week before full production switchover.',
          milestones: [
            { id: 'st-bill-m7', title: 'Parallel Invoice Audit', deliveryDate: dateOffset(35), status: 'PENDING', completedAt: null, deliverableNote: '100% match against manual ledger' },
            { id: 'st-bill-m8', title: 'Production Cutover', deliveryDate: dateOffset(40), status: 'PENDING', completedAt: null, deliverableNote: 'Live billing enabled' },
          ],
        },
      ],
    },
    {
      code: 'PRJ-2026-005',
      accountSlug: 'yoma-fresh',
      leadCode: 'THEA-HALN',
      name: 'Omnichannel Retail HQ & 18-Branch Inventory Replenishment',
      status: 'ACTIVE',
      summary:
        'Centralized merchandise dashboard aggregating daily POS sales from 18 Yangon & Nay Pyi Taw stores with automated fresh-produce replenishment orders.',
      currency: 'MMK',
      budgetAmount: '32000000.00',
      startDate: dateOffset(-50),
      targetEndDate: dateOffset(25),
      phases: [
        {
          id: 'yf-pos-p1',
          name: 'Phase 1: Branch POS Data Connector & SKU Master',
          order: 1,
          status: 'COMPLETED',
          startDate: dateOffset(-50),
          targetDate: dateOffset(-32),
          progressPct: 100,
          summary: 'Unified 6,400+ retail SKUs and synced nightly/hourly POS sales feeds.',
          milestones: [
            { id: 'yf-pos-m1', title: 'Unified SKU & Barcode Catalog Cleanup', deliveryDate: dateOffset(-40), status: 'COMPLETED', completedAt: dateOffset(-39), deliverableNote: 'Deduplicated 412 legacy barcodes' },
            { id: 'yf-pos-m2', title: 'Real-Time Branch Sales Ingestion Worker', deliveryDate: dateOffset(-32), status: 'COMPLETED', completedAt: dateOffset(-32), deliverableNote: 'Sub-2-minute lag across all 18 stores' },
          ],
        },
        {
          id: 'yf-pos-p2',
          name: 'Phase 2: Executive Margin & Shrinkage Analytics',
          order: 2,
          status: 'COMPLETED',
          startDate: dateOffset(-31),
          targetDate: dateOffset(-10),
          progressPct: 100,
          summary: 'Real-time store-by-store gross margin, spoilage tracking, and promo ROI.',
          milestones: [
            { id: 'yf-pos-m3', title: 'Store P&L & Fresh Spoilage Dashboard', deliveryDate: dateOffset(-18), status: 'COMPLETED', completedAt: dateOffset(-17), deliverableNote: 'Reviewed by Daw Ei Mon Kyaw' },
            { id: 'yf-pos-m4', title: 'Automated Daily Viber/Email Executive Digest', deliveryDate: dateOffset(-10), status: 'COMPLETED', completedAt: dateOffset(-10), deliverableNote: 'Delivered at 07:30 MMT daily' },
          ],
        },
        {
          id: 'yf-pos-p3',
          name: 'Phase 3: Automated Central Warehouse Replenishment',
          order: 3,
          status: 'IN_PROGRESS',
          startDate: dateOffset(-9),
          targetDate: dateOffset(12),
          progressPct: 55,
          summary: 'Generates morning pick-lists and inter-store transfer orders based on par levels.',
          milestones: [
            { id: 'yf-pos-m5', title: 'Par-Level Auto-Order Algorithm', deliveryDate: dateOffset(2), status: 'IN_PROGRESS', completedAt: null, deliverableNote: 'Piloting at Yankin & Bahan flagship stores' },
            { id: 'yf-pos-m6', title: 'Warehouse Pick-List & Dispatch Printing', deliveryDate: dateOffset(12), status: 'PENDING', completedAt: null, deliverableNote: 'Thermal & A4 pick-list templates' },
          ],
        },
        {
          id: 'yf-pos-p4',
          name: 'Phase 4: Store Manager Training & Full Launch',
          order: 4,
          status: 'UPCOMING',
          startDate: dateOffset(13),
          targetDate: dateOffset(25),
          progressPct: 0,
          summary: 'Rollout to all 18 branches including Nay Pyi Taw.',
          milestones: [
            { id: 'yf-pos-m7', title: 'Branch Manager Onboarding Workshops', deliveryDate: dateOffset(20), status: 'PENDING', completedAt: null, deliverableNote: '3 regional cohorts' },
            { id: 'yf-pos-m8', title: 'Production Sign-Off & SLA Support', deliveryDate: dateOffset(25), status: 'PENDING', completedAt: null, deliverableNote: '30-day warranty begins' },
          ],
        },
      ],
    },
    {
      code: 'PRJ-2026-006',
      accountSlug: 'ayeyarwady-agro',
      leadCode: 'THEA-SMNO',
      name: 'Export Documentation OCR & Customs Compliance Portal',
      status: 'ACTIVE',
      summary:
        'AI document extraction pipeline validating phytosanitary certificates, bills of lading, and packing lists for agricultural shipments from Pathein & Yangon ports.',
      currency: 'MMK',
      budgetAmount: '24500000.00',
      startDate: dateOffset(-45),
      targetEndDate: dateOffset(18),
      phases: [
        {
          id: 'aa-ocr-p1',
          name: 'Phase 1: Document Taxonomy & OCR Training Set',
          order: 1,
          status: 'COMPLETED',
          startDate: dateOffset(-45),
          targetDate: dateOffset(-30),
          progressPct: 100,
          summary: 'Cataloged 9 export document types across India, China, and Singapore buyers.',
          milestones: [
            { id: 'aa-ocr-m1', title: 'Export Document Schema & Validation Rules', deliveryDate: dateOffset(-35), status: 'COMPLETED', completedAt: dateOffset(-36), deliverableNote: 'Covers HS codes, lot weights, and LC terms' },
            { id: 'aa-ocr-m2', title: 'OCR Extraction Accuracy Benchmark (>98%)', deliveryDate: dateOffset(-30), status: 'COMPLETED', completedAt: dateOffset(-29), deliverableNote: 'Achieved 98.7% field accuracy' },
          ],
        },
        {
          id: 'aa-ocr-p2',
          name: 'Phase 2: Automated LC Discrepancy Checker',
          order: 2,
          status: 'COMPLETED',
          startDate: dateOffset(-29),
          targetDate: dateOffset(-8),
          progressPct: 100,
          summary: 'Cross-checks Letter of Credit clauses against packing lists and B/L drafts in seconds.',
          milestones: [
            { id: 'aa-ocr-m3', title: 'LC vs. Bill of Lading Cross-Check Engine', deliveryDate: dateOffset(-16), status: 'COMPLETED', completedAt: dateOffset(-15), deliverableNote: 'Caught 4 real discrepancies in pilot batch' },
            { id: 'aa-ocr-m4', title: 'Export Officer Review UI', deliveryDate: dateOffset(-8), status: 'COMPLETED', completedAt: dateOffset(-8), deliverableNote: 'Side-by-side PDF highlight view' },
          ],
        },
        {
          id: 'aa-ocr-p3',
          name: 'Phase 3: Pathein Mill Integration & Audit Archive',
          order: 3,
          status: 'IN_PROGRESS',
          startDate: dateOffset(-7),
          targetDate: dateOffset(10),
          progressPct: 70,
          summary: 'Connects Pathein warehouse lot certificates directly to Yangon export desk.',
          milestones: [
            { id: 'aa-ocr-m5', title: 'Pathein Lot Certificate Uploader', deliveryDate: dateOffset(3), status: 'IN_PROGRESS', completedAt: null, deliverableNote: 'Low-bandwidth mobile scan compression' },
            { id: 'aa-ocr-m6', title: '7-Year Encrypted Compliance Archive', deliveryDate: dateOffset(10), status: 'PENDING', completedAt: null, deliverableNote: 'Exportable audit packs per shipment' },
          ],
        },
        {
          id: 'aa-ocr-p4',
          name: 'Phase 4: Go-Live & Export Desk Handover',
          order: 4,
          status: 'UPCOMING',
          startDate: dateOffset(11),
          targetDate: dateOffset(18),
          progressPct: 0,
          summary: 'Final acceptance testing with live container shipments.',
          milestones: [
            { id: 'aa-ocr-m7', title: 'Live Shipment Acceptance Sign-Off', deliveryDate: dateOffset(15), status: 'PENDING', completedAt: null, deliverableNote: '5 consecutive containers verified' },
            { id: 'aa-ocr-m8', title: 'Handover & Quarterly SLA Kickoff', deliveryDate: dateOffset(18), status: 'PENDING', completedAt: null, deliverableNote: 'Documentation & support runbook' },
          ],
        },
      ],
    },
  ];

  const projectByCode = new Map<string, ObjectId>();
  let maxPrjSeq = 0;

  for (const spec of seedProjects) {
    let existing = await Collections.projects().findOne({ code: spec.code });
    if (!existing) {
      const doc: ProjectDoc = {
        _id: new ObjectId(),
        code: spec.code,
        name: spec.name,
        accountId: accountBySlug.get(spec.accountSlug)!,
        dealId: null,
        leadAssociateId: assocByCode.get(spec.leadCode) ?? null,
        status: spec.status,
        summary: spec.summary,
        currency: spec.currency,
        budgetAmount: moneyMinorToDecimal128(parseMoneyMinor(spec.budgetAmount)),
        startDate: spec.startDate,
        targetEndDate: spec.targetEndDate,
        phases: spec.phases,
        version: 1,
        createdBy: 'seed-script',
        createdAt: hoursAgo(24 * 40),
        updatedAt: now,
      };
      await Collections.projects().insertOne(doc);
      existing = doc;
    }
    projectByCode.set(spec.code, existing._id);
    const seqNum = Number.parseInt(spec.code.split('-')[2] ?? '0', 10);
    if (seqNum > maxPrjSeq) maxPrjSeq = seqNum;
  }

  // Keep atomic project counter ahead of seeded project codes
  const prjYear = new Date().getUTCFullYear();
  await Collections.counters().updateOne(
    { _id: `PRJ-${prjYear}` },
    { $max: { seq: maxPrjSeq } },
    { upsert: true }
  );

  // 5. Seed 14 Realistic Myanmar Support & Delivery Tickets across the 4 Active Clients
  const seedTickets: Array<{
    ticketNumber: string;
    accountSlug: string;
    projectCode: string;
    phaseId: string;
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    source: TicketSource;
    requesterName: string;
    requesterEmail: string;
    assignedCode: string;
    hoursOld: number;
    comments: Array<{
      authorType: 'CLIENT' | 'TEAM';
      authorName: string;
      authorEmail: string;
      message: string;
      isInternalNote: boolean;
      hoursAgo: number;
    }>;
  }> = [
    {
      ticketNumber: 'TKT-2026-0001',
      accountSlug: 'meditrust-yangon',
      projectCode: 'PRJ-2026-001',
      phaseId: 'mt-lims-p3',
      title: 'Myanmar Unicode font clipping on hematology PDF report footer',
      description: 'When patient names include stacked Myanmar subscripts (Pyidaungsu), the bottom line of the Bahan branch PDF report overlaps the QR badge.',
      category: 'BUG',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      source: 'CLIENT_PORTAL',
      requesterName: 'Dr. Zaw Min Htut',
      requesterEmail: 'zawminhtut@meditrust-yangon.mm',
      assignedCode: 'THEA-HALN',
      hoursOld: 18,
      comments: [
        { authorType: 'CLIENT', authorName: 'Dr. Zaw Min Htut', authorEmail: 'zawminhtut@meditrust-yangon.mm', message: 'Attached sample accession #BH-261194 showing the footer overlap.', isInternalNote: false, hoursAgo: 17 },
        { authorType: 'TEAM', authorName: 'Htet Aung Lin', authorEmail: 'htetaunglin@theasolutions.co', message: 'Reproduced locally — Noto Sans Myanmar line-height needs 1.55 in Chromium PDF renderer. Patching template now.', isInternalNote: true, hoursAgo: 14 },
        { authorType: 'TEAM', authorName: 'Thiri Chan Nyein', authorEmail: 'thirichannyein@theasolutions.co', message: 'We have reproduced the spacing issue and are deploying an updated PDF layout to staging for your review this afternoon.', isInternalNote: false, hoursAgo: 12 },
      ],
    },
    {
      ticketNumber: 'TKT-2026-0002',
      accountSlug: 'meditrust-yangon',
      projectCode: 'PRJ-2026-001',
      phaseId: 'mt-lims-p3',
      title: 'Sysmex XN-1000 Kamayut branch intermittent ASTM timeout',
      description: 'Around 10:30 AM peak rush, two CBC batches took 40 seconds before appearing in the pathologist sign-off queue.',
      category: 'INFRASTRUCTURE',
      priority: 'URGENT',
      status: 'OPEN',
      source: 'CLIENT_PORTAL',
      requesterName: 'Dr. Zaw Min Htut',
      requesterEmail: 'zawminhtut@meditrust-yangon.mm',
      assignedCode: 'THEA-KZHT',
      hoursOld: 5,
      comments: [
        { authorType: 'TEAM', authorName: 'Kyaw Zin Htet', authorEmail: 'kyawzinhtet@theasolutions.co', message: 'Checking Kamayut local bridge buffer logs; looks like serial port flow control pause during backup power switchover.', isInternalNote: true, hoursAgo: 3 },
      ],
    },
    {
      ticketNumber: 'TKT-2026-0003',
      accountSlug: 'meditrust-yangon',
      projectCode: 'PRJ-2026-002',
      phaseId: 'mt-ai-p2',
      title: 'Add dengue NS1 kit lead-time override for rainy season',
      description: 'Suppliers require 28-day lead time during June–September instead of standard 14 days. Can procurement adjust lead time per reagent SKU?',
      category: 'FEATURE_REQUEST',
      priority: 'MEDIUM',
      status: 'WAITING_CLIENT',
      source: 'CLIENT_PORTAL',
      requesterName: 'Dr. Zaw Min Htut',
      requesterEmail: 'zawminhtut@meditrust-yangon.mm',
      assignedCode: 'THEA-SMNO',
      hoursOld: 46,
      comments: [
        { authorType: 'TEAM', authorName: 'Su Myat Noe', authorEmail: 'sumyatnoe@theasolutions.co', message: 'We added seasonal lead-time multipliers on staging. Could your procurement lead confirm the 6 seasonal SKUs to pre-populate?', isInternalNote: false, hoursAgo: 30 },
      ],
    },
    {
      ticketNumber: 'TKT-2026-0004',
      accountSlug: 'meditrust-yangon',
      projectCode: 'PRJ-2026-001',
      phaseId: 'mt-lims-p2',
      title: 'Zebra GK420t label calibration at Hlaing collection center',
      description: 'Barcode labels shifted 3mm right after replacing label roll.',
      category: 'SUPPORT',
      priority: 'LOW',
      status: 'RESOLVED',
      source: 'CLIENT_PORTAL',
      requesterName: 'Dr. Zaw Min Htut',
      requesterEmail: 'zawminhtut@meditrust-yangon.mm',
      assignedCode: 'THEA-CSWE',
      hoursOld: 120,
      comments: [
        { authorType: 'TEAM', authorName: 'Chue Yamin Lwin', authorEmail: 'chueyaminlwin@theasolutions.co', message: 'Guided lab technician through ZPL media calibration and saved preset profile in LIMS settings.', isInternalNote: false, hoursAgo: 112 },
        { authorType: 'CLIENT', authorName: 'Dr. Zaw Min Htut', authorEmail: 'zawminhtut@meditrust-yangon.mm', message: 'Confirmed labels are printing cleanly now. Thank you!', isInternalNote: false, hoursAgo: 108 },
      ],
    },
    {
      ticketNumber: 'TKT-2026-0005',
      accountSlug: 'shwetaung-logistics',
      projectCode: 'PRJ-2026-003',
      phaseId: 'st-fleet-p3',
      title: 'Cold-chain alert triggered during scheduled defrost cycle on Truck ST-19',
      description: 'Truck ST-19 briefly hit +9.2C for 4 minutes during automatic evaporator defrost on Yangon–Mandalay highway, sending false red alert to dispatch.',
      category: 'BUG',
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      source: 'CLIENT_PORTAL',
      requesterName: 'U Myo Thant',
      requesterEmail: 'myothant@shwetaunglogistics.mm',
      assignedCode: 'THEA-NNZW',
      hoursOld: 9,
      comments: [
        { authorType: 'CLIENT', authorName: 'U Myo Thant', authorEmail: 'myothant@shwetaunglogistics.mm', message: 'Please suppress alerts when rise is under 8 minutes and immediately recovers below +4C.', isInternalNote: false, hoursAgo: 8 },
        { authorType: 'TEAM', authorName: 'Nyi Nyi Zaw', authorEmail: 'nyinyizaw@theasolutions.co', message: 'Implementing hysteresis window (10 min sustained > +8C or immediate > +14C) in telemetry worker.', isInternalNote: true, hoursAgo: 6 },
        { authorType: 'TEAM', authorName: 'Nyi Nyi Zaw', authorEmail: 'nyinyizaw@theasolutions.co', message: 'We are deploying the defrost-cycle filter to your dispatch console today so brief evaporator defrost spikes are tagged as info rather than critical alerts.', isInternalNote: false, hoursAgo: 5 },
      ],
    },
    {
      ticketNumber: 'TKT-2026-0006',
      accountSlug: 'shwetaung-logistics',
      projectCode: 'PRJ-2026-003',
      phaseId: 'st-fleet-p2',
      title: 'Driver app camera permission prompt loop on Redmi 13C units',
      description: 'Two new Mandalay drivers saw repeated camera dialogs when snapping waybill POD photos.',
      category: 'BUG',
      priority: 'HIGH',
      status: 'RESOLVED',
      source: 'CLIENT_PORTAL',
      requesterName: 'U Myo Thant',
      requesterEmail: 'myothant@shwetaunglogistics.mm',
      assignedCode: 'THEA-NNZW',
      hoursOld: 95,
      comments: [
        { authorType: 'TEAM', authorName: 'Nyi Nyi Zaw', authorEmail: 'nyinyizaw@theasolutions.co', message: 'Published Flutter build v1.4.2 fixing Android 14 scoped storage intent on MIUI/HyperOS devices.', isInternalNote: false, hoursAgo: 84 },
      ],
    },
    {
      ticketNumber: 'TKT-2026-0007',
      accountSlug: 'shwetaung-logistics',
      projectCode: 'PRJ-2026-004',
      phaseId: 'st-bill-p2',
      title: 'Confirm revised Myawaddy customs commercial tax line on THB invoices',
      description: 'Need final sign-off on whether detention fees should appear on a separate tax-exempt line item on THB cross-border invoices.',
      category: 'BILLING',
      priority: 'HIGH',
      status: 'WAITING_CLIENT',
      source: 'INTERNAL',
      requesterName: 'U Myo Thant',
      requesterEmail: 'myothant@shwetaunglogistics.mm',
      assignedCode: 'THEA-CSWE',
      hoursOld: 62,
      comments: [
        { authorType: 'TEAM', authorName: 'Chue Yamin Lwin', authorEmail: 'chueyaminlwin@theasolutions.co', message: 'Shared two sample THB invoice PDFs with your finance team. Once confirmed, we will unblock Phase 2 batch invoicing.', isInternalNote: false, hoursAgo: 58 },
        { authorType: 'TEAM', authorName: 'Kyaw Zin Htet', authorEmail: 'kyawzinhtet@theasolutions.co', message: 'Phase 2 milestone m3 marked AT_RISK until Shwe Taung Finance confirms tax column format.', isInternalNote: true, hoursAgo: 50 },
      ],
    },
    {
      ticketNumber: 'TKT-2026-0008',
      accountSlug: 'shwetaung-logistics',
      projectCode: 'PRJ-2026-003',
      phaseId: 'st-fleet-p3',
      title: 'Add Mandalay depot night-shift dispatcher user accounts',
      description: 'Please provision 3 read/dispatch accounts for our Mandalay cold-storage control room.',
      category: 'SUPPORT',
      priority: 'MEDIUM',
      status: 'CLOSED',
      source: 'EMAIL',
      requesterName: 'U Myo Thant',
      requesterEmail: 'myothant@shwetaunglogistics.mm',
      assignedCode: 'THEA-UWIS',
      hoursOld: 190,
      comments: [
        { authorType: 'TEAM', authorName: 'Thiri Chan Nyein', authorEmail: 'thirichannyein@theasolutions.co', message: 'All 3 Mandalay dispatcher credentials provisioned and verified.', isInternalNote: false, hoursAgo: 184 },
      ],
    },
    {
      ticketNumber: 'TKT-2026-0009',
      accountSlug: 'yoma-fresh',
      projectCode: 'PRJ-2026-005',
      phaseId: 'yf-pos-p3',
      title: 'Yankin flagship store morning pick-list missing chilled dairy SKUs',
      description: 'Par-level auto-order generated produce and dry goods correctly, but 14 chilled milk SKUs were excluded from this morning pick-list.',
      category: 'BUG',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      source: 'CLIENT_PORTAL',
      requesterName: 'Daw Ei Mon Kyaw',
      requesterEmail: 'eimonkyaw@yomafresh.mm',
      assignedCode: 'THEA-HALN',
      hoursOld: 14,
      comments: [
        { authorType: 'TEAM', authorName: 'Htet Aung Lin', authorEmail: 'htetaunglin@theasolutions.co', message: 'Found category filter excluding department code CHILL-04 from default warehouse route. Fixing filter and backfilling test run.', isInternalNote: true, hoursAgo: 10 },
        { authorType: 'TEAM', authorName: 'Htet Aung Lin', authorEmail: 'htetaunglin@theasolutions.co', message: 'Identified the missing chilled dairy department mapping in the replenishment rule. Deploying fix before tomorrow 05:00 AM pick-list run.', isInternalNote: false, hoursAgo: 9 },
      ],
    },
    {
      ticketNumber: 'TKT-2026-0010',
      accountSlug: 'yoma-fresh',
      projectCode: 'PRJ-2026-005',
      phaseId: 'yf-pos-p2',
      title: 'Export store spoilage report to Excel with Myanmar product names',
      description: 'Store managers need UTF-8 BOM Excel export so Myanmar produce descriptions open without garbled characters in Microsoft Excel.',
      category: 'FEATURE_REQUEST',
      priority: 'MEDIUM',
      status: 'OPEN',
      source: 'CLIENT_PORTAL',
      requesterName: 'Daw Ei Mon Kyaw',
      requesterEmail: 'eimonkyaw@yomafresh.mm',
      assignedCode: 'THEA-HALN',
      hoursOld: 22,
      comments: [],
    },
    {
      ticketNumber: 'TKT-2026-0011',
      accountSlug: 'yoma-fresh',
      projectCode: 'PRJ-2026-005',
      phaseId: 'yf-pos-p4',
      title: 'Schedule Nay Pyi Taw store manager training session',
      description: 'Requesting a 2-hour Zoom walkthrough for our 3 Nay Pyi Taw store managers next week.',
      category: 'TRAINING',
      priority: 'LOW',
      status: 'WAITING_CLIENT',
      source: 'CLIENT_PORTAL',
      requesterName: 'Daw Ei Mon Kyaw',
      requesterEmail: 'eimonkyaw@yomafresh.mm',
      assignedCode: 'THEA-CSWE',
      hoursOld: 38,
      comments: [
        { authorType: 'TEAM', authorName: 'Chue Yamin Lwin', authorEmail: 'chueyaminlwin@theasolutions.co', message: 'Proposed Tuesday or Thursday 14:00 MMT. Please let us know which slot fits your store shifts.', isInternalNote: false, hoursAgo: 32 },
      ],
    },
    {
      ticketNumber: 'TKT-2026-0012',
      accountSlug: 'ayeyarwady-agro',
      projectCode: 'PRJ-2026-006',
      phaseId: 'aa-ocr-p3',
      title: 'OCR misreading stamped phytosanitary lot weights on low-contrast scans',
      description: 'Two black-and-white scans from Pathein mill had faint rubber stamps over the net weight column, causing confidence to drop below 85%.',
      category: 'BUG',
      priority: 'HIGH',
      status: 'OPEN',
      source: 'CLIENT_PORTAL',
      requesterName: 'Ko Phyo Wai Yan',
      requesterEmail: 'phyowaiyan@ayeyaragro.mm',
      assignedCode: 'THEA-SMNO',
      hoursOld: 7,
      comments: [
        { authorType: 'TEAM', authorName: 'Su Myat Noe', authorEmail: 'sumyatnoe@theasolutions.co', message: 'Adding adaptive contrast pre-processing and red/blue stamp color-channel suppression for Pathein scans.', isInternalNote: true, hoursAgo: 4 },
      ],
    },
    {
      ticketNumber: 'TKT-2026-0013',
      accountSlug: 'ayeyarwady-agro',
      projectCode: 'PRJ-2026-006',
      phaseId: 'aa-ocr-p2',
      title: 'Support India DGFT black matpe HS code validation rule',
      description: 'Need automated check matching HS 0713.31.10 against buyer Letter of Credit clause 45A.',
      category: 'FEATURE_REQUEST',
      priority: 'MEDIUM',
      status: 'RESOLVED',
      source: 'CLIENT_PORTAL',
      requesterName: 'Ko Phyo Wai Yan',
      requesterEmail: 'phyowaiyan@ayeyaragro.mm',
      assignedCode: 'THEA-SMNO',
      hoursOld: 140,
      comments: [
        { authorType: 'TEAM', authorName: 'Su Myat Noe', authorEmail: 'sumyatnoe@theasolutions.co', message: 'Added HS 0713.31.10 and Indian import quota ruleset to the LC checker and verified on 3 sample shipments.', isInternalNote: false, hoursAgo: 128 },
        { authorType: 'CLIENT', authorName: 'Ko Phyo Wai Yan', authorEmail: 'phyowaiyan@ayeyaragro.mm', message: 'Works accurately on our latest Yangon–Chennai shipment. Thanks!', isInternalNote: false, hoursAgo: 122 },
      ],
    },
    {
      ticketNumber: 'TKT-2026-0014',
      accountSlug: 'ayeyarwady-agro',
      projectCode: 'PRJ-2026-006',
      phaseId: 'aa-ocr-p1',
      title: 'Enable IP allowlist for Yangon head-office export archive',
      description: 'Requested office static IP restriction on bulk 7-year compliance archive downloads.',
      category: 'INFRASTRUCTURE',
      priority: 'MEDIUM',
      status: 'CLOSED',
      source: 'INTERNAL',
      requesterName: 'Ko Phyo Wai Yan',
      requesterEmail: 'phyowaiyan@ayeyaragro.mm',
      assignedCode: 'THEA-MKKO',
      hoursOld: 220,
      comments: [
        { authorType: 'TEAM', authorName: 'Min Khant Ko', authorEmail: 'minkhantko@theasolutions.co', message: 'Configured Cloud Armor IP allowlist for Yangon office CIDR and verified audit logging.', isInternalNote: false, hoursAgo: 210 },
      ],
    },
  ];

  let maxTktSeq = 0;
  for (const spec of seedTickets) {
    const existing = await Collections.tickets().findOne({ ticketNumber: spec.ticketNumber });
    if (!existing) {
      const createdAt = hoursAgo(spec.hoursOld);
      const isClosed = spec.status === 'RESOLVED' || spec.status === 'CLOSED';
      const doc: TicketDoc = {
        _id: new ObjectId(),
        ticketNumber: spec.ticketNumber,
        accountId: accountBySlug.get(spec.accountSlug)!,
        projectId: projectByCode.get(spec.projectCode) ?? null,
        phaseId: spec.phaseId,
        title: spec.title,
        description: spec.description,
        category: spec.category,
        priority: spec.priority,
        status: spec.status,
        source: spec.source,
        requesterName: spec.requesterName,
        requesterEmail: spec.requesterEmail,
        assignedAssociateId: assocByCode.get(spec.assignedCode) ?? null,
        slaDueAt: isClosed ? null : hoursAhead(spec.priority === 'URGENT' ? 4 : 24),
        resolvedAt: isClosed ? hoursAgo(Math.max(1, spec.hoursOld - 10)) : null,
        comments: spec.comments.map((c, idx) => ({
          id: `seed-cmt-${spec.ticketNumber}-${idx + 1}`,
          authorType: c.authorType,
          authorName: c.authorName,
          authorEmail: c.authorEmail,
          message: c.message,
          isInternalNote: c.isInternalNote,
          createdAt: hoursAgo(c.hoursAgo),
        })),
        version: 1,
        createdBy: 'seed-script',
        createdAt,
        updatedAt: spec.comments.length > 0 ? hoursAgo(spec.comments[spec.comments.length - 1]!.hoursAgo) : createdAt,
      };
      await Collections.tickets().insertOne(doc);
    }
    const seqNum = Number.parseInt(spec.ticketNumber.split('-')[2] ?? '0', 10);
    if (seqNum > maxTktSeq) maxTktSeq = seqNum;
  }

  const tktYear = new Date().getUTCFullYear();
  await Collections.counters().updateOne(
    { _id: `TKT-${tktYear}` },
    { $max: { seq: maxTktSeq } },
    { upsert: true }
  );

  return { accountBySlug, projectByCode };
}
