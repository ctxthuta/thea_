# AGENT.md — Thea Solutions Architecture & Engineering Handbook

> **Thea Solutions** is a premier technology and engineering firm that bridges the gap between complex technology and ambitious growing businesses. We architect and deliver bespoke software systems, enterprise-grade AI integrations, and intelligent process automations with predictable milestones and dedicated SLA support.

---

## 1. Project Overview & Identity

- **Brand Name**: Thea Solutions
- **Primary Domain**: [https://theasolutions.co](https://theasolutions.co)
- **Primary Focus**: Bespoke Software Development, Enterprise AI, Workflow Automation, Cloud Modernization
- **Engagement Philosophy**:
  - **Remote-First Elite Engineering**: Agile pod teams with deep domain discipline.
  - **2-Week Agile Delivery Cycles**: Bi-weekly working demo check-ins with zero hidden surprises.
  - **Dedicated Ongoing SLA Support**: Proactive monitoring, maintenance, and continuous system reliability.
  - **Predictable Milestones**: Fixed-scope discovery phases transitioning into transparent retainers or sprint pods.

---

## 2. Technology Stack

### Frontend & Application Framework
- **Framework**: [Next.js 16](https://nextjs.org) (App Router architecture with Turbopack)
- **Runtime**: [React 18](https://react.dev) + [TypeScript 5](https://www.typescriptlang.org)
- **Styling**: [Tailwind CSS v3](https://tailwindcss.com) + [tailwindcss-animate](https://github.com/jamiebuilds/tailwindcss-animate)
- **Design Tokens**: Custom TanStack Design System primitives (`ts-glass`, `ts-glass-card`, `ts-btn-primary`, `ts-btn-secondary`)
- **Animation**: [Framer Motion 11](https://www.framer.com/motion/) (`useScroll`, `useMotionValueEvent`, `AnimatePresence`)
- **Typography**:
  - Display: **Bricolage Grotesque** (`var(--font-ds-display)`)
  - Monospace: **IBM Plex Mono** (`var(--font-ds-mono)`)
  - Body: **Inter** (`var(--font-sans)`) & Local Primary Font
- **Icons**: Inline Custom SVGs ([`CustomIcons.tsx`](file:///home/lenovo/thea_/webpage/src/components/icons/CustomIcons.tsx)) and Lucide React

### Backend, APIs & Telemetry
- **API Routes**: Next.js Serverless Route Handlers (`/api/demo-request`, `/api/contact`, `/api/quote`)
- **Automations & Webhooks**: [n8n](https://n8n.io) webhook workflows authenticated via **JWT (HMAC-SHA256)** signatures
- **Analytics**: [Mixpanel](https://mixpanel.com) (`mixpanel-browser`) with explicit UTM attribution and privacy guardrails

---

## 3. Repository Structure

```
thea_/
├── automations/                      # n8n automation workflow JSON definitions
├── webpage/                          # Main Next.js Web Application
│   ├── public/                       # Static public assets
│   │   ├── assets/                   # Videos (LandingBG.webm), Posters (WebP), Captions
│   │   ├── employees/                # Employee avatar and credential image assets
│   │   ├── llms.txt                  # Agentic browsing directory for AI agents
│   │   └── .well-known/llms.txt      # RFC-standardized LLMs agent specification
│   ├── src/
│   │   ├── app/                      # Next.js App Router routes
│   │   │   ├── layout.tsx            # Global HTML shell, fonts, metadata & structured data
│   │   │   ├── page.tsx              # Homepage composition (Sections 1–5)
│   │   │   ├── globals.css           # Global Tailwind tokens & squircle primitives
│   │   │   ├── pricing/page.tsx      # Pricing tiers, retainers & engagement pods
│   │   │   ├── schedule-demo/        # 1-on-1 Consultation Calendar & slot picker
│   │   │   ├── careers/page.tsx      # Open engineering & product careers
│   │   │   ├── verify/[employeeId]/  # Tamper-proof employee verification
│   │   │   ├── robots.ts             # Search engine & AI crawler access rules
│   │   │   ├── sitemap.ts            # Dynamic XML sitemap generator
│   │   │   └── api/                  # API endpoints (demo-request, contact, quote)
│   │   ├── components/               # React UI & section components
│   │   │   ├── Navbar.js             # Fixed floating glassmorphic navbar
│   │   │   ├── Footer.js             # Global footer with lead intake
│   │   │   ├── landing/              # Landing page modular sections
│   │   │   │   ├── Section1.js       # Hero section with ambient video & lead intake
│   │   │   │   ├── Section2.js       # Core capabilities & service cards
│   │   │   │   ├── Section3.js       # Scroll-driven delivery pipeline & roadmap
│   │   │   │   ├── Section4.js       # Featured product showcases
│   │   │   │   └── Section5.js       # Project intake form & FAQ accordion
│   │   │   └── icons/CustomIcons.tsx # Handcrafted accessible SVG icons
│   │   └── lib/                      # Data fixtures (products, employee credentials)
│   ├── next.config.ts                # Next.js config (CSP headers, redirects, images)
│   └── tailwind.config.ts            # Brand color tokens & custom font configurations
```

---

## 4. Brand Design Tokens & Palette

| Token Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| `thea-carbon-black` | `#1A1816` | Global page background |
| `thea-carbon-black-2` | `#181816` | Glass card surfaces & elevated containers |
| `thea-wine-plum` | `#5F1F2F` | Primary accent, glows, borders, active states |
| `thea-wine-plum-light` | `#8E2E46` | Secondary accent & gradient conduits |
| `berry-vibrant` | `#e36a88` | Active stage beacons, badges, alert indicators |
| `blush-pink` | `#f3a6b7` | Monospace tags, sub-headings, subtle highlights |
| `thea-white-smoke` | `#F1F1F0` | High-contrast display typography & primary buttons |

---

## 5. Key Architecture & Features

### 5.1. Delivery Methodology & Pipeline ([`Section3.js`](file:///home/lenovo/thea_/webpage/src/components/landing/Section3.js))
- **Desktop Experience (`lg+`)**:
  - **Scroll-Driven Sticky Pinned Container**: Uses `sticky top-0 h-screen` inside a `h-[350vh]` track. As visitors scroll, `scrollYProgress` sequentially drives Phase 01 through Phase 06.
  - **Navbar Clearance**: Uses `pt-28 xl:pt-32` padding so the floating navbar never obscures the section title, eyebrow badge, or `Phase 01 of 06` counter.
  - **Executive Spotlight Card**: Displays Phase focus, timeframes (`Days 1–7`, `Week 2`, etc.), **Business Value & Guarantee callout**, **Tangible Deliverables**, and **Client Touchpoints**.
- **Mobile Experience (`< lg`)**:
  - **Dedicated 2-Column Flex Timeline**: Isolated left gutter (`w-8 sm:w-10`) holds circular milestone nodes (`01`–`06`) and the continuous vertical connecting line.
  - **Zero Card Collision**: The right gutter holds the card separated by `gap-4 sm:gap-5`, making it structurally impossible for card borders to collide or overlap the timeline nodes.

### 5.2. Consultation Booking ([`schedule-demo/page.tsx`](file:///home/lenovo/thea_/webpage/src/app/schedule-demo/page.tsx))
- **Clean 2-Column Interface**:
  - **Left**: Month calendar with day-of-week grid and 30-minute time slot picker configured for APAC / UTC+6:30 timezone.
  - **Right**: Attendee details form, live session summary card, and submission button.
- **Webhook Pipeline**: Submits to `/api/demo-request` which generates a JWT bearer token to trigger the n8n scheduling workflow without requiring hardcoded product selections.

### 5.3. Employee Verification ([`verify/[employeeId]/page.tsx`](file:///home/lenovo/thea_/webpage/src/app/verify/[employeeId]/page.tsx))
- Dynamic server-rendered verification portal displaying employee portfolio, active status, role, and cryptographically verified digital badge to protect against impersonation.

---

## 6. Engineering Standards & Quality Checklist

When authoring or modifying code in this codebase, always adhere to the following standards:

### 1. Accessibility (A11y) — 100/100 Lighthouse Standard
- **Strict Heading Progression**: Heading levels must strictly descend (`<h1>` $\rightarrow$ `<h2>` $\rightarrow$ `<h3>`). Never skip levels (e.g. `<h2>` directly to `<h4>`).
- **Consistent Link Destinations**: Links sharing identical text (e.g., *"Get a Quote"*) must target the exact same URL (e.g. `/#contact`).
- **ARIA & Contrast**: Every interactive `<button>` without visible text must have an explicit `aria-label`. All icons must use `aria-hidden="true"`.

### 2. Mobile Viewport & Layout Integrity
- **Global Viewport Bounds**: `html, body` and `<main>` must always maintain `overflow-x: hidden; max-width: 100vw; width: 100%;`.
- **No Unconstrained Child Spills**: Never place absolute elements with positive horizontal translations (`translate-x-1/3`, `w-[600px]`) inside containers without `overflow-hidden`.
- **Responsive Monospace Text**: Monospace tags with long strings must include `text-[10px] sm:text-xs max-w-full truncate` to prevent horizontal blowouts on narrow $320\text{px}-375\text{px}$ viewports.

### 3. Image & Media Optimization
- **Explicit `sizes` on Next.js `<Image>`**: Always provide responsive `sizes="(max-width: 640px) 140px, 180px"` so Next.js does not generate 640px+ images for 40px icon/logo displays.
- **Modern Formats**: Prefer WebP/AVIF over legacy uncompressed JPEGs or oversized PNGs for background video posters and banners.

### 4. Agentic Browsing & SEO Compatibility
- **Agentic Directories**: Maintain [`llms.txt`](file:///home/lenovo/thea_/webpage/public/llms.txt) and [`public/.well-known/llms.txt`](file:///home/lenovo/thea_/webpage/public/.well-known/llms.txt) in sync whenever new routes or structured JSON endpoints are added.
- **Sitemap & Robots**: Ensure every public page (including `/schedule-demo`, `/pricing`, `/careers`) is declared in [`sitemap.ts`](file:///home/lenovo/thea_/webpage/src/app/sitemap.ts) and accessible to AI user agents in [`robots.ts`](file:///home/lenovo/thea_/webpage/src/app/robots.ts).
- **Structured Data**: Keep JSON-LD schemas updated in [`StructuredData.tsx`](file:///home/lenovo/thea_/webpage/src/components/StructuredData.tsx).

---

## 7. Development & Verification Workflow

```bash
# 1. Navigate to the web application directory
cd webpage

# 2. Install dependencies
npm install

# 3. Start local development server (Turbopack)
npm run dev

# 4. Run production build & verify type safety
npm run build

# 5. Start production server for Lighthouse audits
npm run start
```
