import { useState, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import Card from "../../components/ui/Card";

/* ==================== ARTICLE DATA ==================== */
const CATEGORIES = [
  { id: "getting-started", label: "Getting Started", icon: "\uD83D\uDE80" },
  { id: "workouts", label: "Workouts", icon: "\uD83C\uDFCB\uFE0F" },
  { id: "clients", label: "Clients", icon: "\uD83D\uDC65" },
  { id: "scheduling", label: "Scheduling", icon: "\uD83D\uDCC5" },
  { id: "billing", label: "Billing", icon: "\uD83D\uDCB3" },
  { id: "community", label: "Community", icon: "\uD83D\uDCAC" },
  { id: "settings", label: "Settings", icon: "\u2699\uFE0F" },
];

const ARTICLES = [
  // Getting Started
  {
    id: "quick-start",
    category: "getting-started",
    title: "Quick Start Guide",
    content: `Welcome to GymKit! This guide will get you up and running in minutes.\n\nFirst, make sure you've completed the setup wizard to configure your gym's basic information, branding, and timezone. Once that's done, you'll want to add your first clients and create your first workout templates.\n\nThe main workflow is: create workout templates in the Build section, add your clients in the Clients section, assign workouts to clients, and then use Session View to coach live sessions. From there, explore billing, scheduling, and community features at your own pace.`,
    related: ["setting-up-gym", "adding-first-client", "creating-first-workout"],
  },
  {
    id: "setting-up-gym",
    category: "getting-started",
    title: "Setting Up Your Gym",
    content: `Setting up your gym in GymKit involves a few key steps to make the platform your own.\n\nStart in Settings > Branding to upload your logo, set your primary and secondary colors, and add your gym tagline. These will be reflected across the client portal and any public-facing pages. Next, configure your business hours, timezone, and contact information in Settings > General.\n\nOnce your branding is in place, set up your first session schedule and create a couple of workout templates. When you're ready to go live, add your clients and start assigning workouts. The platform is designed to grow with you, so don't worry about getting everything perfect on day one.`,
    related: ["quick-start", "branding", "creating-sessions"],
  },
  {
    id: "adding-first-client",
    category: "getting-started",
    title: "Adding Your First Client",
    content: `Adding clients to GymKit is straightforward and flexible.\n\nNavigate to the Clients section from the sidebar and click "Add Client." Fill in their name, email, phone number, and any relevant details. You can also set their membership status and assign them to sessions right away.\n\nOnce a client is added, they'll receive an invite to the client portal where they can view their workouts, track progress, and book sessions. You can manage all client details from their profile page, including assessments, progress photos, and billing history.`,
    related: ["managing-clients", "client-portal", "quick-start"],
  },
  {
    id: "creating-first-workout",
    category: "getting-started",
    title: "Creating Your First Workout",
    content: `Building workouts in GymKit uses a flexible sections-and-slots system.\n\nGo to Build from the sidebar to open the workout builder. Start by naming your workout and adding sections (like "Warm-Up," "Strength," "Conditioning"). Within each section, add exercise slots and configure sets, reps, weight, and rest periods.\n\nYou can search the exercise library to find movements, or add custom exercises. Once your workout is complete, save it as a template. Templates can be assigned to individual clients or used in programs that span multiple weeks. The progression engine will automatically adjust difficulty based on client performance.`,
    related: ["building-workout", "progression-engine", "quick-start"],
  },

  // Workouts
  {
    id: "building-workout",
    category: "workouts",
    title: "Building a Workout",
    content: `The workout builder is the heart of GymKit's coaching tools.\n\nEach workout is organized into sections (e.g., "Warm-Up," "Main Lift," "Accessory Work," "Finisher"). Sections contain exercise slots where you define the movement, sets, reps, weight, tempo, and rest. You can drag sections and slots to reorder them.\n\nFor group training, you can create stations within sections so multiple clients rotate through different exercises. Save your workout as a template to reuse it, or assign it directly to specific clients. The builder supports supersets, circuits, and EMOM-style formats through flexible slot grouping.`,
    related: ["progression-engine", "session-view-article", "station-mode"],
  },
  {
    id: "progression-engine",
    category: "workouts",
    title: "Progression Engine",
    content: `GymKit's Progression Engine (also called the Movement Matrix) automatically adjusts workout difficulty based on client performance.\n\nEach exercise has multiple progression levels. When a client successfully completes their prescribed sets and reps at a given weight, the engine can automatically bump them to the next level for their next session. This means you can write one workout template and have it individualized for every client.\n\nConfigure progression rules in the Progression Engine section. You can set thresholds for advancement, define level-specific parameters, and override auto-progressions for any client at any time.`,
    related: ["building-workout", "session-view-article", "managing-clients"],
  },
  {
    id: "session-view-article",
    category: "workouts",
    title: "Session View",
    content: `Session View is your live coaching dashboard during training sessions.\n\nIt displays all clients in the current session with their individualized workouts side by side. You can see each client's exercises, weights, sets completed, and notes in real time. Clients can log their own results from their phones or the station tablets.\n\nUse Session View to quickly adjust weights, swap exercises, or add notes for specific clients during the session. It's designed to give you a bird's-eye view of your entire class while still being able to drill into individual client details.`,
    related: ["building-workout", "station-mode", "check-in-system"],
  },
  {
    id: "station-mode",
    category: "workouts",
    title: "Station Mode",
    content: `Station Mode lets you set up dedicated tablets or devices at each training station in your gym.\n\nEach station displays the exercises assigned to that position, and clients can see their individualized weights and reps when they arrive at a station. This is perfect for circuit-style training where clients rotate through stations.\n\nTo set up stations, go to the Stations section. Create station profiles, assign them to positions in your gym, and link them to session workouts. Clients check in and the station automatically shows their personalized workout for that position.`,
    related: ["session-view-article", "building-workout", "check-in-system"],
  },
  {
    id: "remote-workouts",
    category: "workouts",
    title: "Remote Workouts",
    content: `Remote Workouts allow you to assign training for clients who can't make it to the gym.\n\nCreate travel or at-home workout templates using bodyweight exercises or equipment the client has access to. Assign these directly to clients from their profile or the Remote Workouts section.\n\nClients will see their remote workouts in the client portal and can log their results just like they would in-gym. You'll be able to review their performance and adjust future programming accordingly. This is great for keeping clients engaged during vacations, business trips, or hybrid training schedules.`,
    related: ["building-workout", "client-portal", "managing-clients"],
  },

  // Clients
  {
    id: "managing-clients",
    category: "clients",
    title: "Managing Clients",
    content: `The Clients section is your central hub for managing everyone in your gym.\n\nFrom here you can add new clients, edit their profiles, change their membership status (active, paused, cancelled), and view their complete history. Each client profile shows their assigned workouts, session attendance, billing status, assessments, and progress photos.\n\nUse the search and filter tools to quickly find clients. You can filter by status, session assignment, or membership plan. Bulk actions let you send messages, update statuses, or export data for groups of clients at once.`,
    related: ["adding-first-client", "client-portal", "progress-photos"],
  },
  {
    id: "movement-assessments",
    category: "clients",
    title: "Movement Assessments",
    content: `Movement assessments help you evaluate and track client mobility, stability, and movement quality over time.\n\nGymKit includes a built-in assessment framework where you can score clients on various movement patterns. Record scores, add notes, and track improvement across re-assessments. Results can inform exercise selection and progression decisions.\n\nAssessments are accessible from each client's profile or the dedicated Assessments section. Schedule regular re-assessments to monitor progress and adjust programming. Assessment data integrates with the progression engine to help guide exercise selection.`,
    related: ["managing-clients", "progression-engine", "adding-first-client"],
  },
  {
    id: "client-portal",
    category: "clients",
    title: "Client Portal",
    content: `The Client Portal is a mobile-friendly interface where your clients can manage their gym experience.\n\nClients can log in to view their upcoming workouts, book sessions, track their workout history, see progress photos, and interact with the community feed. The portal is branded with your gym's logo and colors for a professional experience.\n\nClients access the portal by logging in with the credentials you set up when adding them. They can view today's workout, log results during a session, and review past performance. The portal also shows their membership status, upcoming bookings, and any messages from coaches.`,
    related: ["managing-clients", "adding-first-client", "progress-photos"],
  },
  {
    id: "progress-photos",
    category: "clients",
    title: "Progress Photos",
    content: `Progress photos help clients visualize their transformation over time.\n\nCoaches can upload photos from a client's profile page. Organize photos by date and add notes for context. Clients can also upload their own photos through the client portal. A side-by-side comparison view makes it easy to see changes over weeks and months.\n\nProgress photos are private by default and only visible to the client and their coaches. Clients can optionally share photos to the community feed to celebrate milestones and inspire others.`,
    related: ["managing-clients", "client-portal", "community-feed"],
  },

  // Scheduling
  {
    id: "creating-sessions",
    category: "scheduling",
    title: "Creating Sessions",
    content: `Sessions are the backbone of your gym's schedule.\n\nIn the Schedule section, create recurring sessions by setting the day, time, duration, capacity, and assigned coach. You can create different session types (e.g., "Morning Group," "Open Gym," "Personal Training") and color-code them for easy identification.\n\nSessions can be linked to specific workout templates so clients automatically see their assigned workout when they check in. You can also set up session series that repeat weekly, and manage exceptions for holidays or special events.`,
    related: ["booking-waitlists", "check-in-system", "setting-up-gym"],
  },
  {
    id: "booking-waitlists",
    category: "scheduling",
    title: "Booking & Waitlists",
    content: `GymKit's booking system lets clients reserve their spot in sessions ahead of time.\n\nWhen a session has capacity limits, clients can book through the client portal. If a session is full, they're automatically added to a waitlist and notified if a spot opens up. You can configure booking windows (e.g., bookings open 7 days in advance) and cancellation policies.\n\nAs an admin, you can manually add or remove clients from sessions, override capacity limits, and manage the waitlist order. The dashboard shows you upcoming session capacity at a glance so you can plan accordingly.`,
    related: ["creating-sessions", "check-in-system", "client-portal"],
  },
  {
    id: "check-in-system",
    category: "scheduling",
    title: "Check-In System",
    content: `The check-in system tracks client attendance with a simple PIN pad interface.\n\nSet up a tablet or device at your gym entrance running the check-in view. Clients enter their PIN to check in, which logs their attendance, triggers their workout for the session, and updates the Session View. You can also manually check in clients from the admin side.\n\nCheck-in data feeds into analytics, attendance streaks, and gamification points. You can view attendance reports by session, client, or date range to identify trends and follow up with clients who haven't been showing up.`,
    related: ["creating-sessions", "session-view-article", "station-mode"],
  },

  // Billing
  {
    id: "membership-plans",
    category: "billing",
    title: "Membership Plans",
    content: `Create and manage membership plans that fit your gym's pricing model.\n\nIn the Billing section, set up plans with names, prices, billing frequencies (weekly, monthly, annually), and included sessions. You can create unlimited plans for different membership tiers, like "Basic," "Unlimited," and "Personal Training."\n\nPlans can include session credits, access to specific features, and automatic billing through Stripe. Assign plans to clients from their profile or during the sign-up process. You can modify plans at any time, and changes can be applied to existing subscribers or only new ones.`,
    related: ["processing-payments", "payment-discounts", "integrations"],
  },
  {
    id: "processing-payments",
    category: "billing",
    title: "Processing Payments",
    content: `GymKit supports multiple payment methods to accommodate your clients.\n\nWith Stripe integration, you can process credit cards and ACH bank transfers automatically. For clients who prefer to pay in person, you can also log cash and check payments manually. All payment records are tracked in the billing dashboard.\n\nAutomatic recurring billing runs on the schedule defined by each client's membership plan. You'll receive notifications for failed payments, and the system can automatically retry or pause memberships based on your configured rules. Payment history is available on each client's profile.`,
    related: ["membership-plans", "refunds", "integrations"],
  },
  {
    id: "payment-discounts",
    category: "billing",
    title: "Payment Discounts",
    content: `Offer discounts to incentivize sign-ups, reward loyalty, or run promotions.\n\nCreate percentage-based or fixed-amount discounts in the Billing section. Discounts can be applied to specific plans or any plan. Set start and end dates for time-limited promotions, or create evergreen discounts for referrals and family members.\n\nApply discounts to individual clients from their billing profile. You can stack discounts or restrict to one per client. The billing dashboard shows you the impact of discounts on your revenue so you can evaluate which promotions are most effective.`,
    related: ["membership-plans", "processing-payments"],
  },
  {
    id: "refunds",
    category: "billing",
    title: "Refunds",
    content: `Process refunds quickly and keep accurate records.\n\nFrom a client's billing profile, find the payment you want to refund and click the refund button. You can issue full or partial refunds. Refunds processed through Stripe are sent back to the original payment method automatically.\n\nAll refunds are logged in the billing history with the reason, amount, and date. For cash or check payments that were logged manually, you'll need to handle the physical refund separately and mark it as refunded in the system. Refund reports are available in the Analytics section.`,
    related: ["processing-payments", "membership-plans"],
  },

  // Community
  {
    id: "community-feed",
    category: "community",
    title: "Community Feed",
    content: `The Community Feed is a social hub for your gym members.\n\nCoaches and clients can post updates, share photos, celebrate PRs, and encourage each other. Posts support likes and comments to drive engagement. As an admin, you can pin important announcements to the top of the feed.\n\nThe feed is accessible from both the admin dashboard and the client portal. It's a great way to build culture, share workout tips, announce events, and keep your community connected between sessions. You can moderate posts and comments to maintain a positive environment.`,
    related: ["challenges", "classroom", "events"],
  },
  {
    id: "challenges",
    category: "community",
    title: "Challenges",
    content: `Challenges are a powerful way to boost engagement and motivation.\n\nCreate time-bound challenges with specific goals (e.g., "30-Day Attendance Streak," "1000 Push-Ups in March," "Nutrition Photo Challenge"). Set start and end dates, define how participation is tracked, and add prizes or recognition for winners.\n\nClients can join challenges from the community section and track their progress. A leaderboard shows rankings in real time. Challenges integrate with the gamification system to award bonus points and badges. You can run multiple challenges simultaneously and archive past ones.`,
    related: ["community-feed", "gamification", "events"],
  },
  {
    id: "classroom",
    category: "community",
    title: "Classroom",
    content: `The Classroom feature lets you create educational courses for your members.\n\nBuild courses with multiple lessons covering nutrition, recovery, mindset, exercise technique, or any topic relevant to your gym. Each lesson can include text content, images, and video links. Courses can be free or premium, and you control who has access.\n\nClients progress through lessons at their own pace and can mark lessons as complete. This is a great way to add value to memberships, educate new clients on your training philosophy, and establish your expertise. Course completion can trigger gamification rewards.`,
    related: ["community-feed", "challenges", "resources"],
  },
  {
    id: "events",
    category: "community",
    title: "Events",
    content: `Plan and promote special events for your gym community.\n\nCreate events for competitions, workshops, social gatherings, charity workouts, or anything else. Set the date, time, location, capacity, and description. Events appear in the community section and clients can RSVP through the client portal.\n\nUse events to drive engagement, attract new leads, and strengthen your community. You can send reminders to registered attendees and track attendance. Past events are archived so you can review participation and plan future events based on what worked.`,
    related: ["community-feed", "challenges", "creating-sessions"],
  },

  // Settings
  {
    id: "branding",
    category: "settings",
    title: "Branding",
    content: `Make GymKit look and feel like your own platform with custom branding.\n\nIn Settings > Branding, upload your gym logo, set your primary and secondary brand colors, and add a tagline. These settings are applied across the entire platform including the client portal, check-in screen, and any public-facing pages.\n\nYour branding also extends to the PWA (Progressive Web App) version that clients can install on their phones. The app icon, splash screen, and theme colors all reflect your brand. For a fully white-labeled experience, customize every touchpoint to match your gym's identity.`,
    related: ["setting-up-gym", "integrations", "client-portal"],
  },
  {
    id: "integrations",
    category: "settings",
    title: "Integrations",
    content: `GymKit integrates with popular tools to streamline your operations.\n\nStripe handles payment processing for membership billing and one-time charges. Zapier connects GymKit to thousands of other apps for automated workflows. GoHighLevel (GHL) integration syncs your client data with your CRM and marketing tools.\n\nConfigure integrations in Settings > Integrations. Each integration has its own setup guide with API keys or OAuth connections. You can also set up email (Resend) and SMS (Twilio) integrations for automated client communications. Test connections directly from the settings page.`,
    related: ["branding", "automations", "membership-plans"],
  },
  {
    id: "automations",
    category: "settings",
    title: "Automations",
    content: `Automate repetitive tasks with email and SMS triggers.\n\nSet up automations for common scenarios like: welcome emails for new clients, session reminders, missed session follow-ups, birthday messages, payment receipt confirmations, and re-engagement campaigns for inactive members.\n\nIn the Automations section, create triggers based on events (client added, session booked, payment received, etc.) and define the action (send email, send SMS, update status). Use templates with merge fields to personalize messages. Automations save you hours of manual follow-up and ensure consistent communication.`,
    related: ["integrations", "managing-clients", "creating-sessions"],
  },
  {
    id: "user-management",
    category: "settings",
    title: "User Management",
    content: `Control who has access to your GymKit platform and what they can do.\n\nGymKit supports three roles: Admin (full access to all features including billing and settings), Coach (access to coaching tools, clients, and scheduling), and Client (client portal access only). You can add multiple admins and coaches.\n\nManage users in Settings > Users. Add new staff members, assign roles, and deactivate accounts when someone leaves. Each user gets their own login credentials. Coaches can be assigned to specific sessions and have access to the clients in those sessions.`,
    related: ["setting-up-gym", "integrations", "managing-clients"],
  },
];

/* ==================== CONTEXT MAP ==================== */
// Maps route segments to relevant article categories/IDs for the floating help button
export const HELP_CONTEXT_MAP = {
  build: ["building-workout", "creating-first-workout", "progression-engine"],
  workouts: ["building-workout", "progression-engine", "session-view-article"],
  programs: ["building-workout", "progression-engine"],
  library: ["building-workout"],
  matrix: ["progression-engine"],
  command: ["session-view-article", "station-mode"],
  stations: ["station-mode", "session-view-article"],
  "remote-workouts": ["remote-workouts"],
  members: ["managing-clients", "adding-first-client", "client-portal"],
  assessments: ["movement-assessments"],
  schedule: ["creating-sessions", "booking-waitlists", "check-in-system"],
  checkin: ["check-in-system", "creating-sessions"],
  billing: ["membership-plans", "processing-payments", "payment-discounts", "refunds"],
  community: ["community-feed", "challenges"],
  classroom: ["classroom"],
  events: ["events"],
  settings: ["branding", "integrations", "automations", "user-management"],
  automations: ["automations", "integrations"],
  integrations: ["integrations", "automations"],
};

/* ==================== HELP CENTER COMPONENT ==================== */
export default function HelpCenter() {
  const B = useTheme();
  const [activeCategory, setActiveCategory] = useState("getting-started");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let articles = ARTICLES;
    if (q) {
      articles = articles.filter(
        a => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
      );
    } else {
      articles = articles.filter(a => a.category === activeCategory);
    }
    return articles;
  }, [activeCategory, searchQuery]);

  const getArticleById = (id) => ARTICLES.find(a => a.id === id);

  const handleSelectArticle = (article) => {
    setSelectedArticle(article);
    setSearchQuery("");
  };

  const handleBack = () => setSelectedArticle(null);

  const s = {
    page: { maxWidth: 1100, margin: "0 auto", padding: 32 },
    h1: { fontSize: 28, fontWeight: 700, color: B.text, margin: 0 },
    subtitle: { color: B.muted, fontSize: 14, marginTop: 4 },
    searchWrap: { position: "relative", maxWidth: 500, marginTop: 20, marginBottom: 28 },
    searchInput: {
      width: "100%", padding: "11px 16px 11px 42px", borderRadius: 10,
      border: `1px solid ${B.border}`, background: B.card, color: B.text,
      fontSize: 14, boxSizing: "border-box", outline: "none",
    },
    searchIcon: {
      position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
      fontSize: 16, color: B.muted, pointerEvents: "none",
    },
    layout: { display: "flex", gap: 24 },
    categorySidebar: {
      width: 200, minWidth: 200, display: "flex", flexDirection: "column", gap: 4,
    },
    catBtn: (active) => ({
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 8, border: "none",
      background: active ? `${B.green}18` : "transparent",
      color: active ? B.green : B.muted,
      fontWeight: active ? 600 : 400, fontSize: 13,
      cursor: "pointer", textAlign: "left",
      borderLeft: active ? `3px solid ${B.green}` : "3px solid transparent",
      transition: "all 0.15s",
    }),
    articleList: { flex: 1, display: "grid", gap: 12 },
    articleCard: {
      padding: 20, borderRadius: 12, border: `1px solid ${B.border}`,
      background: B.card, cursor: "pointer", transition: "all 0.15s",
    },
    articleTitle: { fontSize: 16, fontWeight: 600, color: B.text, margin: "0 0 6px" },
    articlePreview: { fontSize: 13, color: B.muted, lineHeight: 1.5, margin: 0 },
    backBtn: {
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "none", border: "none", color: B.green,
      fontSize: 13, fontWeight: 600, cursor: "pointer",
      padding: "4px 0", marginBottom: 16,
    },
    articleContent: {
      fontSize: 15, lineHeight: 1.8, color: B.text, whiteSpace: "pre-line",
    },
    relatedSection: { marginTop: 32, paddingTop: 20, borderTop: `1px solid ${B.border}` },
    relatedTitle: { fontSize: 14, fontWeight: 600, color: B.muted, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
    relatedLink: {
      display: "inline-block", padding: "6px 14px", borderRadius: 6,
      background: `${B.green}12`, color: B.green, fontSize: 13,
      fontWeight: 500, cursor: "pointer", border: "none",
      marginRight: 8, marginBottom: 8, transition: "all 0.15s",
    },
  };

  // Article detail view
  if (selectedArticle) {
    const related = (selectedArticle.related || [])
      .map(id => getArticleById(id))
      .filter(Boolean);

    return (
      <div style={s.page}>
        <button style={s.backBtn} onClick={handleBack}>
          &larr; Back to articles
        </button>
        <Card style={{ padding: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.green, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            {CATEGORIES.find(c => c.id === selectedArticle.category)?.label}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: B.text, margin: "0 0 20px" }}>
            {selectedArticle.title}
          </h1>
          <div style={s.articleContent}>
            {selectedArticle.content}
          </div>
          {related.length > 0 && (
            <div style={s.relatedSection}>
              <div style={s.relatedTitle}>Related Articles</div>
              {related.map(r => (
                <button
                  key={r.id}
                  style={s.relatedLink}
                  onClick={() => handleSelectArticle(r)}
                >
                  {r.title}
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Article list view
  return (
    <div style={s.page}>
      <h1 style={s.h1}>Help Center</h1>
      <p style={s.subtitle}>Search articles or browse by category to find answers.</p>

      {/* Search */}
      <div style={s.searchWrap}>
        <span style={s.searchIcon}>{"\uD83D\uDD0D"}</span>
        <input
          style={s.searchInput}
          placeholder="Search help articles..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div style={s.layout}>
        {/* Category sidebar */}
        {!searchQuery && (
          <div style={s.categorySidebar}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                style={s.catBtn(activeCategory === cat.id)}
                onClick={() => setActiveCategory(cat.id)}
                onMouseEnter={e => { if (activeCategory !== cat.id) e.currentTarget.style.background = `${B.border}44`; }}
                onMouseLeave={e => { if (activeCategory !== cat.id) e.currentTarget.style.background = "transparent"; }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Articles */}
        <div style={s.articleList}>
          {searchQuery && (
            <div style={{ fontSize: 13, color: B.muted, marginBottom: 4 }}>
              {filteredArticles.length} result{filteredArticles.length !== 1 ? "s" : ""} for "{searchQuery}"
            </div>
          )}
          {filteredArticles.length === 0 && (
            <Card style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{"\ \uD83D\uDD0D"}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: B.text, marginBottom: 6 }}>No articles found</div>
              <div style={{ fontSize: 13, color: B.muted }}>Try a different search term or browse by category.</div>
            </Card>
          )}
          {filteredArticles.map(article => (
            <div
              key={article.id}
              style={s.articleCard}
              onClick={() => handleSelectArticle(article)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = B.green; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = B.border; e.currentTarget.style.transform = "none"; }}
            >
              <h3 style={s.articleTitle}>{article.title}</h3>
              <p style={s.articlePreview}>
                {article.content.slice(0, 150).replace(/\n/g, " ")}...
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==================== FLOATING HELP BUTTON ==================== */
export function FloatingHelpButton() {
  const B = useTheme();
  const [open, setOpen] = useState(false);

  // Determine current route segment
  const path = window.location.pathname;
  const segments = path.split("/").filter(Boolean);
  // Route is like /gym/:gymId/:page
  const currentPage = segments.length >= 3 ? segments[2] : "";

  const contextArticleIds = HELP_CONTEXT_MAP[currentPage] || ["quick-start", "setting-up-gym"];
  const contextArticles = contextArticleIds.map(id => ARTICLES.find(a => a.id === id)).filter(Boolean);

  const gymId = localStorage.getItem("hf_gym_id") || "default";

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed", bottom: 24, left: 24, zIndex: 9000,
          width: 48, height: 48, borderRadius: "50%",
          background: B.green, color: "#fff", border: "none",
          fontSize: 20, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
        title="Help"
      >
        ?
      </button>

      {/* Mini panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 80, left: 24, zIndex: 9001,
          width: 320, maxHeight: 420,
          background: B.card, border: `1px solid ${B.border}`,
          borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 18px", borderBottom: `1px solid ${B.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: B.text }}>Help</div>
              <div style={{ fontSize: 11, color: B.muted }}>Suggested for this page</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", color: B.muted, fontSize: 18, cursor: "pointer", lineHeight: 1 }}
            >
              {"\u2715"}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {contextArticles.map(article => (
              <a
                key={article.id}
                href={`/gym/${gymId}/help`}
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `/gym/${gymId}/help`;
                }}
                style={{
                  display: "block", padding: "10px 18px", cursor: "pointer",
                  textDecoration: "none", transition: "background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${B.border}44`; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: B.text, marginBottom: 2 }}>
                  {article.title}
                </div>
                <div style={{ fontSize: 11, color: B.muted, lineHeight: 1.4 }}>
                  {article.content.slice(0, 80).replace(/\n/g, " ")}...
                </div>
              </a>
            ))}
          </div>

          <a
            href={`/gym/${gymId}/help`}
            style={{
              display: "block", padding: "12px 18px",
              borderTop: `1px solid ${B.border}`,
              textAlign: "center", fontSize: 13, fontWeight: 600,
              color: B.green, textDecoration: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${B.green}10`; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            View all help articles &rarr;
          </a>
        </div>
      )}
    </>
  );
}
