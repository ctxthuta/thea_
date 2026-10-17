import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Mail, Briefcase, MapPin, CheckCircle2, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const jobOpenings: Array<{
  title: string;
  level: string;
  team: string;
  location: string;
  type: string;
  description: string;
  skills: string[];
  focus: string[];
}> = [
  {
    title: "Backend Engineer — Go",
    level: "Mid level",
    team: "Engineering",
    location: "Remote / APAC",
    type: "Full-time",
    description: "Build reliable APIs and services in Go while mastering production engineering, testing, observability, and cloud-native deployment.",
    skills: ["Golang", "REST APIs", "PostgreSQL", "AWS", "GCP", "GitLab"],
    focus: [
      "Develop and maintain backend services with a focus on performance and reliability",
      "Design data models and integrate with external business systems (ERP, CRM, etc.)",
      "Use Claude, Codex, and similar AI tools responsibly to accelerate delivery"
    ]
  },
  {
    title: "Backend Engineer — NestJS",
    level: "Mid level",
    team: "Engineering",
    location: "Remote / APAC",
    type: "Full-time",
    description: "Own TypeScript services and integrations for business-critical applications, from architecture through deployment and monitoring on cloud infrastructure.",
    skills: ["NestJS", "TypeScript", "PostgreSQL", "Redis", "AWS", "GCP", "GitLab"],
    focus: [
      "Design modular APIs, background jobs, and event-driven workflows",
      "Implement secure integrations with third-party platforms (finance, logistics, etc.) with idempotent patterns",
      "Review code and help engineers adopt AI-assisted development practices"
    ]
  },
  {
    title: "Frontend Engineer — Vue & React",
    level: "Entry to mid level",
    team: "Engineering",
    location: "Remote / APAC",
    type: "Full-time",
    description: "Create accessible, responsive product experiences for operational dashboards, customer portals, and data-rich applications.",
    skills: ["Vue", "React", "TypeScript", "Modern CSS", "GitLab"],
    focus: [
      "Translate product requirements and designs into polished, performant interfaces",
      "Build interactive data visualisation and workflow management screens",
      "Use AI tools for prototyping and testing while maintaining strong engineering judgment"
    ]
  },
  {
    title: "Mobile Engineer — Kotlin Multiplatform & Flutter",
    level: "Mid level",
    team: "Engineering",
    location: "Remote / APAC",
    type: "Full-time",
    description: "Ship dependable cross-platform mobile products with shared business logic, native-quality experiences, and seamless backend connectivity.",
    skills: ["Kotlin Multiplatform", "Flutter", "Android", "iOS", "GitLab"],
    focus: [
      "Build and maintain reusable mobile architecture and platform integrations",
      "Implement deep links, authentication, offline support, and robust error recovery",
      "Partner closely with backend and product teams from discovery to release"
    ]
  },
  {
    title: "AI Engineer — Agentic Systems",
    level: "Mid level",
    team: "AI & Automation",
    location: "Remote / APAC",
    type: "Full-time",
    description: "Design practical agentic systems that combine language models, tools, data, and human approval to solve real operational problems.",
    skills: ["LLM applications", "RAG", "Tool calling", "Evaluation", "AWS/GCP", "GitLab"],
    focus: [
      "Build multi-step agents with guardrails, tracing, and measurable evaluations",
      "Integrate models and tools including Claude and Codex into production workflows",
      "Protect sensitive business data through careful access and approval design"
    ]
  },
  {
    title: "Automation Engineer",
    level: "Entry to mid level",
    team: "AI & Automation",
    location: "Remote / APAC",
    type: "Full-time",
    description: "Turn repetitive business processes into resilient automated and agent-assisted workflows across internal and client systems.",
    skills: ["APIs & webhooks", "Workflow automation", "JavaScript or Python", "AI agents", "GitLab"],
    focus: [
      "Map processes and build observable, recoverable automations",
      "Connect CRM, finance, communication, and logistics systems",
      "Create human-in-the-loop controls for sensitive agentic actions"
    ]
  },
  {
    title: "Business Analyst",
    level: "Mid level",
    team: "Consulting",
    location: "Myanmar / Hybrid",
    type: "Full-time",
    description: "Bridge business needs and technical delivery by guiding clients through discovery, requirements definition, and solution validation.",
    skills: ["Requirements analysis", "Process mapping", "Data analysis", "Stakeholder management", "Documentation"],
    focus: [
      "Run discovery sessions and translate business goals into clear technical specifications",
      "Analyse existing workflows and identify opportunities for automation and improvement",
      "Coordinate testing, training, go-live, and ongoing enhancements with clients and internal teams"
    ]
  },
  {
    title: "Application Consultant",
    level: "Entry to mid level",
    team: "Consulting",
    location: "Myanmar / Hybrid",
    type: "Full-time",
    description: "Bridge business needs and technical delivery by guiding clients through implementation, training, and adoption of software and automation solutions.",
    skills: ["Requirements analysis", "Process mapping", "Client communication", "Solution design"],
    focus: [
      "Run discovery sessions and turn needs into clear delivery requirements",
      "Advise clients on software and AI automation strategies",
      "Coordinate testing, training, go-live, and ongoing improvements"
    ]
  },
  {
    title: "Sales Executive — Technology Solutions",
    level: "Mid level",
    team: "Growth",
    location: "Hybrid (Thailand / Vietnam)",
    type: "Full-time",
    description: "Help growing businesses understand and adopt custom software, AI automation, and digital transformation solutions.",
    skills: ["B2B sales", "Consultative selling", "CRM", "Communication"],
    focus: [
      "Develop qualified opportunities and manage the sales pipeline",
      "Explain technical solutions in clear business language",
      "Work with consultants and engineers to shape accurate proposals"
    ]
  },
  {
    title: "Sales Executive — Technology Solutions",
    level: "Mid level",
    team: "Growth",
    location: "Myanmar / Hybrid",
    type: "Full-time",
    description: "Drive adoption of modern HR management systems – including HRIS, payroll, attendance, recruitment, and employee engagement platforms – for businesses in Myanmar.",
    skills: ["B2B sales", "HRIS knowledge", "Consultative selling", "CRM", "Communication"],
    focus: [
      "Identify and qualify opportunities with Myanmar-based organisations needing HR digital transformation",
      "Translate HR pain points into clear solution value propositions",
      "Collaborate with consultants and implementation teams to deliver accurate proposals and smooth handovers"
    ]
  }
];

