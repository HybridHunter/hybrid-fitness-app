import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ACCENT = '#8fbf3b';
const DARK_BG = '#0a0e1a';
const DARK_CARD = '#121829';
const LIGHT_BG = '#f7f8fc';
const WHITE = '#ffffff';
const GRAY = '#8892a4';
const DARK_TEXT = '#1a1d2e';

const features = [
  { icon: '🧬', title: 'Progression Engine', desc: 'Automatically individualize workouts for every client based on their movement assessment. One program, personalized for everyone.' },
  { icon: '🎛️', title: 'Coach\'s Session View', desc: 'See every client\'s workout on one screen. Adjust progressions in real-time during sessions.' },
  { icon: '📱', title: 'Station Mode', desc: 'Set up iPad stations for each client. Their personalized workout displays automatically.' },
  { icon: '📅', title: 'Smart Scheduling', desc: 'Weekly calendar with session management, booking, waitlists, and workout template linking.' },
  { icon: '🔑', title: 'PIN Check-In', desc: 'Clients check in with their PIN. Automatically tracks attendance, streaks, and session usage.' },
  { icon: '💳', title: 'Billing & Payments', desc: 'Stripe-powered card and ACH payments. Recurring billing, saved payment methods, cash and check tracking.' },
  { icon: '🏆', title: 'Community & Challenges', desc: 'Skool-style community feed with challenges, courses, events, and resources.' },
  { icon: '📲', title: 'Client Mobile App', desc: 'Beautiful mobile portal where clients view workouts, book sessions, track progress, and check in.' },
  { icon: '📊', title: 'Analytics Dashboard', desc: 'Revenue, attendance, utilization, member engagement — all the metrics you need to grow.' },
  { icon: '🏋️', title: 'Body Composition', desc: 'InBody integration for tracking body fat, muscle mass, and progress over time.' },
];

const plans = [
  {
    name: 'Starter',
    price: 99,
    popular: false,
    features: ['Up to 50 clients', '1 location', 'Core features', 'Email support', 'Progression Engine', 'Smart Scheduling', 'PIN Check-In'],
  },
  {
    name: 'Professional',
    price: 199,
    popular: true,
    features: ['Up to 200 clients', '3 locations', 'All features', 'Priority support', 'White-label branding', 'Community & Challenges', 'Analytics Dashboard', 'Client Mobile App'],
  },
  {
    name: 'Enterprise',
    price: 399,
    popular: false,
    features: ['Unlimited clients', 'Unlimited locations', 'All features', 'Dedicated support', 'Custom integrations', 'API access', 'Body Composition', 'White-label branding'],
  },
];

const testimonials = [
  { quote: 'GymKit completely transformed how we run our semi-private training. Our coaches save 5+ hours a week on programming, and our clients love seeing their individualized workouts on the iPads.', name: 'Sarah Mitchell', title: 'Owner', gym: 'Elevate Performance', initials: 'SM', color: '#4a6cf7' },
  { quote: 'We switched from three different tools to just GymKit. Scheduling, billing, and programming all in one place. Our retention rate jumped 30% in the first three months.', name: 'Marcus Johnson', title: 'Head Coach', gym: 'Iron Tribe Athletics', initials: 'MJ', color: ACCENT },
  { quote: 'The Progression Engine is a game-changer. I can write one program and it automatically adjusts for each client\'s movement limitations. My clients are getting better results with fewer injuries.', name: 'Rachel Torres', title: 'Owner & Coach', gym: 'Foundation Fitness', initials: 'RT', color: '#e74c8b' },
];

