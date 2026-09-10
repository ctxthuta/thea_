'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getEmployeeById, getEmployeeByUtmSource, Employee } from '@/lib/employeeData';
import { Calendar, MapPin, Mail, Phone, Linkedin, Github, Twitter, Globe, ExternalLink, Award, Briefcase, GraduationCap, Code } from 'lucide-react';
import mixpanel from 'mixpanel-browser';

export default function EmployeePortfolio({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [utmSource, setUtmSource] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    // Resolve the params promise
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

          // Track portfolio view event
          mixpanel.track('Employee Portfolio Viewed', eventProperties);

          // Track QR scan specifically if from business card
          if (utmMedium === 'business-card') {
            mixpanel.track('QR Code Scanned', {
              ...eventProperties,
              scan_source: 'business_card',
              employee_id: foundEmployee.id,
              employee_name: foundEmployee.name,
            });
          }

          console.log('Mixpanel events tracked:', eventProperties);
        } catch (error) {
          console.error('Mixpanel tracking error:', error);
        }
      } else {
        console.log('Mixpanel token not found, skipping analytics');
      }
    }
  }, [employeeId, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-color">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5F1F2F] mx-auto"></div>
          <p className="mt-4 paragraph-color">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-color">
        <div className="text-center">
          <h1 className="text-2xl font-bold paragraph-color mb-2">Employee Not Found</h1>
          <p className="paragraph-color opacity-70">The requested portfolio could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-color">
      {/* Minimal Header */}
      <div className="px-6 py-8 md:px-12 md:py-16">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <span className="text-sm paragraph-color opacity-40">Thea Solutions</span>
            {utmSource && (
              <span className="text-xs accent-color opacity-60">via business card</span>
            )}
          </div>

          {/* Profile Section */}
          <div className="mb-16">
            <div className="flex items-start gap-6 mb-8">
              {employee.profileImage ? (
                <img 
                  src={employee.profileImage} 
                  alt={employee.name}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#5F1F2F] flex items-center justify-center text-white text-2xl font-bold">
                  {employee.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              <div>
                <h1 className="text-3xl md:text-4xl font-bold paragraph-color mb-2">{employee.name}</h1>
                <p className="text-lg accent-color mb-4">{employee.title}</p>
                <p className="paragraph-color opacity-70 leading-relaxed max-w-lg">{employee.bio}</p>
              </div>
            </div>

            {/* Social Links - Minimal */}
            {employee.socialLinks && (
              <div className="flex flex-wrap gap-6 text-sm paragraph-color opacity-60">
                {employee.socialLinks.linkedin && (() => {
                  const url = employee.socialLinks!.linkedin;
                  return (
                    <a href={url} target="_blank" rel="noopener noreferrer" 
                       className="hover:opacity-100 transition-opacity"
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
                           window.open(url, '_blank');
                         } catch (error) {
                           console.error('Mixpanel tracking error:', error);
                           window.open(url, '_blank');
                         }
                       }}>
                      LinkedIn
                    </a>
                  );
                })()}
                {employee.socialLinks.github && (() => {
                  const url = employee.socialLinks!.github;
                  return (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                       className="hover:opacity-100 transition-opacity"
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
                           window.open(url, '_blank');
                         } catch (error) {
                           console.error('Mixpanel tracking error:', error);
                           window.open(url, '_blank');
                         }
                       }}>
                      GitHub
                    </a>
                  );
                })()}
                {employee.socialLinks.twitter && (() => {
                  const url = employee.socialLinks!.twitter;
                  return (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                       className="hover:opacity-100 transition-opacity"
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
                           window.open(url, '_blank');
                         } catch (error) {
                           console.error('Mixpanel tracking error:', error);
                           window.open(url, '_blank');
                         }
                       }}>
                      Twitter
                    </a>
                  );
                })()}
                {employee.socialLinks.website && (() => {
                  const url = employee.socialLinks!.website;
                  return (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                       className="hover:opacity-100 transition-opacity"
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
                           window.open(url, '_blank');
                         } catch (error) {
                           console.error('Mixpanel tracking error:', error);
                           window.open(url, '_blank');
                         }
                       }}>
                      Website
                    </a>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Experience - Minimal */}
          {employee.experience && employee.experience.length > 0 && (
            <div className="mb-16">
              <h2 className="text-sm paragraph-color opacity-40 mb-8 uppercase tracking-wider">Experience</h2>
              <div className="space-y-8">
                {employee.experience.map((exp, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="text-lg paragraph-color">{exp.position}</h3>
                      <span className="text-sm paragraph-color opacity-40">{exp.startDate} — {exp.endDate}</span>
                    </div>
                    <p className="text-sm accent-color mb-2">{exp.company}</p>
                    <p className="text-sm paragraph-color opacity-60 leading-relaxed">{exp.description.join(' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education - Minimal */}
          {employee.education && employee.education.length > 0 && (
            <div className="mb-16">
              <h2 className="text-sm paragraph-color opacity-40 mb-8 uppercase tracking-wider">Education</h2>
              <div className="space-y-8">
                {employee.education.map((edu, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="text-lg paragraph-color">{edu.degree}</h3>
                      <span className="text-sm paragraph-color opacity-40">{edu.startDate} — {edu.endDate}</span>
                    </div>
                    <p className="text-sm accent-color">{edu.institution}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills - Minimal */}
          {employee.skills && employee.skills.length > 0 && (
            <div className="mb-16">
              <h2 className="text-sm paragraph-color opacity-40 mb-8 uppercase tracking-wider">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {employee.skills.map((skill, index) => (
                  <span key={index} className="text-sm paragraph-color opacity-60">
                    {skill}{index < employee.skills.length - 1 && ' · '}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Publications - Minimal */}
          {employee.publications && employee.publications.length > 0 && (
            <div className="mb-16">
              <h2 className="text-sm paragraph-color opacity-40 mb-8 uppercase tracking-wider">Publication</h2>
              <div className="space-y-8">
                {employee.publications.map((publication, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-baseline gap-4 mb-1">
                      <h3 className="text-lg paragraph-color">{publication.title}</h3>
                      <span className="text-sm paragraph-color opacity-40 whitespace-nowrap">{publication.date}</span>
                    </div>
                    <p className="text-sm accent-color mb-2">{publication.type}</p>
                    <p className="text-sm paragraph-color opacity-60 leading-relaxed mb-2">{publication.description}</p>
                    <p className="text-sm paragraph-color opacity-50 mb-2">{publication.authors.join(', ')}</p>
                    <a
                      href={publication.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm accent-color hover:opacity-80 transition-opacity"
                    >
                      View publication <ExternalLink size={14} className="inline-block ml-1" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact - Minimal */}
          {employee.contact && (
            <div className="mb-16">
              <h2 className="text-sm paragraph-color opacity-40 mb-8 uppercase tracking-wider">Contact</h2>
              <div className="space-y-2">
                {employee.contact.email && (() => {
                  const email = employee.contact!.email;
                  return (
                    <a href={`mailto:${email}`} className="text-sm paragraph-color opacity-60 hover:opacity-100 transition-opacity block"
                       onClick={(e) => {
                         try {
                           mixpanel.track('Contact Info Clicked', {
                             employee_id: employee.id,
                             employee_name: employee.name,
                             contact_type: 'email',
                             value: email,
                             utm_source: utmSource,
                           });
                         } catch (error) {
                           console.error('Mixpanel tracking error:', error);
                         }
                       }}>
                      {email}
                    </a>
                  );
                })()}
                {employee.contact.phone && (() => {
                  const phone = employee.contact!.phone;
                  return (
                    <a href={`tel:${phone}`} className="text-sm paragraph-color opacity-60 hover:opacity-100 transition-opacity block"
                       onClick={(e) => {
                         try {
                           mixpanel.track('Contact Info Clicked', {
                             employee_id: employee.id,
                             employee_name: employee.name,
                             contact_type: 'phone',
                             value: phone,
                             utm_source: utmSource,
                           });
                         } catch (error) {
                           console.error('Mixpanel tracking error:', error);
                         }
                       }}>
                      {phone}
                    </a>
                  );
                })()}
                {employee.contact.location && (
                  <p className="text-sm paragraph-color opacity-60">{employee.contact.location}</p>
                )}
              </div>
            </div>
          )}

          {/* Projects - Minimal */}
          {employee.projects && employee.projects.length > 0 && (
            <div className="mb-16">
              <h2 className="text-sm paragraph-color opacity-40 mb-8 uppercase tracking-wider">Projects</h2>
              <div className="space-y-6">
                {employee.projects.map((project, index) => (
                  <div key={index}>
                    <h3 className="text-base paragraph-color mb-1">{project.name}</h3>
                    <p className="text-sm paragraph-color opacity-60 mb-2">{project.description}</p>
                    {project.url && (() => {
                      const url = project.url;
                      return (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                           className="text-sm accent-color hover:opacity-80 transition-opacity"
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
                               window.open(url, '_blank');
                             } catch (error) {
                               console.error('Mixpanel tracking error:', error);
                               window.open(url, '_blank');
                             }
                           }}>
                          {url}
                        </a>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications - Minimal */}
          {employee.certifications && employee.certifications.length > 0 && (
            <div className="mb-16">
              <h2 className="text-sm paragraph-color opacity-40 mb-8 uppercase tracking-wider">Certifications</h2>
              <div className="space-y-4">
                {employee.certifications.map((cert, index) => (
                  <div key={index} className="flex justify-between items-baseline">
                    <div>
                      <h3 className="text-base paragraph-color">{cert.name}</h3>
                      <p className="text-sm paragraph-color opacity-60">{cert.issuer}</p>
                    </div>
                    <span className="text-sm paragraph-color opacity-40">{cert.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-8 border-t border-color border-opacity-20">
            <p className="text-xs paragraph-color opacity-30">© {new Date().getFullYear()} Thea Solutions</p>
          </div>
        </div>
      </div>
    </div>
  );
}