export const metadata: Metadata = {
  title: 'Careers | Thea Solutions',
  description: 'Explore career opportunities and open roles at Thea Solutions. Join our team and build thoughtful technology with us.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://theasolutions.co/careers',
    title: 'Careers at Thea Solutions | Build Thoughtful Technology With Us',
    description: `Join our team! We have ${jobOpenings.length} open positions including Backend Engineer, Frontend Engineer, AI Engineer, and more. Remote/APAC opportunities available.`,
    siteName: 'Thea Solutions',
    images: [
      {
        url: '/dark_tranStacked_logo.png',
        width: 1200,
        height: 630,
        alt: 'Thea Solutions Careers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Careers at Thea Solutions | Build Thoughtful Technology With Us',
    description: `Join our team! We have ${jobOpenings.length} open positions including Backend Engineer, Frontend Engineer, AI Engineer, and more. Remote/APAC opportunities available.`,
    images: ['/dark_tranStacked_logo.png'],
  },
};

export default function CareersPage() {
  return (
    <main className="min-h-screen bg-[#1A1816] text-[#F1F1F0] overflow-hidden">
      <Navbar />

      {/* Hero & Background Ambient Glow */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-36 sm:pt-44 pb-24">
        <div className="absolute right-0 top-32 w-[550px] h-[550px] rounded-full bg-[#5F1F2F]/15 blur-[220px] pointer-events-none -z-10" />

        <div className="relative">
          {/* Back Link */}
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-ds-mono uppercase tracking-wider bg-white/[0.04] text-gray-400 border border-white/10 hover:text-white hover:bg-white/[0.08] transition-all mb-8"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back to home</span>
          </Link>

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#5F1F2F]/40 bg-[#5F1F2F]/15 font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-4 block w-fit">
            <span className="size-1.5 rounded-full bg-[#e36a88]" />
            <span>Opportunities · Join Our Remote-First Team</span>
          </div>

          {/* Heading */}
          <h1 className="font-ds-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] leading-[1.08] text-white max-w-4xl">
            Build{' '}
            <span className="relative text-white underline decoration-[#5F1F2F] decoration-[4px] underline-offset-[8px]">
              thoughtful technology
            </span>{' '}
            with us.
          </h1>

          <p className="mt-6 max-w-2xl text-base sm:text-lg text-gray-400 font-light leading-relaxed">
            We bring together curious, self-directed engineers and consultants who care deeply about useful software, intelligent automation, client business outcomes, and enduring craft.
          </p>

          {/* Open Positions Grid Section */}
          <div className="mt-16 sm:mt-20 border-t border-white/10 pt-10">
            <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7]">
                  Active Roles
                </span>
                <h2 className="font-ds-display text-2xl sm:text-3xl font-bold text-white mt-1">
                  Current Opportunities
                </h2>
              </div>
              <span className="font-ds-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-gray-300 w-fit">
                {jobOpenings.length} Positions Available
              </span>
            </div>

            {/* Job Openings Grid in TanStack DS Card Style */}
            <div className="grid gap-6 md:grid-cols-2">
              {jobOpenings.map((job) => (
                <article 
                  key={job.title} 
                  className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#181816]/75 backdrop-blur-xl p-6 sm:p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.4)] hover:border-[#5F1F2F]/70 hover:-translate-y-1 hover:shadow-[0_16px_36px_-6px_rgba(95,31,47,0.3)] transition-all duration-300 overflow-hidden"
                >
                  {/* Top hairline accent */}
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#5F1F2F] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div>
                    {/* Role Badges */}
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="font-ds-mono text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#5F1F2F]/25 text-[#f3a6b7] border border-[#5F1F2F]/40 font-semibold">
                        {job.level}
                      </span>
                      <span className="font-ds-mono text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/[0.04] text-gray-300 border border-white/10">
                        {job.team}
                      </span>
                      <span className="font-ds-mono text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/[0.04] text-gray-400 border border-white/10 ml-auto">
                        {job.location} · {job.type}
                      </span>
                    </div>

                    <h3 className="font-ds-display text-xl sm:text-2xl font-bold text-white group-hover:text-white transition-colors leading-snug">
                      {job.title}
                    </h3>

                    <p className="mt-3 text-sm text-gray-300/85 leading-relaxed font-light">
                      {job.description}
                    </p>

                    {/* Skill Tags */}
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {job.skills.map((skill) => (
                        <span 
                          key={skill} 
                          className="font-ds-mono text-[11px] rounded-md bg-white/[0.03] text-gray-300 border border-white/[0.08] px-2.5 py-1"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    {/* Focus Area */}
                    <div className="mt-6 border-t border-white/[0.08] pt-4">
                      <p className="font-ds-mono text-xs uppercase tracking-wider text-gray-400 mb-2.5 font-semibold">
                        Core Focus Areas
                      </p>
                      <ul className="space-y-2 text-xs sm:text-sm text-gray-400 leading-relaxed font-light">
                        {job.focus.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="text-[#e36a88] mt-0.5 font-mono">—</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Apply Button */}
                  <div className="mt-7 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                    <a 
                      href={`mailto:careers@theasolutions.co?subject=${encodeURIComponent(`Application: ${job.title}`)}`} 
                      className="inline-flex items-center gap-2 rounded-full py-2.5 px-5 text-xs font-semibold bg-[#F1F1F0] text-[#1A1816] hover:bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.4)] hover:-translate-y-px active:translate-y-0 transition-all cursor-pointer"
                    >
                      <span>Apply for this role</span>
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </a>

                    <span className="font-ds-mono text-[11px] text-gray-500">
                      careers@theasolutions.co
                    </span>
                  </div>
                </article>
              ))}
            </div>

            {/* General Inquiries Card */}
            <div className="mt-12 rounded-2xl border border-white/10 bg-[#181816]/90 backdrop-blur-xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <div>
                <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7]">
                  Spontaneous Application
                </span>
                <h3 className="font-ds-display text-2xl font-bold text-white mt-1">
                  Do not see your exact role?
                </h3>
                <p className="mt-1 text-sm text-gray-400 font-light max-w-xl">
                  We are always eager to meet outstanding software craftsmen, AI researchers, and solution consultants. Send us your background.
                </p>
              </div>

              <a 
                href="mailto:careers@theasolutions.co?subject=General%20Career%20Application" 
                className="inline-flex shrink-0 items-center gap-2 rounded-full py-3 px-6 text-sm font-semibold bg-white/[0.06] text-white border border-white/15 hover:bg-white/[0.12] hover:border-[#5F1F2F]/60 transition-all"
              >
                <Mail size={16} aria-hidden="true" />
                <span>Introduce Yourself</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
