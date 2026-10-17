'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getEmployeeById, getEmployeeByUtmSource, Employee } from '@/lib/employeeData';
import { ExternalLink, X } from 'lucide-react';
import mixpanel from 'mixpanel-browser';

export default function EmployeePortfolio({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [utmSource, setUtmSource] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  useEffect(() => {
    params.then((resolvedParams) => {
      setEmployeeId(resolvedParams.id);
    });
  }, [params]);

  useEffect(() => {
    if (!employeeId) return;

    // Check for UTM source from business card
    const utmSourceParam = searchParams.get('utm_source');
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');
    setUtmSource(utmSourceParam);

    // Try to get employee by UTM source first, then by ID
    let foundEmployee = null;
    if (utmSourceParam) {
      foundEmployee = getEmployeeByUtmSource(utmSourceParam);
    }
    
    if (!foundEmployee) {
      foundEmployee = getEmployeeById(employeeId);
    }

    setEmployee(foundEmployee || null);
    setLoading(false);

    // Initialize Mixpanel and track events
    if (foundEmployee && typeof window !== 'undefined') {
      const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
      
      if (MIXPANEL_TOKEN) {
        try {
          mixpanel.init(MIXPANEL_TOKEN, {
            autocapture: false,
            persistence: 'localStorage',
            ignore_dnt: false,
            track_pageview: false,
          });

          const eventProperties = {
            employee_id: foundEmployee.id,
            employee_name: foundEmployee.name,
            employee_title: foundEmployee.title,
            utm_source: utmSourceParam,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
            is_qr_scan: utmMedium === 'business-card',
            referrer: document.referrer || undefined,
            page_url: window.location.href,
            timestamp: new Date().toISOString(),
          };

          mixpanel.track('Employee Portfolio Viewed', eventProperties);

          if (utmMedium === 'business-card') {
            mixpanel.track('QR Code Scanned', {
              ...eventProperties,
              scan_source: 'business_card',
              employee_id: foundEmployee.id,
              employee_name: foundEmployee.name,
            });
          }
        } catch (error) {
          console.error('Mixpanel tracking error:', error);
        }
      }
    }
  }, [employeeId, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1816]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#5F1F2F] border-t-transparent mx-auto"></div>
          <p className="mt-4 font-ds-mono text-xs uppercase tracking-wider text-gray-400">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1816] px-6">
        <div className="text-center max-w-md">
          <h1 className="font-ds-display text-2xl font-bold text-white mb-2">Employee Not Found</h1>
          <p className="text-sm text-gray-400 mb-6">The requested portfolio could not be found.</p>
          <Link 
            href="/"
            className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] hover:underline"
          >
            ← Return to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1816] text-[#F1F1F0] selection:bg-[#5F1F2F] selection:text-white">
      <div className="px-6 py-10 md:px-12 md:py-16">
        <div className="max-w-2xl mx-auto">
          
          {/* Minimal Header */}
          <div className="flex items-center justify-between mb-12 sm:mb-16">
            <Link 
              href="/" 
              className="font-ds-mono text-xs uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
            >
              Thea Solutions
            </Link>
            {utmSource && (
              <span className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7]">
                via business card
              </span>
            )}
          </div>

          {/* Profile Section (Unboxed, Typography-led) */}
          <div className="mb-16">
            <div className="flex items-start gap-6 sm:gap-8 mb-8">
              {employee.profileImage ? (
                <img
                  src={employee.profileImage}
                  alt={employee.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-[#5F1F2F]/40 shrink-0"
                  onClick={() => setIsImageModalOpen(true)}
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#5F1F2F] flex items-center justify-center text-white text-2xl font-bold shrink-0 font-ds-display">
                  {employee.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}

              <div>
                <h1 className="font-ds-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-1">
                  {employee.name}
                </h1>
                <p className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-4">
                  {employee.title}
                </p>
                <p className="text-sm sm:text-base text-gray-300 font-light leading-relaxed max-w-lg">
                  {employee.bio}
                </p>
              </div>
            </div>

            {/* Social Links - Clean typography, no blocks */}
            {employee.socialLinks && (
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs sm:text-sm font-ds-mono uppercase tracking-wider text-gray-400">
                {employee.socialLinks.linkedin && (() => {
                  const url = employee.socialLinks!.linkedin;
                  return (
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="hover:text-white transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        try {
                          mixpanel.track('Social Link Clicked', {
                            employee_id: employee.id,
                            employee_name: employee.name,
                            platform: 'linkedin',
                            url: url,
                            utm_source: utmSource,
                          });
                        } catch (err) {
                          console.error(err);
                        }
                        window.open(url, '_blank');
                      }}
                    >
                      LinkedIn
                    </a>
                  );
                })()}

                {employee.socialLinks.github && (() => {
                  const url = employee.socialLinks!.github;
                  return (
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        try {
                          mixpanel.track('Social Link Clicked', {
                            employee_id: employee.id,
                            employee_name: employee.name,
                            platform: 'github',
                            url: url,
                            utm_source: utmSource,
                          });
                        } catch (err) {
                          console.error(err);
                        }
                        window.open(url, '_blank');
                      }}
                    >
                      GitHub
                    </a>
                  );
                })()}

                {employee.socialLinks.twitter && (() => {
                  const url = employee.socialLinks!.twitter;
                  return (
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        try {
                          mixpanel.track('Social Link Clicked', {
                            employee_id: employee.id,
                            employee_name: employee.name,
                            platform: 'twitter',
                            url: url,
                            utm_source: utmSource,
                          });
                        } catch (err) {
                          console.error(err);
                        }
                        window.open(url, '_blank');
                      }}
                    >
                      Twitter
                    </a>
                  );
                })()}

                {employee.socialLinks.website && (() => {
                  const url = employee.socialLinks!.website;
                  return (
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        try {
                          mixpanel.track('Social Link Clicked', {
                            employee_id: employee.id,
                            employee_name: employee.name,
                            platform: 'website',
                            url: url,
                            utm_source: utmSource,
                          });
                        } catch (err) {
                          console.error(err);
                        }
                        window.open(url, '_blank');
                      }}
                    >
                      Website
                    </a>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Experience - Clean typography, no blocks */}
          {employee.experience && employee.experience.length > 0 && (
            <div className="mb-16">
              <h2 className="font-ds-mono text-xs uppercase tracking-wider text-gray-500 mb-8">
                Experience
              </h2>
              <div className="space-y-8">
                {employee.experience.map((exp, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-baseline gap-2 mb-1">
                      <h3 className="font-ds-display text-lg font-bold text-white">{exp.position}</h3>
                      <span className="font-ds-mono text-xs text-gray-400 shrink-0">{exp.startDate} — {exp.endDate}</span>
                    </div>
                    <p className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-2">{exp.company}</p>
                    <p className="text-sm text-gray-300 font-light leading-relaxed">
                      {exp.description.map(desc => desc.trim().endsWith('.') ? desc : `${desc}.`).join(' ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education - Clean typography, no blocks */}
          {employee.education && employee.education.length > 0 && (
            <div className="mb-16">
              <h2 className="font-ds-mono text-xs uppercase tracking-wider text-gray-500 mb-8">
                Education
              </h2>
              <div className="space-y-6">
                {employee.education.map((edu, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-baseline gap-2 mb-1">
                      <h3 className="font-ds-display text-lg font-bold text-white">{edu.degree}</h3>
                      <span className="font-ds-mono text-xs text-gray-400 shrink-0">{edu.startDate} — {edu.endDate}</span>
                    </div>
                    <p className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7]">{edu.institution}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills - Clean inline typography, no blocks */}
          {employee.skills && employee.skills.length > 0 && (
            <div className="mb-16">
              <h2 className="font-ds-mono text-xs uppercase tracking-wider text-gray-500 mb-6">
                Skills
              </h2>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 font-ds-mono text-xs text-gray-300 leading-relaxed">
                {employee.skills.map((skill, index) => (
                  <span key={index}>
                    {skill}{index < employee.skills.length - 1 && <span className="text-gray-600 ml-3">·</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Publications - Clean typography, no blocks */}
          {employee.publications && employee.publications.length > 0 && (
            <div className="mb-16">
              <h2 className="font-ds-mono text-xs uppercase tracking-wider text-gray-500 mb-8">
                Publication
              </h2>
              <div className="space-y-8">
                {employee.publications.map((publication, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-baseline gap-4 mb-1">
                      <h3 className="font-ds-display text-lg font-bold text-white">{publication.title}</h3>
                      <span className="font-ds-mono text-xs text-gray-400 whitespace-nowrap shrink-0">{publication.date}</span>
                    </div>
                    <p className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] mb-2">{publication.type}</p>
                    <p className="text-sm text-gray-300 font-light leading-relaxed mb-2">{publication.description}</p>
                    <p className="font-ds-mono text-xs text-gray-500 mb-2">{publication.authors.join(', ')}</p>
                    <a
                      href={publication.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-ds-mono text-xs uppercase tracking-wider text-[#f3a6b7] hover:underline inline-flex items-center gap-1"
                    >
                      <span>View publication</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact - Clean typography, no blocks */}
          {employee.contact && (
            <div className="mb-16">
              <h2 className="font-ds-mono text-xs uppercase tracking-wider text-gray-500 mb-6">
                Contact
              </h2>
              <div className="space-y-2.5 font-ds-mono text-xs">
                {employee.contact.email && (() => {
                  const email = employee.contact!.email;
                  return (
                    <a 
                      href={`mailto:${email}`} 
                      className="text-gray-300 hover:text-white transition-colors block"
                      onClick={() => {
                        try {
                          mixpanel.track('Contact Info Clicked', {
                            employee_id: employee.id,
                            employee_name: employee.name,
                            contact_type: 'email',
                            value: email,
                            utm_source: utmSource,
                          });
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                    >
                      {email}
                    </a>
                  );
                })()}

                {employee.contact.phone && (() => {
                  const phone = employee.contact!.phone;
                  return (
                    <a 
                      href={`tel:${phone}`} 
                      className="text-gray-300 hover:text-white transition-colors block"
                      onClick={() => {
                        try {
                          mixpanel.track('Contact Info Clicked', {
                            employee_id: employee.id,
                            employee_name: employee.name,
                            contact_type: 'phone',
                            value: phone,
                            utm_source: utmSource,
                          });
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                    >
                      {phone}
                    </a>
                  );
                })()}

                {employee.contact.location && (
                  <p className="text-gray-400">{employee.contact.location}</p>
                )}
              </div>
            </div>
          )}

          {/* Projects - Clean typography, no blocks */}
          {employee.projects && employee.projects.length > 0 && (
            <div className="mb-16">
              <h2 className="font-ds-mono text-xs uppercase tracking-wider text-gray-500 mb-8">
                Projects
              </h2>
              <div className="space-y-6">
                {employee.projects.map((project, index) => (
                  <div key={index}>
                    <h3 className="font-ds-display text-base font-bold text-white mb-1">{project.name}</h3>
                    <p className="text-sm text-gray-300 font-light leading-relaxed mb-2">{project.description}</p>
                    {project.url && (() => {
                      const url = project.url;
                      return (
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-ds-mono text-xs text-[#f3a6b7] hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            try {
                              mixpanel.track('Project Viewed', {
                                employee_id: employee.id,
                                employee_name: employee.name,
                                project_name: project.name,
                                project_url: url,
                                technologies: project.technologies,
                                utm_source: utmSource,
                              });
                            } catch (err) {
                              console.error(err);
                            }
                            window.open(url, '_blank');
                          }}
                        >
                          {url}
                        </a>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications - Clean typography, no blocks */}
          {employee.certifications && employee.certifications.length > 0 && (
            <div className="mb-16">
              <h2 className="font-ds-mono text-xs uppercase tracking-wider text-gray-500 mb-6">
                Certifications
              </h2>
              <div className="space-y-4">
                {employee.certifications.map((cert, index) => (
                  <div key={index} className="flex justify-between items-baseline gap-2">
                    <div>
                      <h3 className="font-ds-display text-base font-bold text-white">{cert.name}</h3>
                      <p className="font-ds-mono text-xs text-[#f3a6b7] mt-0.5">{cert.issuer}</p>
                    </div>
                    <span className="font-ds-mono text-xs text-gray-400 shrink-0">{cert.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-8 border-t border-white/10 flex items-center justify-between font-ds-mono text-xs text-gray-500">
            <p>© {new Date().getFullYear()} Thea Solutions</p>
            <Link href="/" className="hover:text-white transition-colors">theasolutions.co</Link>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {isImageModalOpen && employee.profileImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div className="relative max-w-2xl max-h-[90vh]">
            <img
              src={employee.profileImage}
              alt={employee.name}
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 h-9 w-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors"
              onClick={() => setIsImageModalOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}