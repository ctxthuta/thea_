import { NextResponse } from 'next/server';

export async function GET() {
  const summary = {
    version: "1.0",
    lastModified: new Date().toISOString(),
    summary: "Thea Solutions specializes in bespoke software development, enterprise-grade AI solutions, and intelligent automation systems engineered specifically for SMEs to streamline operations and scale with confidence.",
    keyFeatures: [
      "Bespoke software development",
      "Enterprise AI solutions",
      "Workflow automation",
      "Machine learning integration",
      "Custom API development",
      "Process optimization"
    ],
    targetAudience: [
      "Small to medium businesses",
      "Enterprise organizations",
      "Startups seeking technical solutions",
      "Companies undergoing digital transformation"
    ],
    primaryUseCases: [
      "Custom software development",
      "AI-powered automation",
      "Business process optimization",
      "Data analytics solutions",
      "Cloud integration"
    ],
    valueProposition: "Thea Solutions engineers bespoke distributed software architectures, domain-tuned AI models, and automated back-office workflows that deliver measurable cost reductions, zero vendor lock-in, and reliable operational scale for growing businesses."
  };

  return NextResponse.json(summary, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
