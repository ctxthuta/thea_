'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {motion} from 'framer-motion'
import { Instagram, Linkedin, Mail } from 'lucide-react'

function TikTokIcon({ size = 24, className = '' }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  )
}

function Footer() {
  const [formData, setFormData] = useState({
    email: '',
    phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitMessage('We will reach out to you soon!');
        setFormData({ email: '', phone: '' });
      } else {
        setSubmitMessage('Failed to submit. Please try again.');
      }
    } catch (error) {
      setSubmitMessage('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className='w-full transparent-white overflow-hidden'>
        <motion.div 
        initial={{opacity: 0, y: 50}}
        whileInView={{opacity: 1, y: 0}}
        transition={{duration: 1}}
        className='w-full lg:container mx-auto lg:px-10 flex flex-col md:flex-row items-end justify-end lg:justify-between'> 
            <div className='w-full lg:w-2/3 h-fit my-6 lg:my-10 flex flex-col justify-center lg:justify-start items-center lg:items-start'>
                <div className='text-2xl lg:text-5xl w-full md:w-4/5 px-6 lg:px-0'>
                Don&apos;t Wait - transform your business <span className='accent-color'>today!</span>
                </div>
            </div>
            <div className='w-full lg:w-1/3 h-fit my-6 lg:my-10 md:pr-10 flex flex-col justify-center items-center md:items-start'>
                <span className='text-lg lg:text-xl w-full px-6'>Leave your email or phone, we will contact you</span>
                <form onSubmit={handleSubmit} className='flex flex-col gap-3 px-6 w-full mt-4'>
                    <div className='flex gap-3 w-full'>
                        <input 
                          className='py-3 px-4 rounded-[8px] bg-gray-900/70 border border-gray-800 w-full' 
                          type='email' 
                          name='email'
                          value={formData.email}
                          onChange={handleChange}
                          placeholder='Email Address' 
                        />
                        <input 
                          className='py-3 px-4 rounded-[8px] bg-gray-900/70 border border-gray-800 w-full' 
                          type='tel' 
                          name='phone'
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder='Phone (Optional)' 
                        />
                    </div>
                    <button 
                      type='submit' 
                      disabled={isSubmitting}
                      className='py-3 px-6 rounded-[8px] bg-[#F1F1F0] text-base text-[#1A1816] disabled:opacity-50'
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                    {submitMessage && (
                      <div className={`text-sm ${submitMessage.includes('success') ? 'text-green-500' : 'text-red-500'}`}>
                        {submitMessage}
                      </div>
                    )}
                </form>
            </div>
        </motion.div>
        <motion.div 
        initial={{opacity: 0, y: 50}}
        whileInView={{opacity: 1, y: 0}}
        delay={0.5}
        transition={{duration: 1}} 
        className='w-full lg:container mx-auto px-6 lg:px-10 py-10 flex flex-col md:flex-row justify-between items-center gap-8'>
        <img src='/dark_tranStacked_logo.png' alt='Thea Solutions' className='h-56 md:h-64 w-auto' />
            <div className='flex flex-col items-center gap-5 md:items-start'>
            <div className='w-fit gap-y-4 gap-x-6 text-lg flex justify-end opacity-70 flex-wrap'>
                {/* <Link href='/'>About</Link>
                <Link href='/'>Services</Link>
                {/* <Link href='/'>Pricing</Link> */}
                {/* <Link href='/'>Testimonials</Link> */}
                {/* <Link href='/'>FAQ</Link> */}
                {/* <Link href='/'>Blog</Link> */}
                {/* <Link href='/'>Contact</Link> */}
                <Link href="/#about">About</Link>
                <Link href="/#services">Services</Link>
                <Link href="/#faqs">FAQ</Link>
                <Link href="/#contact">Contact</Link>
                <Link href="/careers">Careers</Link>
            </div>
            <a href='mailto:business@theasolutions.co' className='flex items-center gap-2 opacity-70 transition-opacity hover:opacity-100'>
              <Mail size={18} aria-hidden='true' />
              business@theasolutions.co
            </a>
            </div>
            <div className='flex gap-4'>
                <Link href='https://www.linkedin.com/company/theasolutionss' target='_blank' rel='noopener noreferrer' className='hover:opacity-100 opacity-70 transition-opacity'>
                    <Linkedin size={24} />
                </Link>
                <Link href='https://www.tiktok.com/@theasolutions_?_r=1&_t=ZS-980MdkL0X9J' target='_blank' rel='noopener noreferrer' className='hover:opacity-100 opacity-70 transition-opacity'>
                    <TikTokIcon size={24} />
                </Link>
                <Link href='https://www.instagram.com/theasolutions_?igsh=ODc3ZmFrN2tkbDYw' target='_blank' rel='noopener noreferrer' className='hover:opacity-100 opacity-70 transition-opacity'>
                    <Instagram size={24} />
                </Link>
            </div>
        </motion.div>
    </div>
  )
}

export default Footer
