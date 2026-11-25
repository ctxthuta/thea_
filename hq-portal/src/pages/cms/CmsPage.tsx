import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  FileText,
  Globe,
  History,
  RotateCcw,
  Save,
  UploadCloud,
} from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { canEditCms } from '@/lib/rbac';
import { formatDateTime } from '@/lib/format';
import {
  EmptyState,
  ErrorBanner,
  Modal,
  SlideOver,
  StatusPill,
} from '@/components/ui/Primitives';
import CmsSectionForm from '@/pages/cms/CmsSectionForm';
import { CMS_SECTION_DEFAULTS, CMS_SECTIONS } from '@/pages/cms/cmsDefaults';
import type {
  CmsDocumentDTO,
  CmsRevisionDTO,
  CmsSectionKey,
  CmsSectionSummaryDTO,
  CursorPage,
} from '@/types/hq';

export default function CmsPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const editable = canEditCms(user);

  const [summaries, setSummaries] = useState<Record<string, CmsSectionSummaryDTO>>({});
  const [selectedSection, setSelectedSection] = useState<CmsSectionKey>('hero');
  const [doc, setDoc] = useState<CmsDocumentDTO | null>(null);
  const [draftData, setDraftData] = useState<Record<string, unknown>>(CMS_SECTION_DEFAULTS.hero);
  const [isDirty, setIsDirty] = useState(false);

  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual');
  const [rawJson, setRawJson] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [revisions, setRevisions] = useState<CmsRevisionDTO[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [rollingBackVersion, setRollingBackVersion] = useState<number | null>(null);

  const loadSummaries = useCallback(async () => {
    try {
      const res = await apiRequest<{ items: CmsSectionSummaryDTO[] }>('/api/v1/cms/sections');
      const map: Record<string, CmsSectionSummaryDTO> = {};
      for (const item of res.items || []) {
        map[item.section] = item;
      }
      setSummaries(map);
    } catch {
      // Handled per-section
    }
  }, []);

  const loadSection = useCallback(async (section: CmsSectionKey) => {
    setLoading(true);
    setError(null);
    setJsonError(null);
    try {
      const response = await apiRequest<CmsDocumentDTO>(`/api/v1/cms/sections/${section}`);
      setDoc(response);
      const payload =
        response.draftData && Object.keys(response.draftData).length > 0
          ? response.draftData
          : CMS_SECTION_DEFAULTS[section];
      setDraftData(payload);
      setRawJson(JSON.stringify(payload, null, 2));
      setIsDirty(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDoc(null);
        const fallback = CMS_SECTION_DEFAULTS[section];
        setDraftData(fallback);
        setRawJson(JSON.stringify(fallback, null, 2));
        setIsDirty(false);
      } else {
        setError(err instanceof ApiError ? err.message : 'Unable to load CMS section.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  useEffect(() => {
    void loadSection(selectedSection);
  }, [selectedSection, loadSection]);

  const handleVisualChange = (next: Record<string, unknown>) => {
    setDraftData(next);
    setRawJson(JSON.stringify(next, null, 2));
    setJsonError(null);
    setIsDirty(true);
  };

  const handleRawJsonChange = (text: string) => {
    setRawJson(text);
    setIsDirty(true);
    try {
      const parsed = JSON.parse(text);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setJsonError('Root JSON payload must be an object.');
        return;
      }
      setDraftData(parsed as Record<string, unknown>);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON syntax');
    }
  };

  const handleSaveDraft = async (): Promise<CmsDocumentDTO | null> => {
    if (!editable || jsonError) return null;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiRequest<CmsDocumentDTO>(`/api/v1/cms/sections/${selectedSection}`, {
        method: 'PUT',
        body: {
          draftData,
          version: doc?.version ?? 1,
        },
      });
      setDoc(updated);
      setIsDirty(false);
      await loadSummaries();
      pushToast({
        variant: 'success',
        title: 'Draft saved',
        description: `${selectedSection} updated to version ${updated.version}.`,
      });
      return updated;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save draft.';
      setError(msg);
      pushToast({ variant: 'error', title: 'Save failed', description: msg });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!editable || jsonError) return;
    setPublishing(true);
    setError(null);
    try {
      let currentDoc = doc;
      if (isDirty || !currentDoc) {
        const saved = await handleSaveDraft();
        if (!saved) {
          setPublishing(false);
          return;
        }
        currentDoc = saved;
      }

      const published = await apiRequest<CmsDocumentDTO>(
        `/api/v1/cms/sections/${selectedSection}/publish`,
        {
          method: 'POST',
          idempotent: true,
          body: {
            changeSummary: changeSummary.trim() || `Published ${selectedSection} section`,
            version: currentDoc.version,
          },
        }
      );

      setDoc(published);
      setIsDirty(false);
      setPublishModalOpen(false);
      setChangeSummary('');
      await loadSummaries();
      pushToast({
        variant: 'success',
        title: 'Published to live website',
        description: `theasolutions.co now serves ${selectedSection} v${published.publishedVersion}.`,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Publish failed.';
      setError(msg);
      pushToast({ variant: 'error', title: 'Publish failed', description: msg });
    } finally {
      setPublishing(false);
    }
  };

  const openRevisions = async () => {
    setRevisionsOpen(true);
    setRevisionsLoading(true);
    try {
      const res = await apiRequest<CursorPage<CmsRevisionDTO>>(
        `/api/v1/cms/sections/${selectedSection}/revisions?limit=30`
      );
      setRevisions(res.items || []);
    } catch {
      setRevisions([]);
    } finally {
      setRevisionsLoading(false);
    }
  };

  const handleRollback = async (targetVersion: number) => {
    if (!editable || !doc) return;
    setRollingBackVersion(targetVersion);
    try {
      const restored = await apiRequest<CmsDocumentDTO>(
        `/api/v1/cms/sections/${selectedSection}/rollback`,
        {
          method: 'POST',
          body: {
            targetVersion,
            changeSummary: `Rolled back to version ${targetVersion}`,
            version: doc.version,
          },
        }
      );
      setDoc(restored);
      setDraftData(restored.draftData);
      setRawJson(JSON.stringify(restored.draftData, null, 2));
      setIsDirty(false);
      setRevisionsOpen(false);
      await loadSummaries();
      pushToast({
        variant: 'success',
        title: 'Section rolled back',
        description: `Restored ${selectedSection} to snapshot v${targetVersion}.`,
      });
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Rollback failed',
        description: err instanceof ApiError ? err.message : 'Could not restore revision.',
      });
    } finally {
      setRollingBackVersion(null);
    }
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(rawJson);
      setCopiedJson(true);
      window.setTimeout(() => setCopiedJson(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const activeMeta = CMS_SECTIONS.find((s) => s.key === selectedSection)!;

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-ds-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-hq-textPrimary">
            Dynamic Website CMS
          </h1>
          <p className="mt-1 text-sm text-hq-textSecondary">
            Edit and publish live sections directly to <span className="font-ds-mono text-hq-brandSoft">theasolutions.co</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openRevisions}
            className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-3.5 text-xs"
          >
            <History className="h-3.5 w-3.5" />
            <span>Revision History</span>
          </button>
          <a
            href="https://theasolutions.co"
            target="_blank"
            rel="noopener noreferrer"
            className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-3.5 text-xs"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Live Site</span>
          </a>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => loadSection(selectedSection)} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        {/* Left Section Selector */}
        <aside className="lg:col-span-3 lg:sticky lg:top-20">
          <div className="hq-card p-3">
            <p className="px-2.5 pb-2 font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
              Website Sections (8)
            </p>
            <nav aria-label="CMS Sections" className="flex gap-1.5 overflow-x-auto lg:flex-col">
              {CMS_SECTIONS.map((sec) => {
                const summary = summaries[sec.key];
                const isSelected = selectedSection === sec.key;
                const badgeTone = summary?.hasUnpublishedChanges
                  ? 'warn'
                  : summary?.status === 'published'
                    ? 'in'
                    : 'neutral';
                const badgeLabel = summary?.hasUnpublishedChanges
                  ? 'Unpublished'
                  : summary?.status === 'published'
                    ? `Live v${summary.publishedVersion}`
                    : 'Draft';

                return (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() => setSelectedSection(sec.key)}
                    className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-hq-elevated border border-hq-brand/50 text-hq-textPrimary'
                        : 'border border-transparent text-hq-textSecondary hover:bg-hq-elevated/60 hover:text-hq-textPrimary'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{sec.label}</p>
                      <p className="hidden lg:block font-ds-mono text-[10px] text-hq-textMuted truncate">
                        {sec.key}
                      </p>
                    </div>
                    <StatusPill tone={badgeTone}>{badgeLabel}</StatusPill>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Right Section Editor */}
        <section className="lg:col-span-9 space-y-4">
          {/* Sticky Top Action Bar inside Editor Pane */}
          {editable && (
            <div className="sticky top-16 z-10 hq-card border-hq-brand/35 bg-hq-surface/95 backdrop-blur-md px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs min-w-0">
                <span
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    jsonError
                      ? 'bg-hq-out'
                      : isDirty || doc?.hasUnpublishedChanges
                        ? 'bg-hq-warn'
                        : 'bg-hq-in'
                  }`}
                />
                <span className="text-hq-textSecondary truncate">
                  {jsonError
                    ? 'Fix JSON syntax errors before saving.'
                    : isDirty
                      ? `Unsaved changes in ${activeMeta.label}`
                      : doc?.hasUnpublishedChanges
                        ? `Draft v${doc.version} has unpublished changes`
                        : `${activeMeta.label} is synced with live website`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isDirty && (
                  <button
                    type="button"
                    onClick={() => void loadSection(selectedSection)}
                    className="hq-btn-secondary h-9 px-3.5 text-xs"
                  >
                    Discard
                  </button>
                )}
                <button
                  type="button"
                  onClick={openRevisions}
                  className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-3.5 text-xs"
                >
                  <History className="h-3.5 w-3.5" />
                  <span>Revisions</span>
                </button>
                <button
                  type="button"
                  disabled={saving || Boolean(jsonError)}
                  onClick={() => void handleSaveDraft()}
                  className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                </button>
                <button
                  type="button"
                  disabled={publishing || Boolean(jsonError)}
                  onClick={() => setPublishModalOpen(true)}
                  className="hq-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>Publish to Live Website</span>
                </button>
              </div>
            </div>
          )}

          <div className="hq-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hq-borderSubtle pb-4 mb-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-ds-display text-xl font-semibold text-hq-textPrimary">
                    {activeMeta.label}
                  </h2>
                  <StatusPill
                    tone={
                      isDirty || doc?.hasUnpublishedChanges
                        ? 'warn'
                        : doc?.status === 'published'
                          ? 'in'
                          : 'neutral'
                    }
                  >
                    {isDirty
                      ? 'Unsaved Edits'
                      : doc?.hasUnpublishedChanges
                        ? 'Unpublished Changes'
                        : doc?.status === 'published'
                          ? `Published v${doc.publishedVersion}`
                          : 'Draft'}
                  </StatusPill>
                </div>
                <p className="mt-1 text-xs text-hq-textSecondary">
                  {activeMeta.description}
                  {doc?.publishedAt && (
                    <span className="ml-2 font-ds-mono text-hq-textMuted">
                      · Last published {formatDateTime(doc.publishedAt)}
                    </span>
                  )}
                </p>
              </div>

              <div role="tablist" className="inline-flex rounded-full border border-hq-borderDefault bg-hq-subtle p-0.5">
                <button
                  type="button"
                  role="tab"
                  aria-selected={editorMode === 'visual'}
                  onClick={() => setEditorMode('visual')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    editorMode === 'visual'
                      ? 'bg-hq-brand text-white'
                      : 'text-hq-textSecondary hover:text-hq-textPrimary'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Visual Editor
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={editorMode === 'json'}
                  onClick={() => setEditorMode('json')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    editorMode === 'json'
                      ? 'bg-hq-brand text-white'
                      : 'text-hq-textSecondary hover:text-hq-textPrimary'
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  Raw JSON
                </button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-4">
                <div className="hq-skeleton h-10 w-full" />
                <div className="hq-skeleton h-24 w-full" />
                <div className="hq-skeleton h-40 w-full" />
              </div>
            ) : editorMode === 'visual' ? (
              <CmsSectionForm
                section={selectedSection}
                data={draftData}
                onChange={handleVisualChange}
                disabled={!editable}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-ds-mono text-xs text-hq-textSecondary">
                    Payload schema for <strong className="text-hq-textPrimary">{selectedSection}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="inline-flex items-center gap-1.5 rounded-md border border-hq-borderDefault px-2.5 py-1 text-xs text-hq-textSecondary hover:text-hq-textPrimary"
                  >
                    {copiedJson ? <Check className="h-3.5 w-3.5 text-hq-in" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                {jsonError && (
                  <div role="alert" className="rounded-lg border border-hq-out/40 bg-hq-outBg px-3 py-2 font-ds-mono text-xs text-hq-out">
                    JSON syntax error: {jsonError}
                  </div>
                )}
                <textarea
                  value={rawJson}
                  disabled={!editable}
                  onChange={(e) => handleRawJsonChange(e.target.value)}
                  rows={22}
                  spellCheck={false}
                  className="hq-input w-full p-4 font-ds-mono text-xs leading-relaxed"
                />
              </div>
            )}

            {/* In-Flow Bottom Action Footer (Zero Floating Overlap) */}
            {editable && !loading && (
              <div className="mt-6 pt-4 border-t border-hq-borderSubtle flex flex-wrap items-center justify-between gap-3">
                <span className="font-ds-mono text-[11px] text-hq-textMuted">
                  Section version: v{doc?.version ?? 1}
                  {doc?.publishedVersion ? ` · Live v${doc.publishedVersion}` : ''}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {isDirty && (
                    <button
                      type="button"
                      onClick={() => void loadSection(selectedSection)}
                      className="hq-btn-secondary h-9 px-3.5 text-xs"
                    >
                      Discard
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saving || Boolean(jsonError)}
                    onClick={() => void handleSaveDraft()}
                    className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={publishing || Boolean(jsonError)}
                    onClick={() => setPublishModalOpen(true)}
                    className="hq-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Publish to Live Website</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Publish Confirmation Modal */}
      <Modal
        open={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title={`Publish ${activeMeta.label}`}
        subtitle="Promotes current draft snapshot to live public API /api/v1/public/cms"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPublishModalOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={publishing}
              onClick={() => void handlePublish()}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {publishing ? 'Publishing...' : 'Confirm & Publish Live'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-hq-textSecondary">
            Publishing records an immutable revision snapshot and immediately updates{' '}
            <span className="font-ds-mono text-hq-brandSoft">theasolutions.co</span> on next revalidation.
          </p>
          <div>
            <label
              htmlFor="cms-change-summary"
              className="mb-1.5 block text-xs font-medium text-hq-textSecondary"
            >
              Change Summary (recorded in revision history)
            </label>
            <input
              id="cms-change-summary"
              type="text"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder={`Updated ${activeMeta.label.toLowerCase()} copy`}
              className="hq-input h-10 w-full px-3 text-sm"
            />
          </div>
        </div>
      </Modal>

      {/* Revision History Slide-Over */}
      <SlideOver
        open={revisionsOpen}
        onClose={() => setRevisionsOpen(false)}
        title="Revision History"
        subtitle={`Section: ${selectedSection}`}
      >
        {revisionsLoading ? (
          <div className="space-y-3">
            <div className="hq-skeleton h-16 w-full" />
            <div className="hq-skeleton h-16 w-full" />
          </div>
        ) : revisions.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="No Published Revisions"
            description="Publish this section at least once to create immutable revision snapshots."
          />
        ) : (
          <div className="space-y-3">
            {revisions.map((rev) => (
              <div
                key={rev.id}
                className="rounded-xl border border-hq-borderSubtle bg-hq-subtle/70 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusPill tone="brand">v{rev.version}</StatusPill>
                    <span className="font-ds-mono text-[11px] text-hq-textMuted">
                      {formatDateTime(rev.publishedAt)}
                    </span>
                  </div>
                  {editable && (
                    <button
                      type="button"
                      disabled={rollingBackVersion === rev.version}
                      onClick={() => void handleRollback(rev.version)}
                      className="inline-flex items-center gap-1 rounded-full border border-hq-borderDefault px-3 py-1 text-xs font-medium text-hq-textPrimary hover:bg-hq-elevated"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>
                        {rollingBackVersion === rev.version ? 'Restoring...' : 'Rollback'}
                      </span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-hq-textPrimary">
                  {rev.changeSummary || 'Published snapshot'}
                </p>
                <details className="text-xs">
                  <summary className="cursor-pointer font-ds-mono text-[11px] text-hq-brandSoft">
                    Inspect Snapshot JSON
                  </summary>
                  <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-hq-canvas p-3 font-ds-mono text-[11px] text-hq-textSecondary">
                    {JSON.stringify(rev.data, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </SlideOver>
    </div>
  );
}