const faqs = [
  { q: 'How does the 14-day free trial work?', a: 'Sign up with your email and start using GymKit immediately — no credit card required. You get full access to all Professional plan features for 14 days. At the end of your trial, choose the plan that fits your gym and enter your payment info to continue.' },
  { q: 'Can I import my existing clients?', a: 'Yes! We support CSV imports for client data, and we can help migrate data from most popular gym management platforms. Our onboarding team will walk you through the process during setup.' },
  { q: 'Do I need special equipment?', a: 'No special equipment is required. GymKit works on any device with a web browser. For Station Mode, we recommend iPads, but any tablet works. The client mobile app works on all iOS and Android devices.' },
  { q: 'How does billing work for my clients?', a: 'GymKit integrates with Stripe for secure payment processing. You can set up recurring memberships, session packs, drop-in rates, and more. Clients can pay via credit card or ACH bank transfer. You can also track cash and check payments manually.' },
  { q: 'Can my clients use this on their phones?', a: 'Absolutely. Clients get access to a beautiful mobile portal where they can view their workouts, book sessions, track their progress, check in to sessions, and engage with your gym\'s community — all from their phone.' },
  { q: 'What if I need help setting up?', a: 'Every plan includes onboarding support. Professional and Enterprise plans include a dedicated onboarding specialist who will help you set up your exercises, sessions, templates, and member accounts. We also have a comprehensive knowledge base and video tutorials.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: WHITE, margin: 0, padding: 0, overflowX: 'hidden' }}>

      {/* ===== NAVBAR ===== */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 48px', background: 'rgba(10,14,26,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div style={{fontWeight:900,fontSize:24,letterSpacing:-1}}><span style={{color:"#8fbf3b"}}>Gym</span><span>Kit</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <span onClick={() => scrollTo('features')} style={{ cursor: 'pointer', fontSize: 14, color: GRAY, fontWeight: 500, transition: 'color 0.2s' }}>Features</span>
          <span onClick={() => scrollTo('pricing')} style={{ cursor: 'pointer', fontSize: 14, color: GRAY, fontWeight: 500 }}>Pricing</span>
          <button onClick={() => navigate('/login')} style={{ background: 'transparent', border: `1px solid rgba(255,255,255,0.15)`, color: WHITE, padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Login</button>
          <button onClick={() => navigate('/register')} style={{ background: ACCENT, border: 'none', color: WHITE, padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Start Free Trial</button>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '140px 24px 80px', background: `linear-gradient(180deg, ${DARK_BG} 0%, #060914 100%)`, position: 'relative', overflow: 'hidden' }}>
        {/* Background decorations */}
        <div style={{ position: 'absolute', top: '10%', left: '10%', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, rgba(143,191,59,0.08) 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,108,247,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <h1 style={{ fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 800, lineHeight: 1.1, maxWidth: 800, margin: '0 0 24px', letterSpacing: '-1.5px', background: `linear-gradient(135deg, ${WHITE} 0%, rgba(255,255,255,0.75) 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          The All-In-One Platform for Semi-Private & Group Training
        </h1>
        <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: GRAY, maxWidth: 640, margin: '0 0 40px', lineHeight: 1.6 }}>
          Workout programming, client individualization, scheduling, billing, community — everything your gym needs in one place.
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => navigate('/register')} style={{ background: ACCENT, border: 'none', color: WHITE, padding: '16px 36px', borderRadius: 12, fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 24px rgba(143,191,59,0.3)`, transition: 'transform 0.2s' }}>
            Start 14-Day Free Trial
          </button>
          <button style={{ background: 'transparent', border: `2px solid rgba(255,255,255,0.2)`, color: WHITE, padding: '16px 36px', borderRadius: 12, fontSize: 17, fontWeight: 700, cursor: 'pointer', transition: 'border-color 0.2s' }}>
            Watch Demo
          </button>
        </div>

        {/* Hero mockup */}
        <div style={{ marginTop: 64, width: '100%', maxWidth: 900, height: 420, borderRadius: 20, background: `linear-gradient(135deg, ${DARK_CARD} 0%, #1a2240 100%)`, border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 64px rgba(0,0,0,0.4)' }}>
          <div style={{ height: 40, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '200px 1fr 260px', gap: 1, padding: 1 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20 }}>
              <div style={{ width: '80%', height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 16 }} />
              {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{ width: `${60 + Math.random()*30}%`, height: 8, background: i === 2 ? `rgba(143,191,59,0.3)` : 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 12 }} />
              ))}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ height: 80, borderRadius: 10, background: i === 1 ? `rgba(143,191,59,0.12)` : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
                ))}
              </div>
              <div style={{ marginTop: 16, height: 140, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }} />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20 }}>
              <div style={{ width: '60%', height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 20 }} />
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.03)', marginBottom: 10, border: '1px solid rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SOCIAL PROOF BAR ===== */}
      <section style={{ background: DARK_CARD, borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: ACCENT }}>100+</span>
          <span style={{ fontSize: 14, color: GRAY }}>Gyms Trust<br/>GymKit</span>
        </div>
        <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {[1,2,3,4,5].map(i => (
              <span key={i} style={{ color: '#fbbf24', fontSize: 18 }}>&#9733;</span>
            ))}
          </div>
          <span style={{ fontSize: 14, color: GRAY }}>4.9/5 from gym owners</span>
        </div>
        <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: WHITE }}>10k+</span>
          <span style={{ fontSize: 14, color: GRAY }}>Clients Managed<br/>Every Day</span>
        </div>
      </section>

      {/* ===== FEATURES GRID ===== */}
      <section id="features" style={{ background: DARK_BG, padding: '100px 48px', textAlign: 'center' }}>
        <span style={{ color: ACCENT, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 2 }}>Features</span>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: '12px 0 16px', letterSpacing: '-0.8px' }}>Everything You Need to Run Your Gym</h2>
        <p style={{ color: GRAY, fontSize: 18, maxWidth: 600, margin: '0 auto 60px' }}>Built specifically for semi-private and group training facilities. No more duct-taping tools together.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: DARK_CARD, borderRadius: 16, padding: '36px 28px', textAlign: 'left', border: '1px solid rgba(255,255,255,0.06)', transition: 'border-color 0.3s, transform 0.3s', cursor: 'default' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px', color: WHITE }}>{f.title}</h3>
              <p style={{ fontSize: 15, color: GRAY, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section style={{ background: '#0d1120', padding: '100px 48px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ color: ACCENT, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 2 }}>How It Works</span>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: '12px 0 60px', letterSpacing: '-0.8px' }}>Up and Running in Minutes</h2>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap', maxWidth: 960, margin: '0 auto' }}>
          {[
            { step: '1', title: 'Sign Up', desc: 'Create your gym account in 2 minutes. No credit card required.' },
            { step: '2', title: 'Set Up', desc: 'Add your exercises, sessions, and clients. Import from your current system.' },
            { step: '3', title: 'Train', desc: 'Start running sessions with individualized programming for every client.' },
          ].map((s, i) => (
            <div key={i} style={{ flex: '1 1 260px', maxWidth: 280, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: `linear-gradient(135deg, rgba(143,191,59,0.2), rgba(143,191,59,0.05))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: ACCENT, margin: '0 auto 20px', border: `1px solid rgba(143,191,59,0.2)` }}>{s.step}</div>
              <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>{s.title}</h3>
              <p style={{ fontSize: 15, color: GRAY, lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" style={{ background: LIGHT_BG, padding: '100px 48px', textAlign: 'center' }}>
        <span style={{ color: ACCENT, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 2 }}>Pricing</span>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: '12px 0 8px', letterSpacing: '-0.8px', color: DARK_TEXT }}>Simple, Transparent Pricing</h2>
        <p style={{ color: '#6b7280', fontSize: 18, margin: '0 0 16px' }}>14-day free trial. No setup fees. Cancel anytime.</p>
        <p style={{ color: '#9ca3af', fontSize: 14, margin: '0 0 60px' }}>All prices in USD. Billed monthly.</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 28, flexWrap: 'wrap', maxWidth: 1060, margin: '0 auto' }}>
          {plans.map((plan, i) => (
            <div key={i} style={{ flex: '1 1 300px', maxWidth: 330, background: WHITE, borderRadius: 20, padding: '40px 32px', textAlign: 'left', position: 'relative', border: plan.popular ? `2px solid ${ACCENT}` : '1px solid #e5e7eb', boxShadow: plan.popular ? `0 8px 40px rgba(143,191,59,0.15)` : '0 2px 12px rgba(0,0,0,0.04)', transform: plan.popular ? 'scale(1.04)' : 'none' }}>
              {plan.popular && (
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: ACCENT, color: WHITE, fontSize: 12, fontWeight: 700, padding: '4px 16px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 1 }}>Most Popular</div>
              )}
              <h3 style={{ fontSize: 20, fontWeight: 700, color: DARK_TEXT, margin: '0 0 8px' }}>{plan.name}</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 24 }}>
                <span style={{ fontSize: 48, fontWeight: 800, color: DARK_TEXT }}>${plan.price}</span>
                <span style={{ fontSize: 16, color: '#9ca3af' }}>/mo</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px' }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 15, color: '#4b5563' }}>
                    <span style={{ color: ACCENT, fontSize: 18, fontWeight: 700 }}>&#10003;</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/register')} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: plan.popular ? 'none' : `2px solid ${ACCENT}`, background: plan.popular ? ACCENT : 'transparent', color: plan.popular ? WHITE : ACCENT, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                Start Free Trial
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section style={{ background: WHITE, padding: '100px 48px', textAlign: 'center' }}>
        <span style={{ color: ACCENT, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 2 }}>Testimonials</span>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: '12px 0 60px', letterSpacing: '-0.8px', color: DARK_TEXT }}>Loved by Gym Owners</h2>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 28, flexWrap: 'wrap', maxWidth: 1060, margin: '0 auto' }}>
          {testimonials.map((t, i) => (
            <div key={i} style={{ flex: '1 1 300px', maxWidth: 330, background: LIGHT_BG, borderRadius: 20, padding: '36px 28px', textAlign: 'left', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
                {[1,2,3,4,5].map(j => (
                  <span key={j} style={{ color: '#fbbf24', fontSize: 16 }}>&#9733;</span>
                ))}
              </div>
              <p style={{ fontSize: 15, color: '#4b5563', lineHeight: 1.7, margin: '0 0 24px', fontStyle: 'italic' }}>"{t.quote}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: WHITE }}>{t.initials}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: DARK_TEXT }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>{t.title}, {t.gym}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section style={{ background: LIGHT_BG, padding: '100px 48px', textAlign: 'center' }}>
        <span style={{ color: ACCENT, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 2 }}>FAQ</span>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: '12px 0 60px', letterSpacing: '-0.8px', color: DARK_TEXT }}>Frequently Asked Questions</h2>

        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'left' }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{ background: WHITE, borderRadius: 14, marginBottom: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: DARK_TEXT, textAlign: 'left' }}
              >
                {faq.q}
                <span style={{ fontSize: 22, color: GRAY, transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginLeft: 16 }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 24px 20px', fontSize: 15, color: '#6b7280', lineHeight: 1.7 }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA BANNER ===== */}
      <section style={{ background: `linear-gradient(135deg, ${DARK_BG} 0%, #111833 100%)`, padding: '80px 48px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: '0 0 16px', color: WHITE }}>Ready to Transform Your Gym?</h2>
        <p style={{ color: GRAY, fontSize: 18, margin: '0 0 36px' }}>Join 100+ gym owners who switched to GymKit.</p>
        <button onClick={() => navigate('/register')} style={{ background: ACCENT, border: 'none', color: WHITE, padding: '16px 40px', borderRadius: 12, fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 24px rgba(143,191,59,0.3)` }}>
          Start Your Free Trial
        </button>
      </section>

      {/* ===== FOOTER ===== */}
      <footer style={{ background: '#060914', padding: '48px 48px 32px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 32, maxWidth: 1100, margin: '0 auto' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{fontWeight:900,fontSize:24,letterSpacing:-1}}><span style={{color:"#8fbf3b"}}>Gym</span><span>Kit</span></div>
            </div>
            <p style={{ color: GRAY, fontSize: 13, maxWidth: 280, lineHeight: 1.6 }}>The all-in-one platform for semi-private and group training facilities.</p>
          </div>
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: GRAY, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Product</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span onClick={() => scrollTo('features')} style={{ color: '#6b7280', fontSize: 14, cursor: 'pointer' }}>Features</span>
                <span onClick={() => scrollTo('pricing')} style={{ color: '#6b7280', fontSize: 14, cursor: 'pointer' }}>Pricing</span>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: GRAY, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Account</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span onClick={() => navigate('/login')} style={{ color: '#6b7280', fontSize: 14, cursor: 'pointer' }}>Login</span>
                <span onClick={() => navigate('/register')} style={{ color: '#6b7280', fontSize: 14, cursor: 'pointer' }}>Sign Up</span>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: GRAY, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Legal</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span onClick={() => navigate('/terms')} style={{ color: '#6b7280', fontSize: 14, cursor: 'pointer' }}>Terms of Service</span>
                <span onClick={() => navigate('/privacy')} style={{ color: '#6b7280', fontSize: 14, cursor: 'pointer' }}>Privacy Policy</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1100, margin: '40px auto 0', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ color: '#4b5563', fontSize: 13 }}>&copy; 2026 GymKit. All rights reserved.</span>
          <div style={{ display: 'flex', gap: 16 }}>
            {['X', 'in', 'ig', 'yt'].map((icon, i) => (
              <div key={i} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: GRAY, cursor: 'pointer', fontWeight: 600 }}>{icon}</div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
