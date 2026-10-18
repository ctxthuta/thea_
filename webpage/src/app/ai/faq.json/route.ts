import { NextResponse } from 'next/server';

export async function GET() {
  const faq = {
    version: "1.0",
    lastModified: new Date().toISOString(),
    faqs: [
      {
        question: "What services does Thea Solutions provide?",
        answer: "Thea Solutions specializes in bespoke software development, enterprise-grade AI solutions, and intelligent automation systems. We build custom software, integrate AI technologies, and create automated workflows specifically designed for SMEs to streamline operations and scale efficiently."
      },
      {
        question: "Who are Thea Solutions' clients?",
        answer: "We serve small to medium businesses, enterprise organizations, startups seeking technical solutions, and companies undergoing digital transformation. Our technical solutions are customized to meet the specific operational needs of each client."
      },
      {
        question: "How does Thea Solutions approach software development?",
        answer: "We pair production-proven open standards (Go, Next.js, PostgreSQL, GCP/AWS) with rapid 2-week agile delivery cycles. Our methodology combines deep stakeholder discovery, bi-weekly live demos, rigorous automated testing, and client IP ownership from day one."
      },
      {
        question: "What makes Thea Solutions different from other tech companies?",
        answer: "Thea Solutions stands out through our focus on practical, implementable solutions that drive real operational results. We prioritize understanding each client's unique technical challenges, building long-term technical partnerships, and delivering solutions that create sustainable competitive advantages through automation and AI."
      },
      {
        question: "How can I get started with Thea Solutions?",
        answer: "You can get started by visiting our website at https://theasolutions.co and contacting us through our contact form. We offer initial technical consultations to understand your business needs and determine how we can best support your automation and software development objectives."
      }
    ]
  };

  return NextResponse.json(faq, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
