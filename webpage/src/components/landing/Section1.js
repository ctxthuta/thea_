import React, { useState } from 'react'
// import {bgVideo} from '@/assets/videos/LandingBG.webm';

function Section1() {
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
    <div id="about" className='min-h-screen relative bg-gradient-to-b from-transparent via-black/80 to-black'>
        <video className='w-full h-full object-cover absolute -z-[1] brightness-125' autoPlay loop muted>
            <source src='./assets/videos/LandingBG.webm' type='video/webm' />
        </video>
        <div className='w-full h-[92vh] md:h-screen lg:container mx-auto lg:px-10 flex flex-col md:flex-row items-end justify-end lg:justify-between'> 
            <div className='w-full lg:w-2/3 h-fit lg:my-10 flex flex-col justify-center lg:justify-start items-center lg:items-start'>
                <div className='text-3xl lg:text-6xl w-full md:w-4/5 px-6 lg:px-0 lg:![line-height:80px]'>
                    Bridge the gap between complex technology and your growing business
                </div>
                <span className='mt-4 text-base lg:text-lg w-full md:w-4/5 px-6 lg:px-0 text-gray-400'>
                At Thea Solutions, we specialize in bespoke software development, enterprise-grade AI, and automation solutions engineered specifically for SMEs to streamline operations and scale with confidence.
                </span>
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
        </div>
    </div>
  )
}

export default Section1