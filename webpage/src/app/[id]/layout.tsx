import type { Metadata } from "next";
import { getEmployeeById } from '@/lib/employeeData';
import "../globals.css";

interface EmployeeLayoutProps {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: EmployeeLayoutProps): Promise<Metadata> {
  const { id } = await params;
  const employee = getEmployeeById(id);
  
  if (!employee) {
    return {
      title: "Employee Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const baseUrl = "https://theasolutions.co";
  const profileImageUrl = employee.profileImage 
    ? (employee.profileImage.startsWith('http') ? employee.profileImage : `${baseUrl}${employee.profileImage}`)
    : `${baseUrl}/logo.ico`;

  return {
    title: `${employee.name} - ${employee.title} | Thea Solutions`,
    description: employee.bio,
    robots: {
      index: false, // Hide from search engines
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
    openGraph: {
      title: `${employee.name} - ${employee.title}`,
      description: employee.bio,
      type: "profile",
      url: `/${id}`,
      siteName: "Thea Solutions",
      images: [
        {
          url: profileImageUrl,
          width: 1200,
          height: 630,
          alt: `${employee.name} - ${employee.title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${employee.name} - ${employee.title}`,
      description: employee.bio,
      images: [profileImageUrl],
    },
    other: {
      "employee:id": id,
      "employee:name": employee.name,
      "employee:title": employee.title,
    },
  };
}

export default function EmployeeLayout({ children }: EmployeeLayoutProps) {
  return (
    <div className="min-h-screen bg-color paragraph-color">
      {children}
    </div>
  );
}