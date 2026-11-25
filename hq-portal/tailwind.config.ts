import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'ds-display': ['"Bricolage Grotesque"', 'Inter', 'sans-serif'],
        'ds-mono': ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        hq: {
          canvas: 'var(--hq-canvas)',
          surface: 'var(--hq-surface)',
          elevated: 'var(--hq-surface-elevated)',
          subtle: 'var(--hq-surface-subtle)',
          borderSubtle: 'var(--hq-border-subtle)',
          borderDefault: 'var(--hq-border-default)',
          borderAccent: 'var(--hq-border-accent)',
          textPrimary: 'var(--hq-text-primary)',
          textSecondary: 'var(--hq-text-secondary)',
          textMuted: 'var(--hq-text-muted)',
          brand: 'var(--hq-brand-primary)',
          brandHover: 'var(--hq-brand-hover)',
          brandVibrant: 'var(--hq-brand-vibrant)',
          brandSoft: 'var(--hq-brand-soft)',
          ctaBg: 'var(--hq-cta-bg)',
          ctaText: 'var(--hq-cta-text)',
          in: 'var(--hq-semantic-in)',
          inBg: 'var(--hq-semantic-in-bg)',
          warn: 'var(--hq-semantic-warn)',
          warnBg: 'var(--hq-semantic-warn-bg)',
          out: 'var(--hq-semantic-out)',
          outBg: 'var(--hq-semantic-out-bg)',
          focus: 'var(--hq-focus-ring)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
