export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  subCategory?: string;
  description: string;
  features: string[];
  targetAudience: string[];
  jurisdictions?: string[]; // For legal/compliance products
  demoAvailable: boolean;
}

export type ProductCategory = 
  | 'corporate-agents'
  | 'corporate-intelligence' 
  | 'legal-compliance-intelligence'
  | 'actions';

export const productCategories: Record<ProductCategory, { name: string; description: string }> = {
  'corporate-agents': {
    name: 'Thea Corporate Agents',
    description: 'AI-powered agents for enterprise operations'
  },
  'corporate-intelligence': {
    name: 'Thea Corporate Intelligence', 
    description: 'Business intelligence and market analysis'
  },
  'legal-compliance-intelligence': {
    name: 'Thea Legal/Compliance Intelligence',
    description: 'Legal AI trained for regional compliance'
  },
  'actions': {
    name: 'Thea Actions',
    description: 'Automated workflow and process intelligence'
  }
};

export const corporateAgentsProducts: Product[] = [
  {
    id: 'thea-executives',
    name: 'Thea Executives',
    category: 'corporate-agents',
    description: 'AI-powered executive assistant for strategic decision making and leadership support.',
    features: [
      'Strategic planning assistance',
      'Executive briefing generation',
      'Decision support analytics',
      'Leadership coaching insights'
    ],
    targetAudience: ['C-level executives', 'Directors', 'Senior managers'],
    demoAvailable: true
  },
  {
    id: 'thea-finance',
    name: 'Thea Finance',
    category: 'corporate-agents',
    description: 'Financial analysis and forecasting AI for CFOs and finance teams.',
    features: [
      'Financial modeling',
      'Cash flow forecasting',
      'Budget optimization',
      'Risk assessment'
    ],
    targetAudience: ['CFOs', 'Finance directors', 'Financial analysts'],
    demoAvailable: true
  },
  {
    id: 'thea-marketing',
    name: 'Thea Marketing',
    category: 'corporate-agents',
    description: 'Marketing intelligence and campaign optimization AI.',
    features: [
      'Campaign performance analysis',
      'Customer segmentation',
      'Content strategy generation',
      'ROI optimization'
    ],
    targetAudience: ['CMOs', 'Marketing directors', 'Brand managers'],
    demoAvailable: true
  },
  {
    id: 'thea-hr',
    name: 'Thea HR',
    category: 'corporate-agents',
    description: 'HR management and talent acquisition AI agent.',
    features: [
      'Resume screening',
      'Employee engagement analysis',
      'Performance review assistance',
      'HR policy guidance'
    ],
    targetAudience: ['CHROs', 'HR managers', 'Recruiters'],
    demoAvailable: true
  },
  {
    id: 'thea-ops',
    name: 'Thea Ops',
    category: 'corporate-agents',
    description: 'Operations optimization and supply chain intelligence.',
    features: [
      'Process optimization',
      'Supply chain analysis',
      'Operational efficiency metrics',
      'Resource allocation'
    ],
    targetAudience: ['COOs', 'Operations managers', 'Supply chain leads'],
    demoAvailable: true
  },
  {
    id: 'thea-engineering',
    name: 'Thea Engineering',
    category: 'corporate-agents',
    description: 'Technical leadership and engineering management AI.',
    features: [
      'Code review assistance',
      'Technical architecture guidance',
      'DevOps optimization',
      'Engineering metrics'
    ],
    targetAudience: ['CTOs', 'Engineering managers', 'Tech leads'],
    demoAvailable: true
  },
  {
    id: 'thea-data-analyst',
    name: 'Thea Data Analyst',
    category: 'corporate-agents',
    description: 'Data analysis and business intelligence AI agent.',
    features: [
      'Automated data analysis',
      'Report generation',
      'Trend identification',
      'Predictive analytics'
    ],
    targetAudience: ['Data analysts', 'Business analysts', 'Data scientists'],
    demoAvailable: true
  },
  {
    id: 'thea-project',
    name: 'Thea Project',
    category: 'corporate-agents',
    description: 'Project management and coordination AI agent.',
    features: [
      'Project timeline optimization',
      'Resource allocation',
      'Risk identification',
      'Progress tracking'
    ],
    targetAudience: ['Project managers', 'Program managers', 'Scrum masters'],
    demoAvailable: true
  },
  {
    id: 'thea-it',
    name: 'Thea IT',
    category: 'corporate-agents',
    description: 'IT operations and infrastructure management AI.',
    features: [
      'System monitoring',
      'Incident response',
      'Infrastructure optimization',
      'Security analysis'
    ],
    targetAudience: ['CIOs', 'IT managers', 'System administrators'],
    demoAvailable: true
  },
  {
    id: 'thea-meetings',
    name: 'Thea Meetings',
    category: 'corporate-agents',
    description: 'Meeting intelligence and optimization AI agent.',
    features: [
      'Meeting summarization',
      'Action item tracking',
      'Participant insights',
      'Follow-up automation'
    ],
    targetAudience: ['All professionals', 'Team leads', 'Project coordinators'],
    demoAvailable: true
  }
];

