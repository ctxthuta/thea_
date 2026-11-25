import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { CmsSectionKey } from '@/types/hq';

interface SectionFormProps {
  section: CmsSectionKey;
  data: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}

function asString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}

function asBool(val: unknown): boolean {
  return Boolean(val);
}

function asStringArray(val: unknown): string[] {
  return Array.isArray(val) ? val.map((item) => String(item)) : [];
}

function asRecordArray(val: unknown): Array<Record<string, unknown>> {
  return Array.isArray(val)
    ? val.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    : [];
}

function asRecord(val: unknown): Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-hq-textSecondary">{label}</label>
      {multiline ? (
        <textarea
          rows={3}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="hq-input w-full px-3 py-2 text-sm resize-y"
        />
      ) : (
        <input
          type="text"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="hq-input h-10 w-full px-3 text-sm"
        />
      )}
    </div>
  );
}

function StringListEditor({
  label,
  items,
  onChange,
  addLabel,
  placeholder,
  disabled = false,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-hq-textSecondary">{label}</span>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange([...items, ''])}
            className="inline-flex items-center gap-1 rounded-md border border-hq-borderDefault px-2.5 py-1 text-xs text-hq-textPrimary hover:bg-hq-elevated"
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-hq-textMuted italic">No items configured.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <input
                type="text"
                disabled={disabled}
                value={item}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = e.target.value;
                  onChange(next);
                }}
                placeholder={placeholder}
                className="hq-input h-9 flex-1 px-3 text-xs"
              />
              {!disabled && (
                <>
                  <button
                    type="button"
                    onClick={() => onChange(moveItem(items, idx, idx - 1))}
                    disabled={idx === 0}
                    aria-label="Move up"
                    className="rounded-md border border-hq-borderDefault p-1.5 text-hq-textSecondary hover:bg-hq-elevated disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(moveItem(items, idx, idx + 1))}
                    disabled={idx === items.length - 1}
                    aria-label="Move down"
                    className="rounded-md border border-hq-borderDefault p-1.5 text-hq-textSecondary hover:bg-hq-elevated disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(items.filter((_, i) => i !== idx))}
                    aria-label="Remove item"
                    className="rounded-md border border-hq-out/40 p-1.5 text-hq-out hover:bg-hq-outBg"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemToolbar({
  title,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  disabled,
}: {
  title: string;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-hq-borderSubtle pb-2.5 mb-3">
      <span className="font-ds-mono text-xs font-semibold text-hq-brandSoft">{title}</span>
      {!disabled && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Move item up"
            className="rounded border border-hq-borderDefault p-1 text-hq-textSecondary hover:bg-hq-elevated disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Move item down"
            className="rounded border border-hq-borderDefault p-1 text-hq-textSecondary hover:bg-hq-elevated disabled:opacity-30"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Delete item"
            className="rounded border border-hq-out/40 p-1 text-hq-out hover:bg-hq-outBg"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function CmsSectionForm({
  section,
  data,
  onChange,
  disabled = false,
}: SectionFormProps) {
  const updateField = (key: string, value: unknown) => {
    onChange({ ...data, [key]: value });
  };

  if (section === 'hero') {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Eyebrow Label"
            value={asString(data.eyebrow)}
            onChange={(v) => updateField('eyebrow', v)}
            disabled={disabled}
          />
          <TextField
            label="Primary CTA Label"
            value={asString(data.primaryCta)}
            onChange={(v) => updateField('primaryCta', v)}
            disabled={disabled}
          />
        </div>
        <TextField
          label="Hero Headline"
          value={asString(data.headline)}
          onChange={(v) => updateField('headline', v)}
          disabled={disabled}
        />
        <TextField
          label="Hero Subheadline"
          value={asString(data.subheadline)}
          onChange={(v) => updateField('subheadline', v)}
          multiline
          disabled={disabled}
        />
        <TextField
          label="Video Poster URL"
          value={asString(data.videoPosterUrl)}
          onChange={(v) => updateField('videoPosterUrl', v)}
          placeholder="/assets/images/LandingBG-Placeholder.webp"
          disabled={disabled}
        />
        <StringListEditor
          label="Trust Bullets"
          items={asStringArray(data.trustBullets)}
          onChange={(next) => updateField('trustBullets', next)}
          addLabel="Add Bullet"
          placeholder="2-Week Agile Delivery Cycles"
          disabled={disabled}
        />
      </div>
    );
  }

  if (section === 'services') {
    const items = asRecordArray(data.items);
    const updateItem = (idx: number, patch: Record<string, unknown>) => {
      const next = [...items];
      next[idx] = { ...next[idx], ...patch };
      updateField('items', next);
    };

    return (
      <div className="space-y-5">
        <TextField
          label="Eyebrow"
          value={asString(data.eyebrow)}
          onChange={(v) => updateField('eyebrow', v)}
          disabled={disabled}
        />
        <TextField
          label="Headline"
          value={asString(data.headline)}
          onChange={(v) => updateField('headline', v)}
          disabled={disabled}
        />
        <TextField
          label="Intro Copy"
          value={asString(data.intro)}
          onChange={(v) => updateField('intro', v)}
          multiline
          disabled={disabled}
        />

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary">
              Service Cards ({items.length})
            </h3>
            {!disabled && (
              <button
                type="button"
                onClick={() =>
                  updateField('items', [...items, { tag: 'Engineering', title: '', description: '' }])
                }
                className="hq-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Service
              </button>
            )}
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-hq-borderSubtle bg-hq-subtle/60 p-4 space-y-3">
              <ItemToolbar
                title={`Service #${idx + 1}`}
                index={idx}
                total={items.length}
                onMoveUp={() => updateField('items', moveItem(items, idx, idx - 1))}
                onMoveDown={() => updateField('items', moveItem(items, idx, idx + 1))}
                onRemove={() => updateField('items', items.filter((_, i) => i !== idx))}
                disabled={disabled}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  label="Tag"
                  value={asString(item.tag)}
                  onChange={(v) => updateItem(idx, { tag: v })}
                  disabled={disabled}
                />
                <TextField
                  label="Title"
                  value={asString(item.title)}
                  onChange={(v) => updateItem(idx, { title: v })}
                  disabled={disabled}
                />
              </div>
              <TextField
                label="Description"
                value={asString(item.description)}
                onChange={(v) => updateItem(idx, { description: v })}
                multiline
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'delivery_pipeline') {
    const phases = asRecordArray(data.phases);
    const updatePhase = (idx: number, patch: Record<string, unknown>) => {
      const next = [...phases];
      next[idx] = { ...next[idx], ...patch };
      updateField('phases', next);
    };

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Eyebrow"
            value={asString(data.eyebrow)}
            onChange={(v) => updateField('eyebrow', v)}
            disabled={disabled}
          />
          <TextField
            label="Headline"
            value={asString(data.headline)}
            onChange={(v) => updateField('headline', v)}
            disabled={disabled}
          />
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary">
              Delivery Phases ({phases.length})
            </h3>
            {!disabled && (
              <button
                type="button"
                onClick={() =>
                  updateField('phases', [
                    ...phases,
                    {
                      step: String(phases.length + 1).padStart(2, '0'),
                      tag: 'Phase',
                      title: '',
                      timeframe: '',
                      summary: '',
                      businessOutcome: '',
                      deliverables: [],
                      touchpoint: '',
                      iconKey: 'compass',
                    },
                  ])
                }
                className="hq-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Phase
              </button>
            )}
          </div>

          {phases.map((phase, idx) => (
            <div key={idx} className="rounded-xl border border-hq-borderSubtle bg-hq-subtle/60 p-4 space-y-3">
              <ItemToolbar
                title={`Phase ${asString(phase.step) || String(idx + 1).padStart(2, '0')} · ${asString(phase.tag) || 'Untitled'}`}
                index={idx}
                total={phases.length}
                onMoveUp={() => updateField('phases', moveItem(phases, idx, idx - 1))}
                onMoveDown={() => updateField('phases', moveItem(phases, idx, idx + 1))}
                onRemove={() => updateField('phases', phases.filter((_, i) => i !== idx))}
                disabled={disabled}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <TextField
                  label="Step"
                  value={asString(phase.step)}
                  onChange={(v) => updatePhase(idx, { step: v })}
                  disabled={disabled}
                />
                <TextField
                  label="Tag"
                  value={asString(phase.tag)}
                  onChange={(v) => updatePhase(idx, { tag: v })}
                  disabled={disabled}
                />
                <TextField
                  label="Timeframe"
                  value={asString(phase.timeframe)}
                  onChange={(v) => updatePhase(idx, { timeframe: v })}
                  disabled={disabled}
                />
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-hq-textSecondary">
                    Icon Key
                  </label>
                  <select
                    disabled={disabled}
                    value={asString(phase.iconKey) || 'compass'}
                    onChange={(e) => updatePhase(idx, { iconKey: e.target.value })}
                    className="hq-input h-10 w-full px-3 text-sm"
                  >
                    <option value="compass">compass</option>
                    <option value="layers">layers</option>
                    <option value="terminal">terminal</option>
                    <option value="shield">shield</option>
                    <option value="rocket">rocket</option>
                    <option value="activity">activity</option>
                  </select>
                </div>
              </div>
              <TextField
                label="Title"
                value={asString(phase.title)}
                onChange={(v) => updatePhase(idx, { title: v })}
                disabled={disabled}
              />
              <TextField
                label="Summary"
                value={asString(phase.summary)}
                onChange={(v) => updatePhase(idx, { summary: v })}
                multiline
                disabled={disabled}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  label="Business Outcome"
                  value={asString(phase.businessOutcome)}
                  onChange={(v) => updatePhase(idx, { businessOutcome: v })}
                  disabled={disabled}
                />
                <TextField
                  label="Client Touchpoint"
                  value={asString(phase.touchpoint)}
                  onChange={(v) => updatePhase(idx, { touchpoint: v })}
                  disabled={disabled}
                />
              </div>
              <StringListEditor
                label="Deliverables"
                items={asStringArray(phase.deliverables)}
                onChange={(next) => updatePhase(idx, { deliverables: next })}
                addLabel="Add Deliverable"
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'products') {
    const items = asRecordArray(data.items);
    const updateItem = (idx: number, patch: Record<string, unknown>) => {
      const next = [...items];
      next[idx] = { ...next[idx], ...patch };
      updateField('items', next);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary">
              Product Catalog Items ({items.length})
            </h3>
            <p className="text-xs text-hq-textSecondary">
              Powers ProductsSection and /ai/service.json catalog on theasolutions.co
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() =>
                updateField('items', [
                  ...items,
                  {
                    id: `thea-product-${items.length + 1}`,
                    name: '',
                    category: 'corporate-agents',
                    subCategory: '',
                    description: '',
                    features: [],
                    targetAudience: [],
                    jurisdictions: [],
                    demoAvailable: true,
                  },
                ])
              }
              className="hq-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Product
            </button>
          )}
        </div>

        {items.map((item, idx) => (
          <div key={idx} className="rounded-xl border border-hq-borderSubtle bg-hq-subtle/60 p-4 space-y-3">
            <ItemToolbar
              title={`${asString(item.id) || `product-${idx + 1}`} — ${asString(item.name) || 'Untitled'}`}
              index={idx}
              total={items.length}
              onMoveUp={() => updateField('items', moveItem(items, idx, idx - 1))}
              onMoveDown={() => updateField('items', moveItem(items, idx, idx + 1))}
              onRemove={() => updateField('items', items.filter((_, i) => i !== idx))}
              disabled={disabled}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField
                label="Product ID"
                value={asString(item.id)}
                onChange={(v) => updateItem(idx, { id: v })}
                disabled={disabled}
              />
              <TextField
                label="Name"
                value={asString(item.name)}
                onChange={(v) => updateItem(idx, { name: v })}
                disabled={disabled}
              />
              <div>
                <label className="mb-1.5 block text-xs font-medium text-hq-textSecondary">
                  Category
                </label>
                <select
                  disabled={disabled}
                  value={asString(item.category) || 'corporate-agents'}
                  onChange={(e) => updateItem(idx, { category: e.target.value })}
                  className="hq-input h-10 w-full px-3 text-sm"
                >
                  <option value="corporate-agents">corporate-agents</option>
                  <option value="corporate-intelligence">corporate-intelligence</option>
                  <option value="legal-compliance-intelligence">legal-compliance-intelligence</option>
                  <option value="actions">actions</option>
                </select>
              </div>
            </div>
            <TextField
              label="Description"
              value={asString(item.description)}
              onChange={(v) => updateItem(idx, { description: v })}
              multiline
              disabled={disabled}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <StringListEditor
                label="Features"
                items={asStringArray(item.features)}
                onChange={(next) => updateItem(idx, { features: next })}
                addLabel="Add Feature"
                disabled={disabled}
              />
              <StringListEditor
                label="Target Audience"
                items={asStringArray(item.targetAudience)}
                onChange={(next) => updateItem(idx, { targetAudience: next })}
                addLabel="Add Audience"
                disabled={disabled}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-hq-textPrimary">
              <input
                type="checkbox"
                disabled={disabled}
                checked={asBool(item.demoAvailable)}
                onChange={(e) => updateItem(idx, { demoAvailable: e.target.checked })}
                className="h-4 w-4 accent-[#5F1F2F]"
              />
              Demo Scheduling Available
            </label>
          </div>
        ))}
      </div>
    );
  }

  if (section === 'pricing') {
    const models = asRecordArray(data.engagementModels);
    const updateModel = (idx: number, patch: Record<string, unknown>) => {
      const next = [...models];
      next[idx] = { ...next[idx], ...patch };
      updateField('engagementModels', next);
    };

    return (
      <div className="space-y-5">
        <TextField
          label="Eyebrow"
          value={asString(data.eyebrow)}
          onChange={(v) => updateField('eyebrow', v)}
          disabled={disabled}
        />
        <TextField
          label="Headline"
          value={asString(data.headline)}
          onChange={(v) => updateField('headline', v)}
          disabled={disabled}
        />
        <TextField
          label="Intro"
          value={asString(data.intro)}
          onChange={(v) => updateField('intro', v)}
          multiline
          disabled={disabled}
        />

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary">
              Engagement Models ({models.length})
            </h3>
            {!disabled && (
              <button
                type="button"
                onClick={() =>
                  updateField('engagementModels', [
                    ...models,
                    {
                      name: '',
                      eyebrow: '',
                      tagline: '',
                      timeline: '',
                      features: [],
                      actionText: 'Request Proposal',
                      popular: false,
                    },
                  ])
                }
                className="hq-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Engagement Model
              </button>
            )}
          </div>

          {models.map((model, idx) => (
            <div key={idx} className="rounded-xl border border-hq-borderSubtle bg-hq-subtle/60 p-4 space-y-3">
              <ItemToolbar
                title={`Model #${idx + 1} · ${asString(model.name) || 'Untitled'}`}
                index={idx}
                total={models.length}
                onMoveUp={() => updateField('engagementModels', moveItem(models, idx, idx - 1))}
                onMoveDown={() => updateField('engagementModels', moveItem(models, idx, idx + 1))}
                onRemove={() =>
                  updateField(
                    'engagementModels',
                    models.filter((_, i) => i !== idx)
                  )
                }
                disabled={disabled}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <TextField
                  label="Model Name"
                  value={asString(model.name)}
                  onChange={(v) => updateModel(idx, { name: v })}
                  disabled={disabled}
                />
                <TextField
                  label="Eyebrow"
                  value={asString(model.eyebrow)}
                  onChange={(v) => updateModel(idx, { eyebrow: v })}
                  disabled={disabled}
                />
                <TextField
                  label="Timeline"
                  value={asString(model.timeline)}
                  onChange={(v) => updateModel(idx, { timeline: v })}
                  disabled={disabled}
                />
              </div>
              <TextField
                label="Tagline"
                value={asString(model.tagline)}
                onChange={(v) => updateModel(idx, { tagline: v })}
                multiline
                disabled={disabled}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-end">
                <TextField
                  label="CTA Button Text"
                  value={asString(model.actionText)}
                  onChange={(v) => updateModel(idx, { actionText: v })}
                  disabled={disabled}
                />
                <label className="inline-flex h-10 items-center gap-2 text-xs text-hq-textPrimary">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={asBool(model.popular)}
                    onChange={(e) => updateModel(idx, { popular: e.target.checked })}
                    className="h-4 w-4 accent-[#5F1F2F]"
                  />
                  Highlight as Most Popular
                </label>
              </div>
              <StringListEditor
                label="Deliverables Included"
                items={asStringArray(model.features)}
                onChange={(next) => updateModel(idx, { features: next })}
                addLabel="Add Deliverable"
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'careers') {
    const openings = asRecordArray(data.openings);
    const updateOpening = (idx: number, patch: Record<string, unknown>) => {
      const next = [...openings];
      next[idx] = { ...next[idx], ...patch };
      updateField('openings', next);
    };

    return (
      <div className="space-y-5">
        <TextField
          label="Headline"
          value={asString(data.headline)}
          onChange={(v) => updateField('headline', v)}
          disabled={disabled}
        />
        <TextField
          label="Intro"
          value={asString(data.intro)}
          onChange={(v) => updateField('intro', v)}
          multiline
          disabled={disabled}
        />

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary">
              Role Openings ({openings.length})
            </h3>
            {!disabled && (
              <button
                type="button"
                onClick={() =>
                  updateField('openings', [
                    ...openings,
                    {
                      title: '',
                      level: 'Mid level',
                      team: 'Engineering',
                      location: 'Remote / APAC',
                      type: 'Contract / Full-time',
                      description: '',
                      skills: [],
                      focus: [],
                      isOpen: true,
                    },
                  ])
                }
                className="hq-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Opening
              </button>
            )}
          </div>

          {openings.map((job, idx) => (
            <div key={idx} className="rounded-xl border border-hq-borderSubtle bg-hq-subtle/60 p-4 space-y-3">
              <ItemToolbar
                title={`Role #${idx + 1} · ${asString(job.title) || 'Untitled Role'}`}
                index={idx}
                total={openings.length}
                onMoveUp={() => updateField('openings', moveItem(openings, idx, idx - 1))}
                onMoveDown={() => updateField('openings', moveItem(openings, idx, idx + 1))}
                onRemove={() => updateField('openings', openings.filter((_, i) => i !== idx))}
                disabled={disabled}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  label="Role Title"
                  value={asString(job.title)}
                  onChange={(v) => updateOpening(idx, { title: v })}
                  disabled={disabled}
                />
                <TextField
                  label="Team"
                  value={asString(job.team)}
                  onChange={(v) => updateOpening(idx, { team: v })}
                  disabled={disabled}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <TextField
                  label="Level"
                  value={asString(job.level)}
                  onChange={(v) => updateOpening(idx, { level: v })}
                  disabled={disabled}
                />
                <TextField
                  label="Location"
                  value={asString(job.location)}
                  onChange={(v) => updateOpening(idx, { location: v })}
                  disabled={disabled}
                />
                <TextField
                  label="Engagement Type"
                  value={asString(job.type)}
                  onChange={(v) => updateOpening(idx, { type: v })}
                  disabled={disabled}
                />
              </div>
              <TextField
                label="Description"
                value={asString(job.description)}
                onChange={(v) => updateOpening(idx, { description: v })}
                multiline
                disabled={disabled}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <StringListEditor
                  label="Skills"
                  items={asStringArray(job.skills)}
                  onChange={(next) => updateOpening(idx, { skills: next })}
                  addLabel="Add Skill"
                  disabled={disabled}
                />
                <StringListEditor
                  label="Core Focus Areas"
                  items={asStringArray(job.focus)}
                  onChange={(next) => updateOpening(idx, { focus: next })}
                  addLabel="Add Focus"
                  disabled={disabled}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-hq-textPrimary">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={job.isOpen !== false}
                  onChange={(e) => updateOpening(idx, { isOpen: e.target.checked })}
                  className="h-4 w-4 accent-[#5F1F2F]"
                />
                Published &amp; Accepting Applications
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'faqs') {
    const items = asRecordArray(data.items);
    const updateItem = (idx: number, patch: Record<string, unknown>) => {
      const next = [...items];
      next[idx] = { ...next[idx], ...patch };
      updateField('items', next);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary">
            FAQ Entries ({items.length})
          </h3>
          {!disabled && (
            <button
              type="button"
              onClick={() =>
                updateField('items', [
                  ...items,
                  { question: '', answer: '', category: 'General', sortOrder: items.length + 1 },
                ])
              }
              className="hq-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add FAQ
            </button>
          )}
        </div>

        {items.map((faq, idx) => (
          <div key={idx} className="rounded-xl border border-hq-borderSubtle bg-hq-subtle/60 p-4 space-y-3">
            <ItemToolbar
              title={`FAQ #${idx + 1}`}
              index={idx}
              total={items.length}
              onMoveUp={() => updateField('items', moveItem(items, idx, idx - 1))}
              onMoveDown={() => updateField('items', moveItem(items, idx, idx + 1))}
              onRemove={() => updateField('items', items.filter((_, i) => i !== idx))}
              disabled={disabled}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <TextField
                  label="Question"
                  value={asString(faq.question)}
                  onChange={(v) => updateItem(idx, { question: v })}
                  disabled={disabled}
                />
              </div>
              <TextField
                label="Category"
                value={asString(faq.category)}
                onChange={(v) => updateItem(idx, { category: v })}
                disabled={disabled}
              />
            </div>
            <TextField
              label="Answer"
              value={asString(faq.answer)}
              onChange={(v) => updateItem(idx, { answer: v })}
              multiline
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    );
  }

  // site_settings
  const socialLinks = asRecord(data.socialLinks);
  const banner = asRecord(data.announcementBanner);
  const seo = asRecord(data.seoDefaults);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Primary Contact Email"
          value={asString(data.contactEmail)}
          onChange={(v) => updateField('contactEmail', v)}
          disabled={disabled}
        />
        <TextField
          label="Sales Phone"
          value={asString(data.salesPhone)}
          onChange={(v) => updateField('salesPhone', v)}
          disabled={disabled}
        />
      </div>

      <StringListEditor
        label="Office & Regional Presence Locations"
        items={asStringArray(data.locations)}
        onChange={(next) => updateField('locations', next)}
        addLabel="Add Location"
        disabled={disabled}
      />

      <div className="rounded-xl border border-hq-borderSubtle bg-hq-subtle/60 p-4 space-y-3">
        <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary">Social Links</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(['linkedin', 'github', 'twitter', 'facebook'] as const).map((net) => (
            <TextField
              key={net}
              label={net.charAt(0).toUpperCase() + net.slice(1)}
              value={asString(socialLinks[net])}
              onChange={(v) => updateField('socialLinks', { ...socialLinks, [net]: v })}
              disabled={disabled}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-hq-borderSubtle bg-hq-subtle/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary">
            Announcement Banner
          </h3>
          <label className="inline-flex items-center gap-2 text-xs text-hq-textPrimary">
            <input
              type="checkbox"
              disabled={disabled}
              checked={asBool(banner.enabled)}
              onChange={(e) =>
                updateField('announcementBanner', { ...banner, enabled: e.target.checked })
              }
              className="h-4 w-4 accent-[#5F1F2F]"
            />
            Enabled
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Banner Copy"
            value={asString(banner.text)}
            onChange={(v) => updateField('announcementBanner', { ...banner, text: v })}
            disabled={disabled}
          />
          <TextField
            label="Banner Link URL"
            value={asString(banner.href)}
            onChange={(v) => updateField('announcementBanner', { ...banner, href: v })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="rounded-xl border border-hq-borderSubtle bg-hq-subtle/60 p-4 space-y-3">
        <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary">SEO Defaults</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Site Name"
            value={asString(seo.siteName)}
            onChange={(v) => updateField('seoDefaults', { ...seo, siteName: v })}
            placeholder="Thea Solutions"
            disabled={disabled}
          />
          <TextField
            label="Default Meta Title"
            value={asString(seo.defaultTitle)}
            onChange={(v) => updateField('seoDefaults', { ...seo, defaultTitle: v })}
            placeholder="Thea Solutions | Bespoke Software & Enterprise AI"
            disabled={disabled}
          />
        </div>
        <TextField
          label="Default Meta Description"
          value={asString(seo.defaultDescription)}
          onChange={(v) => updateField('seoDefaults', { ...seo, defaultDescription: v })}
          multiline
          disabled={disabled}
        />
      </div>
    </div>
  );
}
