export type SlaPlan = 'NONE' | 'BASIC' | 'STANDARD' | 'PREMIUM' | 'CUSTOM';
export type TicketSeverity = 'P1' | 'P2' | 'P3';
export type SlaCoverage = 'WEEKDAY_09_18' | 'WEEKDAY_08_20' | 'ALWAYS_24X7';
export type SlaStatus = 'NO_SLA' | 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'MET' | 'MET_LATE';

export const SLA_PLANS = ['NONE', 'BASIC', 'STANDARD', 'PREMIUM', 'CUSTOM'] as const;
export const TICKET_SEVERITIES = ['P1', 'P2', 'P3'] as const;
export const SLA_COVERAGES = ['WEEKDAY_09_18', 'WEEKDAY_08_20', 'ALWAYS_24X7'] as const;

export interface ProjectSlaCustomDoc {
  p1Minutes: number;
  p2Minutes: number;
  p3Minutes: number;
  coverage: SlaCoverage;
}

export interface ProjectSlaDoc {
  plan: SlaPlan;
  startDate: string | null;
  endDate: string | null;
  monthlyHours: number;
  custom: ProjectSlaCustomDoc | null;
}

interface CoverageWindow {
  weekdaysOnly: boolean;
  startHour: number;
  endHour: number;
  label: string;
}

const COVERAGE_WINDOWS: Record<SlaCoverage, CoverageWindow> = {
  WEEKDAY_09_18: { weekdaysOnly: true, startHour: 9, endHour: 18, label: 'Mon-Fri 09:00-18:00' },
  WEEKDAY_08_20: { weekdaysOnly: true, startHour: 8, endHour: 20, label: 'Mon-Fri 08:00-20:00' },
  ALWAYS_24X7: { weekdaysOnly: false, startHour: 0, endHour: 24, label: '24/7' },
};

// Myanmar Standard Time. Coverage windows follow the agreed client time zone.
const CLIENT_UTC_OFFSET_MINUTES = 390;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

interface PlanDefinition {
  label: string;
  monthlyFeeMmk: number;
  monthlyHours: number;
  coverageBySeverity: Record<TicketSeverity, SlaCoverage>;
  targetMinutes: Record<TicketSeverity, number>;
  coverageLabel: string;
}

const PLAN_CATALOG: Record<'BASIC' | 'STANDARD' | 'PREMIUM', PlanDefinition> = {
  BASIC: {
    label: 'Basic',
    monthlyFeeMmk: 65_000,
    monthlyHours: 10,
    coverageBySeverity: { P1: 'WEEKDAY_09_18', P2: 'WEEKDAY_09_18', P3: 'WEEKDAY_09_18' },
    // P3 is one business day, which equals one full 09:00-18:00 coverage day.
    targetMinutes: { P1: 60, P2: 4 * 60, P3: 9 * 60 },
    coverageLabel: 'Mon-Fri 09:00-18:00',
  },
  STANDARD: {
    label: 'Standard',
    monthlyFeeMmk: 175_000,
    monthlyHours: 25,
    coverageBySeverity: { P1: 'WEEKDAY_08_20', P2: 'WEEKDAY_08_20', P3: 'WEEKDAY_08_20' },
    targetMinutes: { P1: 30, P2: 2 * 60, P3: 8 * 60 },
    coverageLabel: 'Mon-Fri 08:00-20:00',
  },
  PREMIUM: {
    label: 'Premium',
    monthlyFeeMmk: 400_000,
    monthlyHours: 50,
    coverageBySeverity: { P1: 'ALWAYS_24X7', P2: 'WEEKDAY_08_20', P3: 'WEEKDAY_08_20' },
    targetMinutes: { P1: 15, P2: 60, P3: 4 * 60 },
    coverageLabel: '24/7 for P1, P2/P3 Mon-Fri 08:00-20:00',
  },
};

export function defaultMonthlyHours(plan: SlaPlan): number {
  if (plan === 'BASIC' || plan === 'STANDARD' || plan === 'PREMIUM') {
    return PLAN_CATALOG[plan].monthlyHours;
  }
  return 0;
}

export function derivePriorityFromSeverity(severity: TicketSeverity): 'URGENT' | 'HIGH' | 'MEDIUM' {
  if (severity === 'P1') return 'URGENT';
  if (severity === 'P2') return 'HIGH';
  return 'MEDIUM';
}

