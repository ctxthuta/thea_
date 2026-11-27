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
  publications?: Publication[];
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

export interface Publication {
  title: string;
  type: string;
  date: string;
  authors: string[];
  description: string;
  url: string;
}

export const employees: Employee[] = [
  {
    id: 'thiri-chan-nyein',
    name: 'Thiri Chan Nyein',
    title: 'Client Acquisition & Solutions Lead',
    profileImage: '',
    bio: 'A seasoned professional in client acquisition and solutions delivery, with a strong background in project management and software development.',
    education: [
      {
        degree: 'BCompSci in Business Information Systems',
        institution: 'University of Information Technology, Yangon',
        location: 'Yangon, Myanmar',
        startDate: '2018',
        endDate: '2025',
        description: 'Focused on software engineering and management.',
      },
    ],
    experience: [
      {
        position: 'Client Acquisition & Solutions Lead',
        company: 'Thea Solutions',
        location: 'Yangon, Myanmar',
        startDate: '2026',
        endDate: 'Present',
        current: true,
        description: [
          'Lead development teams and project delivery',
          'Coordinate with clients and stakeholders',
        ],
      },
      {
        position: 'Business Analyst',
        company: 'BIM Group of Companies',
        location: 'Yangon, Myanmar',
        startDate: '2025',
        endDate: 'Present',
        current: true,
        description: [
          'Gather and analyze business requirements',
          'Collaborate with development teams to implement solutions',
          'Ensure project deliverables meet client expectations',
          'Client-facing role, providing insights and recommendations for business process improvements',
        ],
      },
      {
        position: 'Data Analyst',
        company: 'Enterprise Nexus Co., Ltd',
        location: 'Chiang Mai, Thailand',
        startDate: '2023',
        endDate: '2025',
        current: false,
        description: [
          'Analyze data to support business decisions',
          'Ensure data integrity and accuracy',
          'Create row definitions and data models for reporting and analytics',
          'Collaborate with cross-functional teams to identify data needs and solutions',
        ],
      },
      {
        position: 'Assistant Teacher',
        company: 'Brainworks International School',
        location: 'Yangon, Myanmar',
        startDate: '2022',
        endDate: '2023',
        current: false,
        description: [
          'Curriculum development and lesson planning',
          'Assist in teaching nursery students',
          'Provide support to lead teachers in classroom management and student engagement',
          'Collaborate with other teachers to create a positive learning environment',
          'Plan and implement educational activities and projects for students',
          'Parent-teacher communication and engagement to support student learning and development every term',
        ],
      },
      {
        position: 'Freelance Web Developer',
        company: 'Self-Employed',
        location: 'Yangon, Myanmar',
        startDate: '2020',
        endDate: '2022',
        current: false,
        description: [
          'Developed and maintained websites for small businesses and individuals',
          'Implemented responsive design and optimized user experience',
          'Collaborated with clients to gather requirements and deliver solutions on time',
        ],
      },
    ],
    skills: [
      'Project Management',
      'Software Development',
      'Data Analysis',
      'Business Analysis',
      'Problem Solving',
      'Client Relations',
      'Agile Methodology',
      'Strategic Planning',
      'Team Collaboration',
    ],
    contact: {
      email: 'thirichannyein@theasolutions.co',
      location: 'Yangon, Myanmar',
    },
    socialLinks: {
      linkedin: 'https://www.linkedin.com/in/thiri-chan-nyein/',
    },
  },
  {
    id: 'chue-yamin-lwin',
    name: 'Chue Yamin Lwin',
    title: 'Business Analyst',
    profileImage: '',
    bio: 'Business Analyst specializing in operational process mapping, ERP requirements engineering, and client onboarding across Southeast Asia.',
    education: [
      {
        degree: 'B.C.Sc. in Computer Science',
        institution: 'University of Computer Studies, Yangon',
        location: 'Yangon, Myanmar',
        startDate: '2019',
        endDate: '2024',
        description: 'Focused on software systems analysis and enterprise databases.',
      },
    ],
    experience: [
      {
        position: 'Business Analyst',
        company: 'Thea Solutions',
        location: 'Yangon, Myanmar',
        startDate: '2026',
        endDate: 'Present',
        current: true,
        description: [
          'Lead stakeholder discovery workshops and technical requirements scoping',
          'Coordinate UAT acceptance criteria and client handover training',
        ],
      },
    ],
    skills: [
      'Business Analysis',
      'Requirements Engineering',
      'Process Mapping',
      'Stakeholder Management',
      'UAT Coordination',
    ],
    contact: {
      email: 'chueyaminlwin@theasolutions.co',
      location: 'Yangon, Myanmar',
    },
  },
];

export function getEmployeeById(id: string): Employee | undefined {
  return employees.find((emp) => emp.id === id);
}

export function getEmployeeByUtmSource(utmSource: string): Employee | undefined {
  const employeeId = utmSource.replace('-card', '').replace('-business-card', '');
  return getEmployeeById(employeeId);
}
