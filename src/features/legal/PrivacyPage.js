import React from 'react';
import { useNavigate } from 'react-router-dom';

const ACCENT = '#8fbf3b';
const DARK_BG = '#0a0e1a';
const WHITE = '#ffffff';
const GRAY = '#8892a4';
const DARK_TEXT = '#1a1d2e';

const sections = [
  {
    title: '1. Information We Collect',
    content: `We collect information that you provide directly to us, information collected automatically through your use of the Service, and information from third-party sources.

**Information You Provide:**
- Account registration information: name, email address, phone number, business name, and billing address.
- Gym member data that you input into the Service: member names, email addresses, phone numbers, emergency contacts, health questionnaire responses, movement assessment data, body composition measurements, and profile photos.
- Payment information: credit card numbers, bank account details for ACH payments, and billing addresses. Payment information is processed and stored by our payment processor, Stripe, Inc., and is not stored on our servers.
- Workout and programming data: exercise libraries, workout templates, client workout logs, progression notes, and session attendance records.
- Community content: posts, comments, messages, files, and other content shared within the community features.
- Communications: emails, support requests, and feedback you send to us.

**Information Collected Automatically:**
- Device and browser information: IP address, browser type and version, operating system, device identifiers, and screen resolution.
- Usage data: pages visited, features used, clicks, session duration, and navigation patterns.
- Log data: server logs, error reports, and performance metrics.
- Location data: approximate geographic location based on IP address.`,
  },
  {
    title: '2. How We Use Information',
    content: `We use the information we collect for the following purposes:

- **Providing the Service:** To operate, maintain, and improve the GymKit platform, including workout programming, scheduling, billing, attendance tracking, and community features.
- **Account Management:** To create and manage your account, authenticate your identity, and process your subscription payments.
- **Member Management:** To enable you to manage your gym members' accounts, track their workouts, attendance, and progress, and facilitate communication between you and your members.
- **Billing and Payments:** To process subscription payments, member billing through your gym, and to detect and prevent fraudulent transactions.
- **Communication:** To send you service-related notifications, updates, security alerts, and support messages. To send marketing communications where you have opted in (you may opt out at any time).
- **Analytics and Improvement:** To analyze usage patterns, monitor performance, and improve the Service's features, functionality, and user experience.
- **Security:** To detect, investigate, and prevent security incidents, fraud, and abuse of the Service.
- **Legal Compliance:** To comply with applicable laws, regulations, legal processes, and governmental requests.`,
  },
  {
    title: '3. Data Storage & Security',
    content: `Your data is stored on secure servers managed by Supabase, Inc., our database and backend infrastructure provider. Supabase hosts data on Amazon Web Services (AWS) infrastructure in the United States.

We implement commercially reasonable technical and organizational security measures to protect your data, including:

- Encryption of data in transit using TLS 1.2 or higher.
- Encryption of sensitive data at rest using AES-256 encryption.
- Row-level security policies enforced at the database level to ensure data isolation between gym accounts.
- Regular security audits and vulnerability assessments.
- Access controls limiting employee access to customer data to authorized personnel only, on a need-to-know basis.
- Automated backups and disaster recovery procedures.
- Multi-factor authentication available for all accounts.

While we strive to protect your data, no method of electronic transmission or storage is completely secure. We cannot guarantee absolute security and are not responsible for unauthorized access resulting from factors beyond our reasonable control.`,
  },
  {
    title: '4. Third-Party Services',
    content: `We integrate with and share data with the following third-party services to provide the Service:

**Stripe, Inc.** — Payment processing. When you or your gym members provide payment information, it is transmitted directly to and stored by Stripe in accordance with their PCI-DSS compliant security standards. We do not store full credit card numbers or bank account details on our servers. Stripe's privacy policy: https://stripe.com/privacy

**Supabase, Inc.** — Database hosting, authentication, and backend infrastructure. Your account data, member data, workout data, and all application data is stored in Supabase-managed PostgreSQL databases. Supabase's privacy policy: https://supabase.com/privacy

**Amazon Web Services (AWS)** — Cloud infrastructure underlying our Supabase hosting. AWS's privacy policy: https://aws.amazon.com/privacy/

**Vercel / Netlify** — Web application hosting and content delivery. These services may process request logs including IP addresses. See their respective privacy policies for details.

**SendGrid / Resend** — Transactional email delivery for account notifications, password resets, and billing receipts.

We require all third-party service providers to maintain appropriate security measures and to process personal data only in accordance with our instructions and applicable data protection laws.`,
  },
  {
    title: '5. Data Retention',
    content: `We retain your data for as long as your account is active or as needed to provide the Service.

- **Active accounts:** All data is retained for the duration of your subscription.
- **Canceled accounts:** Upon cancellation or termination, we retain your data for 30 days to allow for account reactivation or data export. After 30 days, we initiate deletion of your data from our active systems.
- **Backups:** Data may persist in encrypted backups for up to 90 days following deletion from active systems, after which backups are rotated and overwritten.
- **Billing records:** We retain billing and transaction records for a minimum of 7 years as required by applicable tax and financial regulations.
- **Aggregated data:** We may retain anonymized, aggregated data indefinitely for analytics and product improvement purposes. This data cannot be used to identify any individual.

You may request deletion of your data at any time by contacting us at privacy@gymkit.io. We will process deletion requests within 30 days, subject to any legal retention obligations.`,
  },
  {
    title: '6. Your Rights',
    content: `Depending on your jurisdiction, you may have the following rights regarding your personal data:

**For All Users:**
- **Access:** You may request a copy of the personal data we hold about you.
- **Correction:** You may request that we correct inaccurate or incomplete personal data.
- **Deletion:** You may request that we delete your personal data, subject to certain legal exceptions.
- **Data Export:** You may request an export of your data in a commonly used, machine-readable format.
- **Opt-Out:** You may opt out of marketing communications at any time by clicking the "unsubscribe" link in any marketing email or updating your notification preferences in your account settings.

**For EEA/UK Residents (GDPR):**
In addition to the rights above, you have the right to:
- Restrict processing of your personal data.
- Object to processing based on legitimate interests.
- Data portability.
- Lodge a complaint with your local data protection authority.
- Withdraw consent at any time, where processing is based on consent.

Our legal basis for processing personal data under the GDPR includes: performance of a contract (providing the Service), legitimate interests (improving the Service, security), consent (marketing communications), and legal obligations.

**For California Residents (CCPA/CPRA):**
You have the right to:
- Know what personal information we collect, use, and disclose.
- Request deletion of your personal information.
- Opt out of the sale or sharing of personal information. Note: We do not sell personal information.
- Non-discrimination for exercising your privacy rights.

To exercise any of these rights, please contact us at privacy@gymkit.io. We will verify your identity before processing your request and respond within the time periods required by applicable law.`,
  },
  {
    title: '7. Cookies & Tracking Technologies',
    content: `We use cookies and similar tracking technologies to operate and improve the Service.

**Essential Cookies:** Required for the Service to function, including authentication tokens, session management, and security features. These cookies cannot be disabled.

**Analytics Cookies:** Used to collect information about how you use the Service, including pages visited, features used, and performance data. This helps us improve the Service. You may opt out of analytics cookies through your browser settings or our cookie preference center.

**Preference Cookies:** Used to remember your settings and preferences, such as language, theme, and display options.

We do not use advertising or third-party tracking cookies. We do not engage in cross-site tracking or retargeting.

Most web browsers allow you to manage cookie preferences through browser settings. Please note that disabling essential cookies may impair the functionality of the Service.`,
  },
  {
    title: '8. Children\'s Privacy',
    content: `The GymKit Service is not directed to children under the age of 16, and we do not knowingly collect personal information from children under 16. If you are a gym owner, you represent and warrant that you will not input personal data of any individual under the age of 16 into the Service without verifiable parental or guardian consent, in compliance with the Children's Online Privacy Protection Act (COPPA) and applicable international laws.

If we become aware that we have collected personal data from a child under 16 without appropriate consent, we will take steps to delete that information promptly. If you believe that a child under 16 has provided personal data to us, please contact us at privacy@gymkit.io.`,
  },
  {
    title: '9. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors.

When we make material changes to this Privacy Policy, we will:
- Post the updated policy on our website with a revised "Last Updated" date.
- Notify you via email or in-app notification at least 14 days before the changes take effect.
- Where required by law, obtain your consent to material changes.

We encourage you to review this Privacy Policy periodically. Your continued use of the Service after the effective date of any changes constitutes your acceptance of the updated Privacy Policy.

Previous versions of this Privacy Policy are available upon request.`,
  },
  {
    title: '10. Contact Us',
    content: `If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

GymKit, LLC
Privacy Team
Email: privacy@gymkit.io
Support: support@gymkit.io
Address: 1209 Orange Street, Wilmington, DE 19801, United States

For GDPR-related inquiries, you may also contact our Data Protection Officer at dpo@gymkit.io.

If you are not satisfied with our response, you have the right to lodge a complaint with your local data protection supervisory authority.`,
  },
];

export default function PrivacyPage() {
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
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.8px', color: DARK_TEXT }}>Privacy Policy</h1>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: '0 0 48px' }}>Last updated: April 1, 2026</p>

          <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.8, marginBottom: 40 }}>
            At GymKit, we take your privacy seriously. This Privacy Policy describes how GymKit, LLC ("GymKit," "we," "us," or "our") collects, uses, stores, and protects information when you use our gym management platform and related services (the "Service"). This policy applies to gym owners, their staff, and gym members whose data is managed through the Service.
          </p>

          {sections.map((section, i) => (
            <div key={i} style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 16px', color: DARK_TEXT }}>{section.title}</h2>
              <div style={{ fontSize: 15, color: '#4b5563', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                {section.content.split(/\*\*(.*?)\*\*/g).map((part, j) =>
                  j % 2 === 1
                    ? <strong key={j} style={{ color: DARK_TEXT }}>{part}</strong>
                    : <span key={j}>{part}</span>
                )}
              </div>
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
