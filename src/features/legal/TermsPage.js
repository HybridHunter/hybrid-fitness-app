import React from 'react';
import { useNavigate } from 'react-router-dom';

const ACCENT = '#8fbf3b';
const DARK_BG = '#0a0e1a';
const WHITE = '#ffffff';
const GRAY = '#8892a4';
const DARK_TEXT = '#1a1d2e';
const LIGHT_BG = '#f7f8fc';

const sections = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing or using the GymKit platform ("Service"), including our website, web application, mobile applications, APIs, and related services, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Service.\n\nThese Terms constitute a legally binding agreement between you ("User," "you," or "your") and GymKit, LLC ("GymKit," "we," "us," or "our"). We reserve the right to modify these Terms at any time, and will notify you of material changes via email or in-app notification. Your continued use of the Service after such modifications constitutes acceptance of the updated Terms.`,
  },
  {
    title: '2. Account Registration',
    content: `To use the Service, you must register for an account by providing accurate and complete information, including your name, email address, gym or business name, and payment information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.\n\nYou must be at least 18 years of age to create an account. By registering, you represent and warrant that you have the authority to bind the business or organization you represent to these Terms. You agree to notify us immediately of any unauthorized use of your account or any other breach of security.\n\nWe reserve the right to suspend or terminate accounts that contain inaccurate information, violate these Terms, or are used for fraudulent purposes.`,
  },
  {
    title: '3. Subscription & Billing',
    content: `GymKit offers subscription-based access to the Service across multiple tiers (Starter, Professional, and Enterprise). Subscription fees are billed monthly in advance and are non-refundable except as expressly set forth herein.\n\nAll new accounts are eligible for a 14-day free trial of the Professional plan. No credit card is required to begin a free trial. At the conclusion of the trial period, you must select a paid plan and provide valid payment information to continue using the Service.\n\nPayment processing is handled by Stripe, Inc. By subscribing, you authorize us to charge your designated payment method on a recurring monthly basis. You are responsible for keeping your payment information current. Failed payments may result in suspension of access to the Service.\n\nYou may upgrade, downgrade, or cancel your subscription at any time through your account settings. Downgrades and cancellations take effect at the end of the current billing period. No prorated refunds are issued for partial months. If you cancel, you will retain access to the Service through the end of your paid billing period.\n\nWe reserve the right to modify pricing with 30 days' advance written notice. Price changes will not apply to the current billing period.`,
  },
  {
    title: '4. User Responsibilities',
    content: `You agree to use the Service only for lawful purposes and in accordance with these Terms. As a gym owner or operator using GymKit, you are responsible for:\n\n(a) Ensuring that all data you enter into the Service, including member information, workout programs, and billing details, is accurate and lawfully obtained.\n\n(b) Obtaining appropriate consent from your gym members before entering their personal information into the Service, including but not limited to names, email addresses, phone numbers, health information, body composition data, and payment details.\n\n(c) Complying with all applicable local, state, national, and international laws and regulations, including data protection and privacy laws.\n\n(d) Not using the Service to transmit any harmful, offensive, or illegal content, or to engage in any activity that could damage, disable, or impair the Service.\n\n(e) Not attempting to gain unauthorized access to any portion of the Service, other accounts, or any systems or networks connected to the Service.\n\n(f) Not reverse-engineering, decompiling, or disassembling any portion of the Service.`,
  },
  {
    title: '5. Intellectual Property',
    content: `The Service, including all software, design, text, graphics, interfaces, and underlying technology, is the exclusive property of GymKit, LLC and is protected by copyright, trademark, patent, and other intellectual property laws.\n\nYour subscription grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your internal business purposes during the term of your subscription. This license does not include the right to sublicense, resell, or redistribute the Service or any portion thereof.\n\nAll content you create or upload to the Service ("User Content"), including workout programs, exercise descriptions, member data, and community posts, remains your property. By uploading User Content, you grant GymKit a limited license to store, process, and display such content solely for the purpose of providing the Service to you.\n\nGymKit, the GymKit logo, Progression Engine, Coach's Session View, Station Mode, and all other product names and feature names are trademarks of GymKit, LLC You may not use our trademarks without prior written consent.`,
  },
  {
    title: '6. Data Privacy',
    content: `Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the Service, you acknowledge that you have read and understand our Privacy Policy.\n\nYou are responsible for ensuring that your use of the Service complies with all applicable data protection and privacy regulations, including the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA), as applicable to your jurisdiction and your gym members.\n\nWe implement commercially reasonable security measures to protect data stored within the Service. However, no method of electronic storage or transmission is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: '7. Limitation of Liability',
    content: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, HYBRID FITNESS, INC., ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE.\n\nIN NO EVENT SHALL OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE EXCEED THE TOTAL AMOUNT OF FEES PAID BY YOU TO HYBRID FITNESS DURING THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM.\n\nTHE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.`,
  },
  {
    title: '8. Termination',
    content: `You may terminate your account at any time by canceling your subscription through your account settings or by contacting our support team at support@gymkit.io.\n\nWe may suspend or terminate your account and access to the Service immediately, without prior notice or liability, if you breach any provision of these Terms, fail to pay applicable fees, or engage in conduct that we reasonably believe is harmful to other users, our business, or third parties.\n\nUpon termination, your right to use the Service will immediately cease. We will retain your data for 30 days following termination, during which time you may request an export of your data. After 30 days, we reserve the right to permanently delete all data associated with your account.\n\nTermination of your account does not relieve you of any obligations to pay fees incurred prior to termination.`,
  },
  {
    title: '9. Governing Law & Dispute Resolution',
    content: `These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions.\n\nAny dispute arising out of or relating to these Terms or the Service shall first be submitted to good-faith mediation. If mediation is unsuccessful, the dispute shall be resolved by binding arbitration administered by the American Arbitration Association (AAA) in accordance with its Commercial Arbitration Rules. The arbitration shall be conducted in Wilmington, Delaware.\n\nYou agree that any arbitration shall be conducted on an individual basis and not as a class, consolidated, or representative action. You waive any right to participate in a class action lawsuit or class-wide arbitration against GymKit.\n\nNotwithstanding the foregoing, either party may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent the actual or threatened infringement of intellectual property rights.`,
  },
  {
    title: '10. Contact',
    content: `If you have any questions about these Terms of Service, please contact us:\n\nGymKit, LLC\nEmail: legal@gymkit.io\nSupport: support@gymkit.io\nAddress: 1209 Orange Street, Wilmington, DE 19801, United States`,
  },
];

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: DARK_TEXT, margin: 0, padding: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ===== NAVBAR ===== */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 48px', background: DARK_BG, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{fontWeight:900,fontSize:24,letterSpacing:-1}}><span style={{color:"#8fbf3b"}}>Gym</span><span style={{color:WHITE}}>Kit</span></div>
        </div>
        <span onClick={() => navigate('/')} style={{ color: GRAY, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>&larr; Back to Home</span>
      </nav>

      {/* ===== CONTENT ===== */}
      <main style={{ flex: 1, background: WHITE, padding: '60px 24px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.8px', color: DARK_TEXT }}>Terms of Service</h1>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: '0 0 48px' }}>Last updated: April 1, 2026</p>

          <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.8, marginBottom: 40 }}>
            Welcome to GymKit. These Terms of Service govern your access to and use of the GymKit platform, including our website, applications, and services. Please read these Terms carefully before using the Service.
          </p>

          {sections.map((section, i) => (
            <div key={i} style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 16px', color: DARK_TEXT }}>{section.title}</h2>
              <div style={{ fontSize: 15, color: '#4b5563', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{section.content}</div>
            </div>
          ))}
        </div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer style={{ background: '#060914', padding: '32px 48px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{fontWeight:900,fontSize:18,letterSpacing:-1}}><span style={{color:"#8fbf3b"}}>Gym</span><span style={{color:WHITE}}>Kit</span></div>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <span onClick={() => navigate('/')} style={{ color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Home</span>
            <span onClick={() => navigate('/terms')} style={{ color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Terms</span>
            <span onClick={() => navigate('/privacy')} style={{ color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Privacy</span>
          </div>
          <span style={{ color: '#4b5563', fontSize: 13 }}>&copy; 2026 GymKit. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
