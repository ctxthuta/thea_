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
    profileImage: "https://westernfinance.org/wp-content/uploads/speaker-3-v2.jpg",
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
      linkedin: "https://www.linkedin.com/in/ohnmarthan"
    }
  },
  {
    id: "thiri-chan-nyein",
    name: "Thiri Chan Nyein",
    title: "Client Aquisition & Solutions Lead",
    profileImage: "https://westernfinance.org/wp-content/uploads/speaker-3-v2.jpg",
    bio: "A seasoned professional in client acquisition and solutions delivery, with a strong background in project management and software development.",
    education: [
      {
        degree: "BCompSci in Business Information Systems",
        institution: "University of Information Technology, Yangon",
        location: "Yangon, Myanmar",
        startDate: "2018",
        endDate: "2025",
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
      {
        position: "Business Analyst",
        company: "BIM Group of Companies",
        location: "Yangon, Myanmar",
        startDate: "2025",
        endDate: "Present",
        current: true,
        description: [
          "Gather and analyze business requirements",
          "Collaborate with development teams to implement solutions",
          "Ensure project deliverables meet client expectations",
          "Client-facing role, providing insights and recommendations for business process improvements"
        ]
      },
      {
        position: "Data Analyst",
        company: "Enterprise Nexus Co., Ltd",
        location: "Chaing Mai, Thailand",
        startDate: "2023",
        endDate: "2025",
        current: false,
        description: [
          "Analyze data to support business decisions",
          "Ensure data integrity and accuracy",
          "Create row definitions and data models for reporting and analytics",
          "Collaborate with cross-functional teams to identify data needs and solutions"
        ]
      },
      {
        position: "Assistant Teacher",
        company: "Brainworks International School",
        location: "Yangon, Myanmar",
        startDate: "2022",
        endDate: "2023",
        current: false,
        description: [
          "Curriculum development and lesson planning",
          "Assist in teaching nursery students",
          "Provide support to lead teachers in classroom management and student engagement",
          "Collaborate with other teachers to create a positive learning environment",
          "Plan and Implement educational activities and projects for students",
          "Parent-teacher communication and engagement to support student learning and development every terms"

        ]
      },
      {
        position: "Freelance Web Developer",
        company: "Self-Employed",
        location: "Yangon, Myanmar",
        startDate: "2020",
        endDate: "2022",
        current: false,
        description: [
          "Developed and maintained websites for small businesses and individuals",
          "Implemented responsive design and optimized user experience",
          "Collaborated with clients to gather requirements and deliver solutions on time"
        ]
      },
    ],
    skills: [
      "Project Management", "Software Development", "Data Analysis", "Business Analysis", "Problem Solving",
      "Client Relations", "Agile Methodology", "Strategic Planning", "Child Development", "Curriculum Design", "Lesson Planning", "Team Collaboration", "Psychology"
    ],
    contact: {
      email: "thirichannyein@theasolutions.co",
      location: "Yangon, Myanmar"
    },
    socialLinks: {
      linkedin: "https://www.linkedin.com/in/thiri-chan-nyein/"
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