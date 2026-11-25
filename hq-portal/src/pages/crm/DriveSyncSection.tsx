import React, { useCallback, useEffect, useState } from 'react';
import {
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/apiClient';
import { useToast } from '@/context/ToastContext';
import { formatDateTime } from '@/lib/format';
import { Modal, StatusPill } from '@/components/ui/Primitives';
import type {
  CrmCsvImportResultDTO,
  CrmSheetTabConfig,
  CrmSyncConfigDTO,
  CrmSyncResultDTO,
  LeadSource,
} from '@/types/hq';

interface DriveSyncSectionProps {
  editable: boolean;
  onLeadsSynced: () => void;
}

export default function DriveSyncSection({
  editable,
  onLeadsSynced,
}: DriveSyncSectionProps) {
  const { pushToast } = useToast();

  const [config, setConfig] = useState<CrmSyncConfigDTO | null>(null);
  const [syncing, setSyncing] = useState(false);

  // CSV Import Modal
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvSource, setCsvSource] = useState<'WEB_CONTACT' | 'WEB_QUOTE' | 'WEB_DEMO_REQUEST' | 'MANUAL'>('WEB_QUOTE');
  const [csvLabel, setCsvLabel] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);

  // Config Modal
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configForm, setConfigForm] = useState<{
    driveFolderId: string;
    driveFolderUrl: string;
    sheets: CrmSheetTabConfig[];
  }>({
    driveFolderId: '',
    driveFolderUrl: '',
    sheets: [],
  });
  const [configSaving, setConfigSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await apiRequest<CrmSyncConfigDTO>('/api/v1/crm/sync/config');
      setConfig(res);
    } catch {
      // Optional integration config
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSyncNow = async () => {
    if (!editable) return;
    setSyncing(true);
    try {
      const res = await apiRequest<CrmSyncResultDTO>('/api/v1/crm/sync/google-sheets', {
        method: 'POST',
      });
      pushToast({
        variant: 'success',
        title: 'Google Sheets Sync Complete',
        description: `Imported ${res.imported} new leads · Skipped ${res.skippedDuplicates} duplicates across ${res.tabsScanned} tabs.`,
      });
      await loadConfig();
      onLeadsSynced();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Google Sheets sync failed',
        description: err instanceof ApiError ? err.message : 'Check sheet sharing permissions.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!csvLabel) {
      setCsvLabel(file.name);
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!csvText.trim()) {
      pushToast({ variant: 'error', title: 'Upload a CSV file or paste CSV rows first' });
      return;
    }

    setCsvImporting(true);
    try {
      const res = await apiRequest<CrmCsvImportResultDTO>('/api/v1/crm/import/csv', {
        method: 'POST',
        body: {
          csvText: csvText.trim(),
          source: csvSource,
          label: csvLabel.trim() || undefined,
        },
      });
      pushToast({
        variant: 'success',
        title: 'CSV Leads Imported',
        description: `Imported ${res.imported} leads · Skipped ${res.skippedDuplicates} duplicates (${res.rowsRead} rows read).`,
      });
      setCsvText('');
      setCsvLabel('');
      setCsvModalOpen(false);
      onLeadsSynced();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'CSV import failed',
        description: err instanceof ApiError ? err.message : 'Check CSV column formatting.',
      });
    } finally {
      setCsvImporting(false);
    }
  };

  const openConfigModal = () => {
    setConfigForm({
      driveFolderId: config?.driveFolderId || '1hpCrwbDwsZA0auPSB0QFmd1Q8evzBdWL',
      driveFolderUrl:
        config?.driveFolderUrl ||
        'https://drive.google.com/drive/folders/1hpCrwbDwsZA0auPSB0QFmd1Q8evzBdWL?usp=sharing',
      sheets: (config?.sheets || []).map((s) => ({ ...s })),
    });
    setConfigModalOpen(true);
  };

  const handleSaveConfig = async (event: React.FormEvent) => {
    event.preventDefault();
    setConfigSaving(true);
    try {
      const updated = await apiRequest<CrmSyncConfigDTO>('/api/v1/crm/sync/config', {
        method: 'PUT',
        body: configForm,
      });
      setConfig(updated);
      setConfigModalOpen(false);
      pushToast({ variant: 'success', title: 'Google Drive & Sheets sync settings saved' });
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Config save failed',
        description: err instanceof ApiError ? err.message : 'Verify Google Drive folder and Sheet IDs.',
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const enabledTabsCount = (config?.sheets || []).filter((s) => s.enabled).length;
  const primarySpreadsheetId = config?.sheets?.[0]?.spreadsheetId;
  const primarySheetUrl = primarySpreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${primarySpreadsheetId}/edit`
    : null;

  return (
    <>
      <div className="hq-card border-hq-brand/30 p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-hq-brandSoft shrink-0" />
              <h2 className="font-ds-display text-sm font-semibold text-hq-textPrimary">
                Google Drive &amp; Sales Sheets Integration
              </h2>
              <StatusPill tone={enabledTabsCount > 0 ? 'in' : 'neutral'}>
                {enabledTabsCount} Active Tabs
              </StatusPill>
            </div>
            <p className="text-xs text-hq-textSecondary">
              Connected to <span className="font-ds-mono text-hq-textPrimary">Thea / Sales</span>{' '}
              Google Drive &amp; <span className="font-ds-mono text-hq-brandSoft">01_Leads_Landing_Page</span>{' '}
              ({(config?.sheets || []).map((s) => s.label.split(' (')[0]).join(' · ') || 'Emails to Contact · Requests for Demo · Quote Requests'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editable && (
              <>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void handleSyncNow()}
                  className="hq-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing Sheets...' : 'Sync Google Sheets Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCsvModalOpen(true)}
                  className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-3.5 text-xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Import CSV / Excel</span>
                </button>
                <button
                  type="button"
                  onClick={openConfigModal}
                  className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Configure</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Bar & Quick Links */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hq-borderSubtle pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 font-ds-mono text-[11px] text-hq-textMuted tabular-nums">
            <span>
              Last Synced:{' '}
              <strong className="text-hq-textPrimary">
                {config?.lastSyncedAt ? formatDateTime(config.lastSyncedAt) : 'Not yet synced'}
              </strong>
            </span>
            {config?.lastSyncSummary && (
              <span>
                Last Result: +{config.lastSyncSummary.imported} imported,{' '}
                {config.lastSyncSummary.skippedDuplicates} skipped (
                {config.lastSyncSummary.tabsScanned} tabs)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {config?.driveFolderUrl && (
              <a
                href={config.driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-hq-borderDefault px-2.5 py-1 text-[11px] font-medium text-hq-textSecondary hover:bg-hq-elevated hover:text-hq-textPrimary"
              >
                <FolderOpen className="h-3 w-3" />
                <span>Sales &amp; Legals Drive</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {primarySheetUrl && (
              <a
                href={primarySheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-hq-borderDefault px-2.5 py-1 text-[11px] font-medium text-hq-textSecondary hover:bg-hq-elevated hover:text-hq-textPrimary"
              >
                <FileSpreadsheet className="h-3 w-3" />
                <span>01_Leads_Landing_Page</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Import CSV / Excel Export Modal */}
      <Modal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        title="Import CSV / Excel Export into CRM Leads"
        subtitle="Upload an exported .csv file or paste CSV rows with header line (deduplicated automatically)"
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCsvModalOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="crm-csv-import-form"
              disabled={csvImporting}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {csvImporting ? 'Importing...' : 'Import Leads'}
            </button>
          </>
        }
      >
        <form id="crm-csv-import-form" onSubmit={handleCsvImport} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Lead Source Classification *
              </label>
              <select
                value={csvSource}
                onChange={(e) =>
                  setCsvSource(
                    e.target.value as 'WEB_CONTACT' | 'WEB_QUOTE' | 'WEB_DEMO_REQUEST' | 'MANUAL'
                  )
                }
                className="hq-input h-10 w-full px-3 font-ds-mono text-xs"
              >
                <option value="WEB_CONTACT">WEB_CONTACT (Emails to Contact)</option>
                <option value="WEB_DEMO_REQUEST">WEB_DEMO_REQUEST (Requests for Demo)</option>
                <option value="WEB_QUOTE">WEB_QUOTE (Quote Requests)</option>
                <option value="MANUAL">MANUAL (Sales Sheet / Event List)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Import Batch Label (Optional)
              </label>
              <input
                type="text"
                value={csvLabel}
                onChange={(e) => setCsvLabel(e.target.value)}
                placeholder="Q4 Quote Sheet Export"
                className="hq-input h-10 w-full px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
              Upload CSV File
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hq-input w-full px-3 py-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-hq-brand file:px-3 file:py-1 file:text-xs file:font-medium file:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
              CSV Content (RFC-4180 format with headers) *
            </label>
            <textarea
              rows={9}
              required
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'Name,Email,Phone,Company,Service,Notes\nMin Thant,min@acme.co,+959123456,Acme Group,Custom ERP,Requested Q1 scoping'}
              className="hq-input w-full p-3 font-ds-mono text-xs leading-relaxed"
            />
          </div>
        </form>
      </Modal>

      {/* Configure Google Sheets & Drive Links Modal */}
      <Modal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        title="Configure Google Drive & Sales Sheets"
        subtitle="Manage linked Drive folder and spreadsheet tabs synchronized into Website Leads Inbox"
        maxWidthClass="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfigModalOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="crm-sync-config-form"
              disabled={configSaving}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {configSaving ? 'Saving...' : 'Save Sync Configuration'}
            </button>
          </>
        }
      >
        <form id="crm-sync-config-form" onSubmit={handleSaveConfig} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Google Drive Folder ID *
              </label>
              <input
                type="text"
                required
                value={configForm.driveFolderId}
                onChange={(e) => setConfigForm({ ...configForm, driveFolderId: e.target.value })}
                className="hq-input h-10 w-full px-3 font-ds-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Google Drive Folder URL (Sales &amp; Legals) *
              </label>
              <input
                type="url"
                required
                value={configForm.driveFolderUrl}
                onChange={(e) => setConfigForm({ ...configForm, driveFolderUrl: e.target.value })}
                className="hq-input h-10 w-full px-3 text-xs"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary">
                Synchronized Spreadsheet Tabs ({configForm.sheets.length})
              </h3>
              <button
                type="button"
                onClick={() =>
                  setConfigForm((prev) => ({
                    ...prev,
                    sheets: [
                      ...prev.sheets,
                      {
                        id: `sheet-tab-${prev.sheets.length + 1}`,
                        label: 'New Sales Tab',
                        spreadsheetId:
                          prev.sheets[0]?.spreadsheetId ||
                          '1sD2VUVTKTC0SucePM1V_249Eoj4n0M-jvDR2ZUmPy7E',
                        gid: '0',
                        source: 'WEB_CONTACT',
                        enabled: true,
                      },
                    ],
                  }))
                }
                className="hq-btn-secondary inline-flex h-8 items-center gap-1 px-3 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Sheet Tab
              </button>
            </div>

            {configForm.sheets.map((tab, idx) => (
              <div
                key={`${tab.id}-${idx}`}
                className="rounded-xl border border-hq-borderSubtle bg-hq-subtle/70 p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-hq-textPrimary">
                    <input
                      type="checkbox"
                      checked={tab.enabled}
                      onChange={(e) => {
                        const next = [...configForm.sheets];
                        next[idx] = { ...tab, enabled: e.target.checked };
                        setConfigForm({ ...configForm, sheets: next });
                      }}
                      className="h-4 w-4 accent-[#5F1F2F]"
                    />
                    Enabled for Sync
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setConfigForm({
                        ...configForm,
                        sheets: configForm.sheets.filter((_, i) => i !== idx),
                      })
                    }
                    className="rounded border border-hq-out/40 p-1 text-hq-out hover:bg-hq-outBg"
                    aria-label="Remove tab"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-hq-textMuted">Tab Label *</label>
                    <input
                      type="text"
                      required
                      value={tab.label}
                      onChange={(e) => {
                        const next = [...configForm.sheets];
                        next[idx] = { ...tab, label: e.target.value };
                        setConfigForm({ ...configForm, sheets: next });
                      }}
                      className="hq-input h-9 w-full px-2.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-hq-textMuted">Lead Source *</label>
                    <select
                      value={tab.source}
                      onChange={(e) => {
                        const next = [...configForm.sheets];
                        next[idx] = { ...tab, source: e.target.value as LeadSource };
                        setConfigForm({ ...configForm, sheets: next });
                      }}
                      className="hq-input h-9 w-full px-2.5 font-ds-mono text-xs"
                    >
                      <option value="WEB_CONTACT">WEB_CONTACT</option>
                      <option value="WEB_DEMO_REQUEST">WEB_DEMO_REQUEST</option>
                      <option value="WEB_QUOTE">WEB_QUOTE</option>
                      <option value="MANUAL">MANUAL</option>
                      <option value="REFERRAL">REFERRAL</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-hq-textMuted">
                      Google Spreadsheet ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={tab.spreadsheetId}
                      onChange={(e) => {
                        const next = [...configForm.sheets];
                        next[idx] = { ...tab, spreadsheetId: e.target.value };
                        setConfigForm({ ...configForm, sheets: next });
                      }}
                      className="hq-input h-9 w-full px-2.5 font-ds-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-hq-textMuted">
                      Tab GID (Numeric) *
                    </label>
                    <input
                      type="text"
                      required
                      value={tab.gid}
                      onChange={(e) => {
                        const next = [...configForm.sheets];
                        next[idx] = { ...tab, gid: e.target.value };
                        setConfigForm({ ...configForm, sheets: next });
                      }}
                      className="hq-input h-9 w-full px-2.5 font-ds-mono text-xs tabular-nums"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>
    </>
  );
}