export function deriveSeverityFromPriority(
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
): TicketSeverity {
  if (priority === 'URGENT') return 'P1';
  if (priority === 'HIGH') return 'P2';
  return 'P3';
}

function formatTargetLabel(plan: SlaPlan, severity: TicketSeverity, minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (plan === 'BASIC' && severity === 'P3') return '1 business day';
  const hours = minutes / 60;
  const text = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${text} covered ${hours === 1 ? 'hour' : 'hours'}`;
}

export function coverageLabel(coverage: SlaCoverage): string {
  return COVERAGE_WINDOWS[coverage].label;
}

/**
 * Adds covered (in-window) minutes to a start instant. The response clock starts when the ticket
 * arrives during coverage, or when coverage next opens.
 */
export function addCoveredMinutes(start: Date, minutes: number, coverage: SlaCoverage): Date {
  const window = COVERAGE_WINDOWS[coverage];
  const offsetMs = CLIENT_UTC_OFFSET_MINUTES * MS_PER_MINUTE;
  let cursor = start.getTime() + offsetMs;
  let remainingMs = minutes * MS_PER_MINUTE;

  for (let guard = 0; guard < 800; guard++) {
    const dayStart = Math.floor(cursor / MS_PER_DAY) * MS_PER_DAY;
    const dow = new Date(dayStart).getUTCDay();
    const isCoveredDay = !window.weekdaysOnly || (dow >= 1 && dow <= 5);

    if (isCoveredDay) {
      const openMs = dayStart + window.startHour * 3_600_000;
      const closeMs = dayStart + window.endHour * 3_600_000;
      if (cursor < openMs) cursor = openMs;
      if (cursor < closeMs) {
        const available = closeMs - cursor;
        if (remainingMs <= available) {
          return new Date(cursor + remainingMs - offsetMs);
        }
        remainingMs -= available;
      }
    }
    cursor = dayStart + MS_PER_DAY;
  }

  return new Date(start.getTime() + minutes * MS_PER_MINUTE);
}

function localDateString(at: Date): string {
  return new Date(at.getTime() + CLIENT_UTC_OFFSET_MINUTES * MS_PER_MINUTE).toISOString().slice(0, 10);
}

export function isSlaActive(sla: ProjectSlaDoc | null | undefined, at: Date): boolean {
  if (!sla || sla.plan === 'NONE') return false;
  const day = localDateString(at);
  if (sla.startDate && day < sla.startDate) return false;
  if (sla.endDate && day > sla.endDate) return false;
  return true;
}

export interface ResolvedSlaTerms {
  plan: SlaPlan;
  coverage: SlaCoverage;
  targetMinutes: number;
  targetLabel: string;
  coverageLabel: string;
}

export function resolveSlaTerms(
  sla: ProjectSlaDoc | null | undefined,
  severity: TicketSeverity,
  at: Date
): ResolvedSlaTerms | null {
  if (!sla || !isSlaActive(sla, at)) return null;

  if (sla.plan === 'CUSTOM') {
    if (!sla.custom) return null;
    const minutes =
      severity === 'P1' ? sla.custom.p1Minutes : severity === 'P2' ? sla.custom.p2Minutes : sla.custom.p3Minutes;
    return {
      plan: 'CUSTOM',
      coverage: sla.custom.coverage,
      targetMinutes: minutes,
      targetLabel: formatTargetLabel('CUSTOM', severity, minutes),
      coverageLabel: coverageLabel(sla.custom.coverage),
    };
  }

  if (sla.plan === 'NONE') return null;
  const def = PLAN_CATALOG[sla.plan];
  const coverage = def.coverageBySeverity[severity];
  const minutes = def.targetMinutes[severity];
  return {
    plan: sla.plan,
    coverage,
    targetMinutes: minutes,
    targetLabel: formatTargetLabel(sla.plan, severity, minutes),
    coverageLabel: coverageLabel(coverage),
  };
}

export interface TicketSlaStamp {
  slaPlan: SlaPlan;
  slaTargetMinutes: number | null;
  slaCoverage: SlaCoverage | null;
  slaDueAt: Date | null;
}

export function stampTicketSla(
  sla: ProjectSlaDoc | null | undefined,
  severity: TicketSeverity,
  startedAt: Date
): TicketSlaStamp {
  const terms = resolveSlaTerms(sla, severity, startedAt);
  if (!terms) {
    return { slaPlan: 'NONE', slaTargetMinutes: null, slaCoverage: null, slaDueAt: null };
  }
  return {
    slaPlan: terms.plan,
    slaTargetMinutes: terms.targetMinutes,
    slaCoverage: terms.coverage,
    slaDueAt: addCoveredMinutes(startedAt, terms.targetMinutes, terms.coverage),
  };
}

export function formatStampedTarget(
  plan: SlaPlan,
  severity: TicketSeverity,
  minutes: number | null
): string | null {
  if (minutes === null || plan === 'NONE') return null;
  return formatTargetLabel(plan, severity, minutes);
}

export function computeSlaStatus(input: {
  plan: SlaPlan;
  dueAt: Date | null;
  firstRespondedAt: Date | null;
  createdAt: Date;
  now: Date;
}): SlaStatus {
  if (input.plan === 'NONE' || !input.dueAt) return 'NO_SLA';
  if (input.firstRespondedAt) {
    return input.firstRespondedAt.getTime() <= input.dueAt.getTime() ? 'MET' : 'MET_LATE';
  }
  const nowMs = input.now.getTime();
  const dueMs = input.dueAt.getTime();
  if (nowMs > dueMs) return 'BREACHED';
  const total = Math.max(1, dueMs - input.createdAt.getTime());
  return (dueMs - nowMs) / total <= 0.25 ? 'AT_RISK' : 'ON_TRACK';
}

export interface ProjectSlaView {
  plan: SlaPlan;
  planLabel: string;
  monthlyFeeMmk: number | null;
  monthlyHours: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  coverageLabel: string;
  targets: Record<TicketSeverity, { minutes: number; label: string }> | null;
  hoursUsedThisMonth: number;
  hoursRemainingThisMonth: number;
}

export function describeProjectSla(
  sla: ProjectSlaDoc | null | undefined,
  now: Date,
  hoursUsedThisMonth: number
): ProjectSlaView {
  const plan: SlaPlan = sla?.plan ?? 'NONE';
  if (!sla || plan === 'NONE') {
    return {
      plan: 'NONE',
      planLabel: 'No SLA plan (best effort)',
      monthlyFeeMmk: null,
      monthlyHours: 0,
      startDate: null,
      endDate: null,
      isActive: false,
      coverageLabel: 'Best effort support',
      targets: null,
      hoursUsedThisMonth,
      hoursRemainingThisMonth: 0,
    };
  }

  const isActive = isSlaActive(sla, now);
  const severities: TicketSeverity[] = ['P1', 'P2', 'P3'];
  const targets = {} as Record<TicketSeverity, { minutes: number; label: string }>;
  let planLabel = plan === 'CUSTOM' ? 'Custom' : PLAN_CATALOG[plan].label;
  let monthlyFeeMmk: number | null = plan === 'CUSTOM' ? null : PLAN_CATALOG[plan].monthlyFeeMmk;
  let coverageText = plan === 'CUSTOM' && sla.custom ? coverageLabel(sla.custom.coverage) : '';

  for (const severity of severities) {
    const terms = resolveSlaTerms({ ...sla, startDate: null, endDate: null }, severity, now);
    if (terms) {
      targets[severity] = { minutes: terms.targetMinutes, label: terms.targetLabel };
      if (!coverageText && plan !== 'CUSTOM') coverageText = PLAN_CATALOG[plan as 'BASIC' | 'STANDARD' | 'PREMIUM'].coverageLabel;
    }
  }

  if (!isActive) planLabel = `${planLabel} (expired)`;
  if (plan === 'CUSTOM') monthlyFeeMmk = null;

  return {
    plan,
    planLabel,
    monthlyFeeMmk,
    monthlyHours: sla.monthlyHours,
    startDate: sla.startDate,
    endDate: sla.endDate,
    isActive,
    coverageLabel: coverageText || 'Custom coverage',
    targets: Object.keys(targets).length === 3 ? targets : null,
    hoursUsedThisMonth,
    hoursRemainingThisMonth: Math.max(0, sla.monthlyHours - hoursUsedThisMonth),
  };
}
