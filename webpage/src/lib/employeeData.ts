export interface Employee {
  id: string;
  name: string;
  title: string;
  profileImage: string;
  bio: string;
  education: Education[];
  experience: Experience[];
  skills: string[];
  certifications?: Certification[];
  contact?: ContactInfo;
  socialLinks?: SocialLinks;
  projects?: Project[];
}

export interface Education {
  degree: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface Experience {
  position: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current?: boolean;
  description: string[];
}

export interface Certification {
  name: string;
  issuer: string;
  date: string;
  credentialUrl?: string;
}

export interface ContactInfo {
  email: string;
  phone?: string;
  location?: string;
}

export interface SocialLinks {
  linkedin?: string;
  github?: string;
  twitter?: string;
  website?: string;
}

export interface Project {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
}

export const employees: Employee[] = [
  {
    id: "dr-ohnmar-than",
    name: "Dr. Ohnmar Than",
    title: "Chief Financial Officer",
    profileImage: "",
    bio: "Experienced Chief Financial Officer with expertise in financial strategy, operations, business development, and healthcare information technology. Proven track record in driving financial growth and operational efficiency.",
    education: [
      {
        degree: "PhD in Medical Technology",
        institution: "University of Medical Technology, Yangon",
        location: "Yangon, Myanmar",
        startDate: "2020",
        endDate: "2023",
        description: "Focused on Cancer Research."
      }
    ],
    experience: [
      {
        position: "Chief Financial Officer",
        company: "Thea Solutions",
        location: "Yangon, Myanmar",
        startDate: "2026",
        endDate: "Present",
        current: true,
        description: [
          "Oversee financial planning and analysis",
          "Manage investor relations and fundraising",
          "Drive financial strategy and business growth",
          "Advise on Healthcare Information Technology solutions and investments"
        ]
      },
    ],
    skills: [
      "Healthcare Industry Expertise", "Financial Strategy", "Business Development",
      "Financial Planning", "Risk Management", "Strategic Planning", 
      "Investor Relations", "Budget Management", "Financial Analysis"
    ],
    contact: {
      email: "ohnmarthan@theasolutions.co",
      location: "Yangon, Myanmar"
    },
    socialLinks: {
      linkedin: "https://linkedin.com/in/ohnmarthan"
    }
  },
  {
    id: "thiri-chan-nyein",
    name: "Thiri Chan Nyein",
    title: "Client Aquisition & Solutions Lead",
    profileImage: "",
    bio: "A seasoned professional in client acquisition and solutions delivery, with a strong background in project management and software development.",
    education: [
      {
        degree: "B.S. Computer Science",
        institution: "University of Computer Studies",
        location: "Yangon, Myanmar",
        startDate: "2010",
        endDate: "2014",
        description: "Focused on software engineering and management."
      }
    ],
    experience: [
      {
        position: "Client Aquisition & Solutions Lead",
        company: "Thea Solutions",
        location: "Yangon, Myanmar",
        startDate: "2026",
        endDate: "Present",
        current: true,
        description: [
          "Lead development teams and project delivery",
          "Coordinate with clients and stakeholders"
        ]
      },
    ],
    skills: [
      "Project Management", "Software Development",
      "Client Relations", "Agile Methodology", "Strategic Planning"
    ],
    contact: {
      email: "thirichannyein@theasolutions.co",
      location: "Yangon, Myanmar"
    },
    socialLinks: {
      linkedin: "https://linkedin.com/in/thirichannyein"
    }
  }
];

export function getEmployeeById(id: string): Employee | undefined {
  return employees.find(emp => emp.id === id);
}

export function getEmployeeByUtmSource(utmSource: string): Employee | undefined {
  // UTM source from business card would be like "dr-ohnmar-than-card" or "thiri-chan-nyein-card"
  // The "-card" suffix is optional for flexibility
  const employeeId = utmSource.replace('-card', '').replace('-business-card', '');
  return getEmployeeById(employeeId);
}