export const corporateIntelligenceProducts: Product[] = [
  {
    id: 'thea-intelligence',
    name: 'Thea Intelligence',
    category: 'corporate-intelligence',
    subCategory: 'corporate-intelligence',
    description: 'Comprehensive business intelligence and market analysis platform.',
    features: [
      'Market trend analysis',
      'Competitor intelligence',
      'Industry insights',
      'Growth opportunity identification'
    ],
    targetAudience: ['Business strategists', 'Market researchers', 'Consultants'],
    demoAvailable: true
  },
  {
    id: 'thea-sales-business',
    name: 'Thea Sales & Business',
    category: 'corporate-intelligence',
    subCategory: 'corporate-intelligence',
    description: 'Sales intelligence and business development AI platform.',
    features: [
      'Lead scoring',
      'Sales forecasting',
      'Customer insights',
      'Deal optimization'
    ],
    targetAudience: ['Sales directors', 'Business development', 'Revenue operations'],
    demoAvailable: true
  },
  {
    id: 'thea-product',
    name: 'Thea Product',
    category: 'corporate-intelligence',
    subCategory: 'corporate-intelligence',
    description: 'Product intelligence and development optimization platform.',
    features: [
      'Market fit analysis',
      'Feature prioritization',
      'User feedback analysis',
      'Product roadmap optimization'
    ],
    targetAudience: ['Product managers', 'Product directors', 'UX researchers'],
    demoAvailable: true
  }
];

export const legalComplianceProducts: Product[] = [
  {
    id: 'thea-legal-compliance',
    name: 'Thea Legal/Compliance Intelligence',
    category: 'legal-compliance-intelligence',
    description: 'AI trained on laws and compliance regulations across Southeast Asia.',
    features: [
      'Regulatory compliance checking',
      'Legal document analysis',
      'Risk assessment',
      'Compliance reporting'
    ],
    targetAudience: ['Legal teams', 'Compliance officers', 'Risk managers'],
    jurisdictions: ['Thailand', 'Laos', 'Malaysia', 'Indonesia', 'Myanmar'],
    demoAvailable: true
  }
];

export const actionsProducts: Product[] = [
  {
    id: 'thea-actions',
    name: 'Thea Actions',
    category: 'actions',
    description: 'Automated workflow and process intelligence platform.',
    features: [
      'Workflow automation',
      'Process optimization',
      'Task coordination',
      'Efficiency tracking'
    ],
    targetAudience: ['Operations teams', 'Process engineers', 'Business analysts'],
    demoAvailable: true
  }
];

export const allProducts: Product[] = [
  ...corporateAgentsProducts,
  ...corporateIntelligenceProducts,
  ...legalComplianceProducts,
  ...actionsProducts
];

export function getProductById(id: string): Product | undefined {
  return allProducts.find(product => product.id === id);
}

export function getProductsByCategory(category: ProductCategory): Product[] {
  return allProducts.filter(product => product.category === category);
}

export function generateProductId(product: Omit<Product, 'id'>): string {
  const baseName = product.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const timestamp = Date.now().toString(36);
  return `${baseName}-${timestamp}`;
}