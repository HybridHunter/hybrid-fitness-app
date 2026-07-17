import { useState, useMemo, useEffect, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useAuth } from "../../context/AuthContext";
import { localISO } from "../../utils/dates";
import Card from "../../components/ui/Card";
import { ImageUploadZone } from "../../components/shared/ImageUpload";
import StoriesBar from "../../components/shared/Stories";

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

const uuid = () => crypto.randomUUID();

const LEVEL_THRESHOLDS = [0, 5, 20, 65, 155, 515, 2015, 8015, 33015];
const communityLevel = (pts) => {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (pts >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
};

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
};

const extractYouTubeId = (url) => {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

const initials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

const toDateStr = (d) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().split("T")[0];
};

const daysBetween = (a, b) => {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  return Math.round((db - da) / 86400000);
};

const formatDateShort = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const DEFAULT_CATEGORIES = ["Announcements", "Wins", "Questions", "Introductions", "General", "Challenges"];

/* ──────────────────────────────────────────────
   Demo data factory (runs once via useLocalStorage default)
   ────────────────────────────────────────────── */

const now = new Date();
const ago = (h) => new Date(now.getTime() - h * 3600000).toISOString();

const DEMO_POSTS = [
  {
    id: uuid(), authorId: "coach", authorName: "Coach", category: "Announcements",
    content: "Big update! The new Progression Engine is now live in your member dashboard. Check your scores, see where you stand, and let's build a plan to level up your weak links. Drop a comment if you have questions — I'll be doing a live walkthrough this Thursday at 6 PM.",
    mediaType: null, mediaUrl: "", pollOptions: [],
    likes: ["sarah", "mike", "emily", "tom", "lisa"],
    comments: [
      { id: uuid(), authorId: "sarah", authorName: "Sarah Johnson", text: "This is awesome! My squat score went up since last month.", likes: ["coach", "emily"], timestamp: ago(3), replies: [
        { id: uuid(), authorId: "coach", authorName: "Coach", text: "Love to see it Sarah! Your consistency is paying off.", likes: ["sarah"], timestamp: ago(2.5) }
      ]},
      { id: uuid(), authorId: "tom", authorName: "Tom Baker", text: "Will the walkthrough be recorded for those of us who can't make Thursday?", likes: ["mike", "lisa"], timestamp: ago(2), replies: [
        { id: uuid(), authorId: "coach", authorName: "Coach", text: "Absolutely — I'll post the replay here in the community right after.", likes: ["tom"], timestamp: ago(1.5) }
      ]}
    ],
    pinned: true, createdAt: ago(6)
  },
  {
    id: uuid(), authorId: "sarah", authorName: "Sarah Johnson", category: "Wins",
    content: "FINALLY hit a 225 lb back squat today!!! That's a 20 lb PR and I've been chasing this number for months. Shoutout to Coach for fixing my bracing cues — it made all the difference. Next stop: 250!",
    mediaType: null, mediaUrl: "", pollOptions: [],
    likes: ["coach", "emily", "tom", "mike", "lisa", "james"],
    comments: [
      { id: uuid(), authorId: "emily", authorName: "Emily Rodriguez", text: "BEAST MODE!! So proud of you!", likes: ["sarah", "coach"], timestamp: ago(10), replies: [] },
      { id: uuid(), authorId: "coach", authorName: "Coach", text: "That bracing fix was all you. You put in the reps. Well deserved!", likes: ["sarah", "tom"], timestamp: ago(9), replies: [] },
      { id: uuid(), authorId: "tom", authorName: "Tom Baker", text: "250 is coming. No doubt.", likes: ["sarah"], timestamp: ago(8), replies: [] }
    ],
    pinned: false, createdAt: ago(12)
  },
  {
    id: uuid(), authorId: "mike", authorName: "Mike Chen", category: "Questions",
    content: "Hey everyone — I've been training consistently for about 5 months now but I feel like my nutrition is holding me back. I'm eating around 2,200 calories but not sure about my macros. Any tips for someone trying to lose fat and build muscle at the same time? Appreciate any advice!",
    mediaType: null, mediaUrl: "", pollOptions: [],
    likes: ["lisa", "david", "james"],
    comments: [
      { id: uuid(), authorId: "coach", authorName: "Coach", text: "Great question Mike. At your weight, I'd aim for 180-200g protein minimum. Let's chat about the rest in your next check-in — everyone's numbers are a bit different.", likes: ["mike", "lisa", "tom"], timestamp: ago(18), replies: [
        { id: uuid(), authorId: "mike", authorName: "Mike Chen", text: "That's way more protein than I thought. Thanks Coach, looking forward to the check-in!", likes: ["coach"], timestamp: ago(17) }
      ]},
      { id: uuid(), authorId: "emily", authorName: "Emily Rodriguez", text: "Meal prep changed the game for me. I batch cook chicken, rice, and veggies every Sunday. Makes hitting macros so much easier during the week.", likes: ["mike", "lisa"], timestamp: ago(16), replies: [] }
    ],
    pinned: false, createdAt: ago(20)
  },
  {
    id: uuid(), authorId: "david", authorName: "David Martinez", category: "Introductions",
    content: "Hey everyone! I'm David — just started my trial week here and I'm loving the vibe already. I've been mostly doing bodyweight stuff at home but wanted to get into real strength training. A buddy of mine recommended this gym and I can already tell the coaching here is next level. Excited to be part of this community!",
    mediaType: null, mediaUrl: "", pollOptions: [],
    likes: ["coach", "sarah", "emily", "tom", "mike", "lisa"],
    comments: [
      { id: uuid(), authorId: "coach", authorName: "Coach", text: "Welcome David! Glad to have you. We'll get your movement assessment done this week so we can build you a solid starting program.", likes: ["david", "sarah"], timestamp: ago(46), replies: [] },
      { id: uuid(), authorId: "sarah", authorName: "Sarah Johnson", text: "Welcome to the fam! You're going to love it here.", likes: ["david"], timestamp: ago(44), replies: [] },
      { id: uuid(), authorId: "tom", authorName: "Tom Baker", text: "Welcome aboard David! If you need a training partner for the morning sessions, hit me up.", likes: ["david", "coach"], timestamp: ago(42), replies: [
        { id: uuid(), authorId: "david", authorName: "David Martinez", text: "Appreciate that Tom! I might take you up on it once I get my schedule figured out.", likes: ["tom"], timestamp: ago(40) }
      ]}
    ],
    pinned: false, createdAt: ago(48)
  },
  {
    id: uuid(), authorId: "coach", authorName: "Coach", category: "General",
    content: "Curious about this — what time slots work best for you for small group sessions? Thinking about adding a couple more to the schedule. Vote below!",
    mediaType: "poll", mediaUrl: "", pollOptions: [
      { text: "6:00 AM", votes: ["sarah", "tom", "emily"] },
      { text: "12:00 PM (Lunch)", votes: ["mike", "james"] },
      { text: "5:30 PM", votes: ["lisa", "david", "emily", "tom"] },
      { text: "7:30 PM", votes: ["mike", "david"] }
    ],
    likes: ["sarah", "mike", "emily", "tom", "lisa"],
    comments: [
      { id: uuid(), authorId: "lisa", authorName: "Lisa Park", text: "5:30 PM is perfect for the after-work crowd!", likes: ["mike"], timestamp: ago(70), replies: [] }
    ],
    pinned: false, createdAt: ago(72)
  },
  {
    id: uuid(), authorId: "coach", authorName: "Coach", category: "General",
    content: "Great breakdown on the hip hinge pattern — this is exactly the progression we use in the gym. If your Hinge score is at 0 or below, start with the first drill and master it before moving on.",
    mediaType: "video", mediaUrl: "https://www.youtube.com/watch?v=S2Bqse6Kxlk",
    pollOptions: [],
    likes: ["mike", "sarah", "james", "tom"],
    comments: [
      { id: uuid(), authorId: "mike", authorName: "Mike Chen", text: "This is exactly what I needed. My hinge has always felt off.", likes: ["coach"], timestamp: ago(94), replies: [] },
      { id: uuid(), authorId: "james", authorName: "James Williams", text: "Good share Coach. The wall drill at 2:15 is great for beginners.", likes: ["coach", "mike"], timestamp: ago(90), replies: [] }
    ],
    pinned: false, createdAt: ago(96)
  },
  {
    id: uuid(), authorId: "emily", authorName: "Emily Rodriguez", category: "Wins",
    content: "Just signed up for the CrossFit Open next month! First time competing in almost a year. Nervous but ready. This community has been a huge part of keeping me consistent. Let's go!",
    mediaType: null, mediaUrl: "", pollOptions: [],
    likes: ["coach", "sarah", "tom", "lisa"],
    comments: [
      { id: uuid(), authorId: "coach", authorName: "Coach", text: "You're going to crush it Emily. Your numbers are looking better than ever.", likes: ["emily", "sarah"], timestamp: ago(26), replies: [] },
      { id: uuid(), authorId: "sarah", authorName: "Sarah Johnson", text: "Can we come cheer you on?!", likes: ["emily", "tom"], timestamp: ago(24), replies: [
        { id: uuid(), authorId: "emily", authorName: "Emily Rodriguez", text: "Yes please!! I'll share the details when I get them.", likes: ["sarah", "tom", "coach"], timestamp: ago(22) }
      ]}
    ],
    pinned: false, createdAt: ago(28)
  },
  {
    id: uuid(), authorId: "tom", authorName: "Tom Baker", category: "General",
    content: "Monday motivation: Showed up even though I didn't feel like it. 45 minutes later, hit a deadlift PR. The hardest part is always walking through the door. Keep showing up, people.",
    mediaType: null, mediaUrl: "", pollOptions: [],
    likes: ["coach", "sarah", "emily", "mike", "lisa", "david", "james"],
    comments: [
      { id: uuid(), authorId: "coach", authorName: "Coach", text: "This is the mindset. Consistency beats motivation every single time.", likes: ["tom", "sarah", "emily"], timestamp: ago(52), replies: [] },
      { id: uuid(), authorId: "lisa", authorName: "Lisa Park", text: "Needed to hear this today. Thank you Tom!", likes: ["tom"], timestamp: ago(50), replies: [] }
    ],
    pinned: false, createdAt: ago(54)
  },
  {
    id: uuid(), authorId: "lisa", authorName: "Lisa Park", category: "Wins",
    content: "Small win but huge for me — I did my first unassisted pull-up today! Three months ago I couldn't even hang for 10 seconds. Progress is progress!",
    mediaType: null, mediaUrl: "", pollOptions: [],
    likes: ["coach", "sarah", "emily", "tom", "mike", "david"],
    comments: [
      { id: uuid(), authorId: "coach", authorName: "Coach", text: "That is NOT a small win, that's HUGE! Your back strength has come so far.", likes: ["lisa", "sarah"], timestamp: ago(30), replies: [] },
      { id: uuid(), authorId: "emily", authorName: "Emily Rodriguez", text: "First pull-up is one of the best feelings in fitness. Congrats Lisa!!", likes: ["lisa"], timestamp: ago(28), replies: [] }
    ],
    pinned: false, createdAt: ago(32)
  }
];

/* ── Demo Challenges ── */
const buildDemoChallenges = () => {
  const tenDaysAgo = toDateStr(new Date(now.getTime() - 10 * 86400000));
  const twentyDaysFromNow = toDateStr(new Date(now.getTime() + 20 * 86400000));
  const fiveDaysAgo = toDateStr(new Date(now.getTime() - 5 * 86400000));
  const twentyFiveDaysFromNow = toDateStr(new Date(now.getTime() + 25 * 86400000));

  const nutritionComments = [
    "Hit my protein goal today!", "Meal prepped for the week", "Stayed on track despite eating out",
    "Cooked all meals at home today", "Got my greens in and hit 180g protein", "Drank a gallon of water and ate clean",
    "Smoothie for breakfast, chicken and rice for lunch and dinner", "Stuck to my plan even at a restaurant",
    "Prepped 5 days of lunches today", "Great day — hit all my macros perfectly",
    "Had a small slip at dinner but still mostly on track", "New recipe worked out great for meal prep"
  ];

  const stepsComments = [
    "10,243 steps! Morning walk + gym session", "Hit 11,500 today with an evening hike",
    "Just barely made it — 10,012 steps", "12,800 steps! Walked to and from work",
    "Took the dog on an extra long walk — 13,200 steps", "10,500 steps, mostly from the gym and errands",
    "Hit 14,000 today — went on a trail run", "Struggled but got to 10,100 by walking after dinner"
  ];

  const memberProfiles = {
    sarah: "Sarah Johnson",
    mike: "Mike Chen",
    emily: "Emily Rodriguez",
    lisa: "Lisa Park",
    tom: "Tom Baker"
  };

  // Challenge 1: Nutrition (adherence only, started 10 days ago)
  const c1Participants = ["sarah", "mike", "emily", "lisa", "tom"];
  const c1Submissions = {};
  c1Participants.forEach((memberId) => {
    c1Submissions[memberId] = [];
    for (let d = 0; d < 10; d++) {
      // Some days missed — realistic adherence
      const missChance = memberId === "mike" ? 0.3 : memberId === "tom" ? 0.2 : 0.1;
      if (Math.random() < missChance && d > 0) continue; // deterministic-ish: use seeded approach
      const dateStr = toDateStr(new Date(now.getTime() - (10 - d) * 86400000));
      c1Submissions[memberId].push({
        id: uuid(),
        date: dateStr,
        comment: nutritionComments[(d + memberId.charCodeAt(0)) % nutritionComments.length],
        proof: "",
        verified: null,
        verifiedBy: "",
        timestamp: new Date(new Date(dateStr + "T00:00:00Z").getTime() + 8 * 3600000 + Math.random() * 8 * 3600000).toISOString()
      });
    }
  });
  // Make sure mike misses days 3, 6, 9 and tom misses days 4, 8
  c1Submissions["mike"] = c1Submissions["mike"].filter((s) => {
    const d = daysBetween(tenDaysAgo, s.date);
    return d !== 3 && d !== 6 && d !== 9;
  });
  c1Submissions["tom"] = c1Submissions["tom"].filter((s) => {
    const d = daysBetween(tenDaysAgo, s.date);
    return d !== 4 && d !== 8;
  });
  c1Submissions["lisa"] = c1Submissions["lisa"].filter((s) => {
    const d = daysBetween(tenDaysAgo, s.date);
    return d !== 7;
  });

  // Challenge 2: 10K Steps (adherence+target, started 5 days ago)
  const c2Participants = ["sarah", "emily", "tom", "lisa"];
  const c2Submissions = {};
  const verifyStatuses = [true, true, true, null, false]; // some variety
  c2Participants.forEach((memberId) => {
    c2Submissions[memberId] = [];
    for (let d = 0; d < 5; d++) {
      if (memberId === "tom" && d === 2) continue; // tom missed day 3
      const dateStr = toDateStr(new Date(now.getTime() - (5 - d) * 86400000));
      const vi = (d + memberId.charCodeAt(0)) % verifyStatuses.length;
      c2Submissions[memberId].push({
        id: uuid(),
        date: dateStr,
        comment: stepsComments[(d + memberId.charCodeAt(0)) % stepsComments.length],
        proof: d % 2 === 0 ? "https://fitness-tracker.example.com/screenshot-" + memberId + "-day" + (d + 1) + ".png" : "",
        verified: d === 4 ? null : verifyStatuses[vi], // today's are pending
        verifiedBy: d === 4 ? "" : (verifyStatuses[vi] !== null ? "Coach" : ""),
        timestamp: new Date(new Date(dateStr + "T00:00:00Z").getTime() + 7 * 3600000 + Math.random() * 10 * 3600000).toISOString()
      });
    }
  });

  // Add likes to all submissions
  const addLikesToSubs = (subs) => {
    const result = {};
    const likePool = ["sarah", "mike", "emily", "lisa", "tom"];
    Object.entries(subs).forEach(([mid, arr]) => {
      result[mid] = arr.map((s, i) => ({
        ...s,
        likes: likePool.filter((l) => l !== mid && ((i + l.charCodeAt(0)) % 3 === 0))
      }));
    });
    return result;
  };

  // Daily posts for nutrition challenge (10 days in)
  const c1DailyPosts = {};
  const nutritionDailyMessages = [
    "Day 1! Let's kick this off right. Today's focus: track EVERYTHING you eat. No judgment, just awareness. Write down every meal, snack, and drink. Knowledge is power!",
    "Day 2: Hydration check! Aim for at least 8 glasses of water today alongside your nutrition tracking. How did yesterday's tracking go?",
    "Day 3: Protein spotlight. Try to get a source of protein in every meal today. Chicken, eggs, Greek yogurt, tofu — whatever works for you!",
    "Day 4: Meal prep Sunday! Even if it's not Sunday, let's prep. Cook enough protein and veggies for the next 2-3 days. Future you will thank present you.",
    "Day 5: Midweek check — how are we feeling? Today's focus: eat one more serving of vegetables than you normally would. Sneak them in anywhere!",
    "Day 6: Mindful eating day. Put your phone down during at least one meal today. Chew slowly. Notice flavors. This is a game changer for portion control.",
    "Day 7: ONE WEEK DOWN! Celebrate with a meal you love that still fits your goals. You've earned it. Consistency over perfection.",
    "Day 8: Let's talk snacking. Today, plan your snacks ahead of time instead of grabbing whatever's around. Prep 2-3 healthy snacks for the day.",
    "Day 9: Restaurant challenge! If you eat out today (or plan to this week), look at the menu ahead of time and pick your meal before you go. No impulse ordering!",
    "Day 10! Focus on hitting your protein goal today. We're a third of the way through — momentum is building. Drop your protein total in your check-in!"
  ];
  for (let d = 0; d < 10; d++) {
    const dateStr = toDateStr(new Date(now.getTime() - (10 - d) * 86400000));
    c1DailyPosts[dateStr] = {
      text: nutritionDailyMessages[d],
      postedBy: "Coach",
      postedAt: new Date(new Date(dateStr + "T00:00:00Z").getTime() + 6 * 3600000).toISOString()
    };
  }

  // Daily posts for steps challenge (5 days in)
  const c2DailyPosts = {};
  const stepsDailyMessages = [
    "Day 1 of the 10K Steps Challenge! Start strong. Park farther away, take the stairs, go for a walk at lunch. Every step counts. Let's see those numbers!",
    "Day 2: Try a different route today. Explore your neighborhood or find a new trail. Fresh scenery keeps it interesting. Post your step count + a screenshot!",
    "Day 3: Midweek push! If you're behind, a 30-minute evening walk usually gets you 3,000-4,000 steps. That might be all you need to hit 10K.",
    "Day 4: Walking meeting challenge! Take at least one phone call or meeting while walking today. Productivity + steps = win-win.",
    "Day 5: Almost at the end of week 1! Push for your best day yet. Who can break 12K today? Bonus points for creative ways to get steps in."
  ];
  for (let d = 0; d < 5; d++) {
    const dateStr = toDateStr(new Date(now.getTime() - (5 - d) * 86400000));
    c2DailyPosts[dateStr] = {
      text: stepsDailyMessages[d],
      postedBy: "Coach",
      postedAt: new Date(new Date(dateStr + "T00:00:00Z").getTime() + 6 * 3600000).toISOString()
    };
  }

  return [
    {
      id: uuid(),
      title: "30-Day Nutrition Check-in",
      description: "Commit to tracking your nutrition and checking in with the community every day for 30 days. Share what you ate, how you felt, and keep each other accountable. No perfection required — just consistency!",
      type: "adherence",
      targetDescription: "",
      startDate: tenDaysAgo,
      endDate: twentyDaysFromNow,
      createdBy: "coach",
      createdAt: new Date(new Date(tenDaysAgo + "T00:00:00Z").getTime() - 3600000).toISOString(),
      participants: c1Participants,
      submissions: addLikesToSubs(c1Submissions),
      dailyPosts: c1DailyPosts
    },
    {
      id: uuid(),
      title: "10K Steps Challenge",
      description: "Hit 10,000 steps every day for 30 days. Walk, run, hike — whatever it takes. Post your step count and optional proof screenshot from your tracker. Coach will verify target submissions.",
      type: "adherence_target",
      targetDescription: "Hit 10,000 steps daily",
      startDate: fiveDaysAgo,
      endDate: twentyFiveDaysFromNow,
      createdBy: "coach",
      createdAt: new Date(new Date(fiveDaysAgo + "T00:00:00Z").getTime() - 3600000).toISOString(),
      participants: c2Participants,
      submissions: addLikesToSubs(c2Submissions),
      dailyPosts: c2DailyPosts
    }
  ];
};

/* ──────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────── */

function Avatar({ name, size = 36, style = {}, B }) {
  const colors = [B.accent, B.blue, B.purple, B.orange, B.red];
  const ci = name ? name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length : 0;
  const bg = name === "Coach" ? B.accent : colors[ci];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.38, color: "#fff", flexShrink: 0,
      ...style
    }}>
      {initials(name)}
    </div>
  );
}

function LevelBadge({ level, B }) {
  return (
    <span style={{
      background: `${B.accent}22`, color: B.accent, fontSize: 11, fontWeight: 700,
      padding: "1px 6px", borderRadius: 8, marginLeft: 6, whiteSpace: "nowrap"
    }}>Lvl {level}</span>
  );
}

function CategoryPill({ cat, B, small }) {
  const catColors = {
    Announcements: B.red,
    Wins: B.accent,
    Questions: B.blue,
    Introductions: B.purple,
    General: B.muted,
    Challenges: B.orange || B.accent,
  };
  const c = catColors[cat] || B.muted;
  return (
    <span style={{
      background: `${c}18`, color: c, fontSize: small ? 10 : 11, fontWeight: 600,
      padding: small ? "1px 6px" : "2px 8px", borderRadius: 10, whiteSpace: "nowrap"
    }}>{cat}</span>
  );
}

function PinIcon({ size = 14, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5"/><path d="M5 17h14"/><path d="M8 3v3a2 2 0 0 1-2 2H5l3 6h8l3-6h-1a2 2 0 0 1-2-2V3z"/>
    </svg>
  );
}

function HeartIcon({ filled, size = 16, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

function CommentIcon({ size = 16, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function MoreIcon({ size = 18, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
    </svg>
  );
}

function VideoIcon({ size = 18, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
}
function ImageIcon({ size = 18, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}
function PollIcon({ size = 18, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/><line x1="9" y1="17" x2="11" y2="17"/></svg>;
}
function TrophyIcon({ size = 18, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>;
}
function CheckIcon({ size = 16, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function XIcon({ size = 16, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function TargetIcon({ size = 18, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
}
function UsersIcon({ size = 18, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function CalendarIcon({ size = 16, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function FlameIcon({ size = 16, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>;
}

/* Poll sub-component */
function PollUI({ options, postId, onVote, B, meId }) {
  const totalVotes = options.reduce((s, o) => s + o.votes.length, 0);
  const coachVoted = options.some(o => o.votes.includes(meId));
  return (
    <div style={{ marginTop: 12 }}>
      {options.map((opt, i) => {
        const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
        const voted = opt.votes.includes(meId);
        return (
          <div key={i}
            onClick={() => !coachVoted && onVote(postId, i)}
            style={{
              position: "relative", padding: "10px 14px", borderRadius: 8, marginBottom: 6,
              border: `1px solid ${voted ? B.accent : B.border}`,
              cursor: coachVoted ? "default" : "pointer", overflow: "hidden",
              transition: "border-color 0.2s"
            }}>
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0,
              width: `${pct}%`, background: voted ? `${B.accent}25` : `${B.muted}12`,
              transition: "width 0.4s ease", borderRadius: 8
            }}/>
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, color: B.text, fontWeight: voted ? 600 : 400 }}>{opt.text}</span>
              <span style={{ fontSize: 12, color: B.muted, fontWeight: 600, marginLeft: 8 }}>{pct}%</span>
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 12, color: B.muted, marginTop: 4 }}>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</div>
    </div>
  );
}

/* Comment component */
function Comment({ c, depth = 0, onLikeComment, onReply, postId, B, authorPoints, meId, meName }) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const cLikes = c.likes || [];
  const liked = cLikes.includes(meId);
  const lvl = communityLevel(authorPoints[c.authorId] || 0);

  const submitReply = () => {
    if (!replyText.trim()) return;
    onReply(postId, c.id, replyText.trim());
    setReplyText("");
    setShowReplyInput(false);
  };

  return (
    <div style={{ marginLeft: depth * 28, marginTop: depth === 0 ? 12 : 8 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <Avatar name={c.authorName} size={28} B={B} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: B.text }}>{c.authorName}</span>
            <LevelBadge level={lvl} B={B} />
            <span style={{ fontSize: 11, color: B.dim, marginLeft: 4 }}>{timeAgo(c.timestamp ?? c.createdAt)}</span>
          </div>
          <div style={{ fontSize: 14, color: B.text, marginTop: 2, lineHeight: 1.45 }}>{c.text ?? c.content ?? ""}</div>
          <div style={{ display: "flex", gap: 14, marginTop: 4, alignItems: "center" }}>
            <button onClick={() => onLikeComment(postId, c.id)}
              style={{
                background: "none", border: "none", cursor: "pointer", display: "flex",
                alignItems: "center", gap: 4, padding: 0, color: liked ? B.red : B.muted, fontSize: 12
              }}>
              <HeartIcon filled={liked} size={13} color={liked ? B.red : B.muted} />
              {cLikes.length > 0 && cLikes.length}
            </button>
            {depth === 0 && (
              <button onClick={() => setShowReplyInput(!showReplyInput)}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  color: B.muted, fontSize: 12, fontWeight: 500
                }}>Reply</button>
            )}
          </div>
          {showReplyInput && (
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <Avatar name={meName || "Coach"} size={24} B={B} />
              <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitReply()}
                placeholder="Write a reply..."
                style={{
                  flex: 1, background: B.dark, border: `1px solid ${B.border}`, borderRadius: 8,
                  padding: "6px 10px", color: B.text, fontSize: 13, outline: "none"
                }}/>
              <button onClick={submitReply}
                style={{
                  background: B.accent, color: "#fff", border: "none", borderRadius: 8,
                  padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}>Reply</button>
            </div>
          )}
          {(c.replies || []).map((r) => (
            <Comment key={r.id} c={{ ...r, replies: [] }} depth={1}
              onLikeComment={onLikeComment} onReply={onReply}
              postId={postId} B={B} authorPoints={authorPoints} meId={meId} meName={meName} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Challenge helper fns ── */
function getChallengeStats(challenge, memberId) {
  const subs = (challenge.submissions[memberId] || []);
  const today = localISO();
  const startDate = challenge.startDate;
  const endDate = challenge.endDate;
  const totalDays = daysBetween(startDate, endDate) + 1;
  const elapsedDays = Math.min(daysBetween(startDate, today), totalDays);
  const currentDay = elapsedDays + 1;
  const daysCompleted = Math.max(0, elapsedDays);

  // Streak calculation
  let streak = 0;
  for (let d = elapsedDays; d >= 0; d--) {
    const dateStr = toDateStr(new Date(new Date(startDate + "T00:00:00Z").getTime() + d * 86400000));
    const hasSub = subs.some((s) => s.date === dateStr);
    if (hasSub) streak++;
    else break;
  }

  const totalCheckins = subs.length;
  const completionRate = daysCompleted > 0 ? Math.round((totalCheckins / daysCompleted) * 100) : 0;
  const verifiedCount = subs.filter((s) => s.verified === true).length;
  const pendingCount = subs.filter((s) => s.verified === null).length;
  const checkedInToday = subs.some((s) => s.date === today);

  return { totalDays, elapsedDays, currentDay, daysCompleted, streak, totalCheckins, completionRate, verifiedCount, pendingCount, checkedInToday };
}

function getMemberName(memberId, members = []) {
  const m = (Array.isArray(members) ? members : []).find((x) => x.id === memberId);
  if (m) return `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email || memberId;
  const names = {
    sarah: "Sarah Johnson",
    mike: "Mike Chen",
    emily: "Emily Rodriguez",
    lisa: "Lisa Park",
    tom: "Tom Baker",
    david: "David Martinez",
    james: "James Williams",
    coach: "Coach"
  };
  return names[memberId] || memberId;
}

/* ── Clock Icon for pending status ── */
function ClockIcon({ size = 16, color }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}

/* ── Challenge Detail Modal ── */
function ChallengeDetailModal({ challenge, onClose, onUpdate, B, isStaff, meId = "coach", members = [] }) {
  const [checkinComment, setCheckinComment] = useState("");
  const [checkinProof, setCheckinProof] = useState("");
  const [leaderboardSort, setLeaderboardSort] = useState("streak");
  const [reviewFilter, setReviewFilter] = useState("pending");
  const [activeTab, setActiveTab] = useState("today");
  const [dailyPostText, setDailyPostText] = useState("");
  const [editingDailyPost, setEditingDailyPost] = useState(false);

  const today = localISO();
  const stats = getChallengeStats(challenge, meId);
  const isParticipant = challenge.participants.includes(meId);
  const coachCheckedInToday = isParticipant && (challenge.submissions[meId] || []).some((s) => s.date === today);

  // Daily post data
  const dailyPosts = challenge.dailyPosts || {};
  const todaysDailyPost = dailyPosts[today] || null;

  const handleJoin = () => {
    const updated = { ...challenge, participants: [...challenge.participants, meId], submissions: { ...challenge.submissions, [meId]: [] } };
    onUpdate(updated);
  };

  const handleLeave = () => {
    const updated = {
      ...challenge,
      participants: challenge.participants.filter((p) => p !== meId),
      submissions: Object.fromEntries(Object.entries(challenge.submissions).filter(([k]) => k !== meId))
    };
    onUpdate(updated);
  };

  const handleCheckin = () => {
    if (!checkinComment.trim()) return;
    const sub = {
      id: uuid(),
      date: today,
      comment: checkinComment.trim(),
      proof: checkinProof.trim(),
      verified: challenge.type === "adherence" ? null : null,
      verifiedBy: "",
      timestamp: new Date().toISOString(),
      likes: []
    };
    const memberSubs = [...(challenge.submissions[meId] || []), sub];
    const updated = { ...challenge, submissions: { ...challenge.submissions, [meId]: memberSubs } };
    onUpdate(updated);
    setCheckinComment("");
    setCheckinProof("");
  };

  const handleVerify = (memberId, subId, approved) => {
    const memberSubs = (challenge.submissions[memberId] || []).map((s) =>
      s.id === subId ? { ...s, verified: approved, verifiedBy: "Coach" } : s
    );
    const updated = { ...challenge, submissions: { ...challenge.submissions, [memberId]: memberSubs } };
    onUpdate(updated);
  };

  const handleApproveAllToday = () => {
    const newSubs = { ...challenge.submissions };
    challenge.participants.forEach((mid) => {
      newSubs[mid] = (newSubs[mid] || []).map((s) =>
        s.date === today && s.verified === null ? { ...s, verified: true, verifiedBy: "Coach" } : s
      );
    });
    onUpdate({ ...challenge, submissions: newSubs });
  };

  const handlePostDailyUpdate = () => {
    if (!dailyPostText.trim()) return;
    const newDailyPosts = {
      ...dailyPosts,
      [today]: {
        text: dailyPostText.trim(),
        postedBy: "Coach",
        postedAt: new Date().toISOString()
      }
    };
    onUpdate({ ...challenge, dailyPosts: newDailyPosts });
    setDailyPostText("");
    setEditingDailyPost(false);
  };

  const handleToggleCheckinLike = (memberId, subId) => {
    const memberSubs = (challenge.submissions[memberId] || []).map((s) => {
      if (s.id !== subId) return s;
      const likes = s.likes || [];
      const alreadyLiked = likes.includes(meId);
      return { ...s, likes: alreadyLiked ? likes.filter((l) => l !== meId) : [...likes, meId] };
    });
    const updated = { ...challenge, submissions: { ...challenge.submissions, [memberId]: memberSubs } };
    onUpdate(updated);
  };

  // Leaderboard data
  const leaderboardData = challenge.participants.map((mid) => {
    const s = getChallengeStats(challenge, mid);
    return { memberId: mid, name: getMemberName(mid, members), ...s };
  });

  if (leaderboardSort === "streak") leaderboardData.sort((a, b) => b.streak - a.streak);
  else if (leaderboardSort === "completion") leaderboardData.sort((a, b) => b.completionRate - a.completionRate);
  else leaderboardData.sort((a, b) => a.name.localeCompare(b.name));

  // Pending reviews
  const allPendingReviews = [];
  if (challenge.type === "adherence_target") {
    challenge.participants.forEach((mid) => {
      (challenge.submissions[mid] || []).forEach((s) => {
        const matchFilter = reviewFilter === "all" ||
          (reviewFilter === "pending" && s.verified === null) ||
          (reviewFilter === "approved" && s.verified === true) ||
          (reviewFilter === "rejected" && s.verified === false);
        if (matchFilter) {
          allPendingReviews.push({ ...s, memberId: mid, memberName: getMemberName(mid, members) });
        }
      });
    });
    allPendingReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  const totalPending = challenge.type === "adherence_target"
    ? challenge.participants.reduce((sum, mid) => sum + (challenge.submissions[mid] || []).filter((s) => s.verified === null).length, 0)
    : 0;

  // Daily breakdown data
  const dailyData = [];
  for (let d = 0; d <= stats.elapsedDays && d < stats.totalDays; d++) {
    const dateStr = toDateStr(new Date(new Date(challenge.startDate + "T00:00:00Z").getTime() + d * 86400000));
    const daySubs = [];
    const missingMembers = [];
    challenge.participants.forEach((mid) => {
      const sub = (challenge.submissions[mid] || []).find((s) => s.date === dateStr);
      if (sub) daySubs.push({ ...sub, memberId: mid, memberName: getMemberName(mid, members) });
      else missingMembers.push(getMemberName(mid, members));
    });
    dailyData.push({ date: dateStr, dayNum: d + 1, submissions: daySubs, missing: missingMembers });
  }
  dailyData.reverse();

  // Today's social feed data
  const todaysCheckins = [];
  const todaysMissing = [];
  challenge.participants.forEach((mid) => {
    const sub = (challenge.submissions[mid] || []).find((s) => s.date === today);
    if (sub) {
      todaysCheckins.push({ ...sub, memberId: mid, memberName: getMemberName(mid, members) });
    } else {
      todaysMissing.push({ memberId: mid, memberName: getMemberName(mid, members) });
    }
  });
  todaysCheckins.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const checkedInCount = todaysCheckins.length;
  const totalParticipants = challenge.participants.length;

  const tabStyle = (active) => ({
    background: "none", border: "none", cursor: "pointer", padding: "8px 16px",
    fontSize: 13, fontWeight: active ? 600 : 400, color: active ? B.accent : B.muted,
    borderBottom: active ? `2px solid ${B.accent}` : "2px solid transparent"
  });

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: B.card, borderRadius: 16, width: "100%", maxWidth: 720,
        maxHeight: "90vh", overflow: "auto", border: `1px solid ${B.border}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
      }}>
        {/* Header banner */}
        <div style={{
          background: `linear-gradient(135deg, ${B.accent}, ${B.orange || B.accent}dd)`,
          padding: "20px 24px", borderRadius: "16px 16px 0 0", position: "relative"
        }}>
          <button onClick={onClose} style={{
            position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.2)",
            border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff"
          }}><XIcon size={16} color="#fff" /></button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{"\uD83C\uDFC6"}</span>
            <span style={{
              background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 11, fontWeight: 700,
              padding: "3px 10px", borderRadius: 6, letterSpacing: 1
            }}>CHALLENGE</span>
            {challenge.type === "adherence_target" && (
              <span style={{
                background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 11, fontWeight: 600,
                padding: "3px 8px", borderRadius: 6
              }}>{"\uD83C\uDFAF"} Target-Based</span>
            )}
          </div>
          <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 6 }}>{challenge.title}</h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, margin: 0, lineHeight: 1.5 }}>{challenge.description}</p>
          {challenge.type === "adherence_target" && (
            <div style={{
              background: "rgba(255,255,255,0.15)", padding: "6px 12px", borderRadius: 8,
              display: "inline-block", marginTop: 10, fontSize: 13, color: "#fff", fontWeight: 600
            }}>{"\uD83C\uDFAF"} Daily Target: {challenge.targetDescription}</div>
          )}
          {challenge.prize && challenge.prizeType !== "none" && (
            <div style={{
              background: "rgba(251,191,36,0.2)", padding: "6px 12px", borderRadius: 8,
              display: "inline-block", marginTop: 10, marginLeft: 8, fontSize: 13, color: "#fbbf24", fontWeight: 600
            }}>
              {challenge.prizeType === "physical" ? "\uD83C\uDF81" : challenge.prizeType === "credit" ? "\uD83D\uDCB0" : challenge.prizeType === "discount" ? "\uD83C\uDFF7\uFE0F" : challenge.prizeType === "badge" ? "\uD83C\uDFC5" : "\u2B50"}{" "}
              Prize: {challenge.prize}
            </div>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              <CalendarIcon size={14} color="rgba(255,255,255,0.9)" />
              {formatDateShort(challenge.startDate)} - {formatDateShort(challenge.endDate)} ({stats.totalDays} days)
            </span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              <UsersIcon size={14} color="rgba(255,255,255,0.9)" />
              {challenge.participants.length} members joined
            </span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 600 }}>
              Day {stats.currentDay} of {stats.totalDays}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ marginTop: 12, background: "rgba(255,255,255,0.2)", borderRadius: 6, height: 8, overflow: "hidden" }}>
            <div style={{
              width: `${Math.round((stats.elapsedDays / stats.totalDays) * 100)}%`,
              height: "100%", background: "#fff", borderRadius: 6, transition: "width 0.3s"
            }} />
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* Join / Leave */}
          {!isParticipant ? (
            <button onClick={handleJoin} style={{
              width: "100%", padding: "12px 0", background: B.accent, color: "#fff", border: "none",
              borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 20
            }}>Join Challenge</button>
          ) : (
            <div style={{ marginBottom: 20, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={handleLeave} style={{
                background: "none", border: `1px solid ${B.border}`, borderRadius: 8,
                padding: "6px 14px", fontSize: 12, color: B.muted, cursor: "pointer"
              }}>Leave Challenge</button>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${B.border}`, marginBottom: 16, overflowX: "auto" }}>
            <button onClick={() => setActiveTab("today")} style={tabStyle(activeTab === "today")}>Today</button>
            <button onClick={() => setActiveTab("leaderboard")} style={tabStyle(activeTab === "leaderboard")}>Leaderboard</button>
            {isStaff && challenge.type === "adherence_target" && (
              <button onClick={() => setActiveTab("review")} style={tabStyle(activeTab === "review")}>
                Coach Review {totalPending > 0 && <span style={{
                  background: B.red, color: "#fff", fontSize: 10, fontWeight: 700,
                  padding: "1px 6px", borderRadius: 10, marginLeft: 6
                }}>{totalPending}</span>}
              </button>
            )}
            <button onClick={() => setActiveTab("daily")} style={tabStyle(activeTab === "daily")}>Daily Breakdown</button>
          </div>

          {/* ═══ TODAY TAB ═══ */}
          {activeTab === "today" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Coach Daily Post Section */}
              {isStaff && !todaysDailyPost && !editingDailyPost && (
                <div style={{
                  background: `linear-gradient(135deg, ${B.accent}08, ${B.accent}15)`,
                  borderRadius: 14, padding: 18,
                  border: `1px dashed ${B.accent}50`
                }}>
                  <h4 style={{ margin: "0 0 10px", color: B.text, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{"\uD83D\uDCE3"}</span> Post Today's Challenge
                  </h4>
                  <textarea
                    value={dailyPostText}
                    onChange={(e) => setDailyPostText(e.target.value)}
                    placeholder="What's today's challenge focus? Give instructions, motivation, or the daily prompt..."
                    rows={3}
                    style={{
                      width: "100%", background: B.card, border: `1px solid ${B.border}`, borderRadius: 10,
                      padding: "12px 14px", color: B.text, fontSize: 14, outline: "none", resize: "vertical",
                      fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10, lineHeight: 1.5
                    }}
                  />
                  <button onClick={handlePostDailyUpdate} style={{
                    background: B.accent, color: "#fff", border: "none", borderRadius: 8,
                    padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                    opacity: dailyPostText.trim() ? 1 : 0.5
                  }}>Post Daily Update</button>
                </div>
              )}

              {/* Show existing daily post with edit for staff */}
              {isStaff && todaysDailyPost && editingDailyPost && (
                <div style={{
                  background: `linear-gradient(135deg, ${B.accent}08, ${B.accent}15)`,
                  borderRadius: 14, padding: 18,
                  border: `1px solid ${B.accent}40`
                }}>
                  <h4 style={{ margin: "0 0 10px", color: B.text, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{"\uD83D\uDCE3"}</span> Edit Today's Post
                  </h4>
                  <textarea
                    value={dailyPostText}
                    onChange={(e) => setDailyPostText(e.target.value)}
                    rows={3}
                    style={{
                      width: "100%", background: B.card, border: `1px solid ${B.border}`, borderRadius: 10,
                      padding: "12px 14px", color: B.text, fontSize: 14, outline: "none", resize: "vertical",
                      fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10, lineHeight: 1.5
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handlePostDailyUpdate} style={{
                      background: B.accent, color: "#fff", border: "none", borderRadius: 8,
                      padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                      opacity: dailyPostText.trim() ? 1 : 0.5
                    }}>Save Changes</button>
                    <button onClick={() => { setEditingDailyPost(false); setDailyPostText(""); }} style={{
                      background: "none", border: `1px solid ${B.border}`, borderRadius: 8,
                      padding: "10px 20px", fontSize: 14, color: B.muted, cursor: "pointer"
                    }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Display today's daily post prominently */}
              {todaysDailyPost && !editingDailyPost && (
                <div style={{
                  background: `linear-gradient(135deg, ${B.accent}10, ${B.accent}05)`,
                  borderRadius: 14, padding: 18,
                  border: `1px solid ${B.accent}35`,
                  position: "relative"
                }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <Avatar name="Coach" size={42} B={B} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: B.text }}>Coach</span>
                        <span style={{
                          background: B.accent, color: "#fff", fontSize: 10, fontWeight: 700,
                          padding: "2px 8px", borderRadius: 6, letterSpacing: 0.5
                        }}>COACH</span>
                        <span style={{
                          background: `${B.orange || B.accent}20`, color: B.orange || B.accent,
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6
                        }}>DAILY POST</span>
                        <span style={{ fontSize: 12, color: B.dim, marginLeft: 4 }}>{timeAgo(todaysDailyPost.postedAt)}</span>
                      </div>
                      <div style={{
                        fontSize: 15, color: B.text, lineHeight: 1.6, whiteSpace: "pre-wrap",
                        wordBreak: "break-word"
                      }}>{todaysDailyPost.text}</div>
                      {isStaff && (
                        <button onClick={() => { setEditingDailyPost(true); setDailyPostText(todaysDailyPost.text); }}
                          style={{
                            background: "none", border: "none", cursor: "pointer", padding: 0,
                            color: B.accent, fontSize: 12, fontWeight: 600, marginTop: 8
                          }}>Edit</button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Member check-in form (only if participant and not checked in) */}
              {isParticipant && !coachCheckedInToday && (
                <div style={{
                  background: B.dark, borderRadius: 12, padding: 16,
                  border: `1px solid ${B.border}`
                }}>
                  <h4 style={{ margin: "0 0 10px", color: B.text, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                    <CalendarIcon size={16} color={B.accent} />
                    Today's Check-in
                  </h4>
                  <textarea value={checkinComment} onChange={(e) => setCheckinComment(e.target.value)}
                    placeholder="What did you do today?"
                    rows={3}
                    style={{
                      width: "100%", background: B.card, border: `1px solid ${B.border}`, borderRadius: 8,
                      padding: "10px 12px", color: B.text, fontSize: 14, outline: "none", resize: "vertical",
                      fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8
                    }} />
                  {challenge.type === "adherence_target" && (
                    <input value={checkinProof} onChange={(e) => setCheckinProof(e.target.value)}
                      placeholder="Link to proof/photo (optional)"
                      style={{
                        width: "100%", background: B.card, border: `1px solid ${B.border}`, borderRadius: 8,
                        padding: "10px 12px", color: B.text, fontSize: 14, outline: "none",
                        boxSizing: "border-box", marginBottom: 8
                      }} />
                  )}
                  <button onClick={handleCheckin}
                    style={{
                      background: B.accent, color: "#fff", border: "none", borderRadius: 8,
                      padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                      opacity: checkinComment.trim() ? 1 : 0.5
                    }}>Submit Check-in</button>
                </div>
              )}

              {/* Check-in count */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 0", borderBottom: `1px solid ${B.border}`
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: B.text }}>
                  {checkedInCount} of {totalParticipants} members checked in today
                </span>
                <div style={{
                  background: checkedInCount === totalParticipants ? `${B.accent}18` : `${B.orange || B.accent}18`,
                  color: checkedInCount === totalParticipants ? B.accent : B.orange || B.accent,
                  fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 8
                }}>
                  {Math.round((checkedInCount / Math.max(totalParticipants, 1)) * 100)}%
                </div>
              </div>

              {/* Social check-in feed */}
              {todaysCheckins.length === 0 && (
                <div style={{ textAlign: "center", padding: 30, color: B.dim, fontSize: 14 }}>
                  No check-ins yet today. Be the first!
                </div>
              )}
              {todaysCheckins.map((sub) => {
                const isCoachCheckin = sub.memberId === meId;
                const subLikes = sub.likes || [];
                const isLiked = subLikes.includes(meId);
                return (
                  <div key={sub.id} style={{
                    background: B.dark, borderRadius: 12, padding: 16,
                    border: `1px solid ${isCoachCheckin ? `${B.accent}30` : B.border}`,
                    transition: "border-color 0.2s"
                  }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <Avatar name={sub.memberName} size={38} B={B} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: B.text }}>{sub.memberName}</span>
                          {isCoachCheckin && (
                            <span style={{
                              background: `${B.accent}20`, color: B.accent, fontSize: 10, fontWeight: 700,
                              padding: "2px 6px", borderRadius: 5
                            }}>YOU</span>
                          )}
                          {sub.memberName === "Coach" && sub.memberId === "coach" && !isCoachCheckin && (
                            <span style={{
                              background: B.accent, color: "#fff", fontSize: 10, fontWeight: 700,
                              padding: "2px 6px", borderRadius: 5
                            }}>COACH</span>
                          )}
                          <span style={{ fontSize: 12, color: B.dim }}>{timeAgo(sub.timestamp)}</span>
                        </div>

                        {/* Check-in comment */}
                        <div style={{
                          fontSize: 14, color: B.text, lineHeight: 1.5, marginBottom: 8,
                          whiteSpace: "pre-wrap", wordBreak: "break-word"
                        }}>{sub.comment}</div>

                        {/* Badges row */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {/* Proof link badge */}
                          {challenge.type === "adherence_target" && sub.proof && (
                            <a href={sub.proof} target="_blank" rel="noopener noreferrer" style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              background: `${B.blue || B.accent}15`, color: B.blue || B.accent,
                              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
                              textDecoration: "none", transition: "background 0.2s"
                            }}>
                              <TargetIcon size={12} color={B.blue || B.accent} /> Proof Submitted
                            </a>
                          )}

                          {/* Verification badge */}
                          {challenge.type === "adherence_target" && sub.verified === true && (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              background: `${B.accent}15`, color: B.accent,
                              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6
                            }}>
                              <CheckIcon size={12} color={B.accent} /> Verified
                            </span>
                          )}
                          {challenge.type === "adherence_target" && sub.verified === false && (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              background: `${B.red}15`, color: B.red,
                              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6
                            }}>
                              <XIcon size={12} color={B.red} /> Rejected
                            </span>
                          )}
                          {challenge.type === "adherence_target" && sub.verified === null && (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              background: `${B.orange || "#f0a030"}15`, color: B.orange || "#f0a030",
                              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6
                            }}>
                              <ClockIcon size={12} color={B.orange || "#f0a030"} /> Pending Review
                            </span>
                          )}
                        </div>

                        {/* Like button */}
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center" }}>
                          <button
                            onClick={() => handleToggleCheckinLike(sub.memberId, sub.id)}
                            style={{
                              background: "none", border: "none", cursor: "pointer", display: "flex",
                              alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 6,
                              color: isLiked ? B.red : B.muted, fontSize: 13, fontWeight: 500,
                              transition: "color 0.15s"
                            }}
                          >
                            <HeartIcon filled={isLiked} size={15} color={isLiked ? B.red : B.muted} />
                            {subLikes.length > 0 && <span>{subLikes.length}</span>}
                            {subLikes.length === 0 && <span>Like</span>}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Waiting for check-in section */}
              {todaysMissing.length > 0 && (
                <div style={{
                  background: `${B.muted}08`, borderRadius: 12, padding: 14,
                  border: `1px solid ${B.border}`
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: B.dim, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <ClockIcon size={14} color={B.dim} />
                    Waiting for check-in
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {todaysMissing.map((m) => (
                      <div key={m.memberId} style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
                        background: `${B.muted}10`, borderRadius: 8
                      }}>
                        <Avatar name={m.memberName} size={24} style={{ opacity: 0.5 }} B={B} />
                        <span style={{ fontSize: 12, color: B.dim }}>{m.memberName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ LEADERBOARD TAB ═══ */}
          {activeTab === "leaderboard" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: B.muted, lineHeight: "28px" }}>Sort:</span>
                {["streak", "completion", "name"].map((s) => (
                  <button key={s} onClick={() => setLeaderboardSort(s)} style={{
                    background: leaderboardSort === s ? `${B.accent}18` : "transparent",
                    border: `1px solid ${leaderboardSort === s ? B.accent : B.border}`,
                    borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 500,
                    color: leaderboardSort === s ? B.accent : B.muted, cursor: "pointer"
                  }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {leaderboardData.map((row, idx) => {
                  const subs = challenge.submissions[row.memberId] || [];
                  return (
                    <div key={row.memberId} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                      background: B.dark, borderRadius: 10, border: `1px solid ${B.border}`
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: B.muted, width: 20, textAlign: "center" }}>
                        {idx + 1}
                      </span>
                      <Avatar name={row.name} size={32} B={B} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: B.text }}>{row.name}</div>
                        <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: B.muted, display: "flex", alignItems: "center", gap: 3 }}>
                            <FlameIcon size={12} color={row.streak >= 5 ? B.orange || B.accent : B.muted} />
                            {row.streak} day streak
                          </span>
                          <span style={{ fontSize: 12, color: B.muted }}>
                            {row.totalCheckins}/{row.daysCompleted} days ({row.completionRate}%)
                          </span>
                          {challenge.type === "adherence_target" && (
                            <span style={{ fontSize: 12, color: B.muted }}>
                              {row.verifiedCount} verified
                            </span>
                          )}
                        </div>
                        {/* Day dots */}
                        <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                          {Array.from({ length: stats.totalDays }, (_, d) => {
                            const dateStr = toDateStr(new Date(new Date(challenge.startDate + "T00:00:00Z").getTime() + d * 86400000));
                            const sub = subs.find((s) => s.date === dateStr);
                            const isFuture = dateStr > today;
                            let color = `${B.muted}30`; // future/grey
                            if (!isFuture && sub) {
                              if (challenge.type === "adherence_target") {
                                if (sub.verified === true) color = B.accent;
                                else if (sub.verified === false) color = B.red;
                                else color = B.orange || "#f0a030";
                              } else {
                                color = B.accent;
                              }
                            } else if (!isFuture && !sub) {
                              color = `${B.red}60`;
                            }
                            return (
                              <div key={d} title={`Day ${d + 1} (${dateStr})`} style={{
                                width: 10, height: 10, borderRadius: "50%", background: color,
                                flexShrink: 0
                              }} />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ COACH REVIEW TAB ═══ */}
          {activeTab === "review" && isStaff && challenge.type === "adherence_target" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                {["pending", "approved", "rejected", "all"].map((f) => (
                  <button key={f} onClick={() => setReviewFilter(f)} style={{
                    background: reviewFilter === f ? `${B.accent}18` : "transparent",
                    border: `1px solid ${reviewFilter === f ? B.accent : B.border}`,
                    borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 500,
                    color: reviewFilter === f ? B.accent : B.muted, cursor: "pointer",
                    textTransform: "capitalize"
                  }}>{f}</button>
                ))}
                {totalPending > 0 && (
                  <button onClick={handleApproveAllToday} style={{
                    marginLeft: "auto", background: B.accent, color: "#fff", border: "none",
                    borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer"
                  }}>Approve All Today</button>
                )}
              </div>
              {allPendingReviews.length === 0 && (
                <div style={{ textAlign: "center", padding: 30, color: B.dim, fontSize: 14 }}>
                  No submissions match this filter.
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allPendingReviews.map((sub) => (
                  <div key={sub.id} style={{
                    padding: 14, background: B.dark, borderRadius: 10,
                    border: `1px solid ${sub.verified === null ? `${B.orange || B.accent}40` : B.border}`
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <Avatar name={sub.memberName} size={28} B={B} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: B.text }}>{sub.memberName}</span>
                        <span style={{ fontSize: 11, color: B.dim, marginLeft: 8 }}>{sub.date}</span>
                      </div>
                      {sub.verified === true && <span style={{ fontSize: 11, color: B.accent, fontWeight: 600 }}>Approved</span>}
                      {sub.verified === false && <span style={{ fontSize: 11, color: B.red, fontWeight: 600 }}>Rejected</span>}
                      {sub.verified === null && <span style={{ fontSize: 11, color: B.orange || B.accent, fontWeight: 600 }}>Pending</span>}
                    </div>
                    <div style={{ fontSize: 14, color: B.text, marginBottom: 6, lineHeight: 1.4 }}>{sub.comment}</div>
                    {sub.proof && (
                      <a href={sub.proof} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: B.blue || B.accent, textDecoration: "underline", display: "block", marginBottom: 8, wordBreak: "break-all" }}>
                        {sub.proof}
                      </a>
                    )}
                    {sub.verified === null && (
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button onClick={() => handleVerify(sub.memberId, sub.id, true)} style={{
                          background: B.accent, color: "#fff", border: "none", borderRadius: 6,
                          padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 4
                        }}><CheckIcon size={12} color="#fff" /> Approve</button>
                        <button onClick={() => handleVerify(sub.memberId, sub.id, false)} style={{
                          background: B.red, color: "#fff", border: "none", borderRadius: 6,
                          padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 4
                        }}><XIcon size={12} color="#fff" /> Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ DAILY BREAKDOWN TAB ═══ */}
          {activeTab === "daily" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 400, overflowY: "auto" }}>
              {dailyData.map((day) => (
                <div key={day.date} style={{
                  background: B.dark, borderRadius: 10, padding: 14, border: `1px solid ${B.border}`
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                    fontWeight: 600, fontSize: 13, color: B.text
                  }}>
                    <CalendarIcon size={14} color={B.accent} />
                    Day {day.dayNum} — {formatDateShort(day.date)}
                    <span style={{ fontSize: 12, color: B.muted, fontWeight: 400, marginLeft: "auto" }}>
                      {day.submissions.length}/{challenge.participants.length} checked in
                    </span>
                  </div>
                  {day.submissions.map((sub) => (
                    <div key={sub.id} style={{
                      display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, paddingLeft: 8
                    }}>
                      <Avatar name={sub.memberName} size={22} B={B} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: 12, color: B.text }}>{sub.memberName}</span>
                        <span style={{ fontSize: 12, color: B.muted, marginLeft: 6 }}>{sub.comment}</span>
                      </div>
                      {challenge.type === "adherence_target" && sub.verified === true && (
                        <CheckIcon size={14} color={B.accent} />
                      )}
                      {challenge.type === "adherence_target" && sub.verified === false && (
                        <XIcon size={14} color={B.red} />
                      )}
                    </div>
                  ))}
                  {day.missing.length > 0 && (
                    <div style={{ fontSize: 12, color: B.red, marginTop: 4, paddingLeft: 8, opacity: 0.8 }}>
                      Missing: {day.missing.join(", ")}
                    </div>
                  )}
                </div>
              ))}
              {dailyData.length === 0 && (
                <div style={{ textAlign: "center", padding: 30, color: B.dim, fontSize: 14 }}>
                  Challenge hasn't started yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Create Challenge Modal ── */
function CreateChallengeModal({ onClose, onCreate, B }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("adherence");
  const [targetDescription, setTargetDescription] = useState("");
  const [startDate, setStartDate] = useState(localISO());
  const [endDate, setEndDate] = useState(localISO(new Date(Date.now() + 30 * 86400000)));
  const [prize, setPrize] = useState("");
  const [prizeType, setPrizeType] = useState("none");

  const handleCreate = () => {
    if (!title.trim() || !description.trim() || !startDate || !endDate) return;
    const challenge = {
      id: uuid(),
      title: title.trim(),
      description: description.trim(),
      type,
      targetDescription: type === "adherence_target" ? targetDescription.trim() : "",
      startDate,
      endDate,
      createdBy: "coach",
      createdAt: new Date().toISOString(),
      participants: [],
      submissions: {},
      dailyPosts: {},
      prize: prize.trim(),
      prizeType,
    };
    onCreate(challenge);
    onClose();
  };

  const typeCardStyle = (selected) => ({
    flex: 1, padding: 16, borderRadius: 12, cursor: "pointer",
    border: `2px solid ${selected ? B.accent : B.border}`,
    background: selected ? `${B.accent}10` : B.dark,
    transition: "all 0.2s"
  });

  const inputStyle = {
    width: "100%", background: B.dark, border: `1px solid ${B.border}`, borderRadius: 8,
    padding: "10px 12px", color: B.text, fontSize: 14, outline: "none", fontFamily: "inherit",
    boxSizing: "border-box"
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: B.card, borderRadius: 16, width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflow: "auto", border: `1px solid ${B.border}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)", padding: 24
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: B.text, display: "flex", alignItems: "center", gap: 8 }}>
            {"\uD83C\uDFC6"} Start a Challenge
          </h2>
          <button onClick={onClose} style={{
            background: B.dark, border: `1px solid ${B.border}`, borderRadius: "50%",
            width: 32, height: 32, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center"
          }}><XIcon size={14} color={B.muted} /></button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: B.text, display: "block", marginBottom: 6 }}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 30-Day Nutrition Challenge"
            style={inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: B.text, display: "block", marginBottom: 6 }}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the challenge, rules, and what participants need to do..."
            rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: B.text, display: "block", marginBottom: 10 }}>Challenge Type</label>
          <div style={{ display: "flex", gap: 12 }}>
            <div onClick={() => setType("adherence")} style={typeCardStyle(type === "adherence")}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{"\uD83D\uDCCB"}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: B.text, marginBottom: 4 }}>Adherence Only</div>
              <div style={{ fontSize: 12, color: B.muted, lineHeight: 1.4 }}>
                Members check in daily by commenting. Track who shows up.
              </div>
            </div>
            <div onClick={() => setType("adherence_target")} style={typeCardStyle(type === "adherence_target")}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{"\uD83C\uDFAF"}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: B.text, marginBottom: 4 }}>Adherence + Target</div>
              <div style={{ fontSize: 12, color: B.muted, lineHeight: 1.4 }}>
                Members check in daily AND must hit a specific measurable target. Coach reviews submissions.
              </div>
            </div>
          </div>
        </div>

        {type === "adherence_target" && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: B.text, display: "block", marginBottom: 6 }}>
              What's the daily target?
            </label>
            <input value={targetDescription} onChange={(e) => setTargetDescription(e.target.value)}
              placeholder="e.g. Hit 10,000 steps daily" style={inputStyle} />
          </div>
        )}

        {/* Prize */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: B.text, display: "block", marginBottom: 10 }}>Prize (optional)</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {[
              { key: "none", label: "No Prize", icon: "" },
              { key: "physical", label: "Physical", icon: "\uD83C\uDF81" },
              { key: "credit", label: "Account Credit", icon: "\uD83D\uDCB0" },
              { key: "badge", label: "Badge/Title", icon: "\uD83C\uDFC5" },
              { key: "discount", label: "Discount", icon: "\uD83C\uDFF7\uFE0F" },
              { key: "other", label: "Other", icon: "\u2B50" },
            ].map(p => (
              <button key={p.key} onClick={() => setPrizeType(p.key)} style={{
                padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600,
                border: prizeType === p.key ? `2px solid ${B.accent}` : `1px solid ${B.border}`,
                background: prizeType === p.key ? B.accent + "15" : B.dark,
                color: prizeType === p.key ? B.accent : B.muted,
                transition: "all 0.15s",
              }}>{p.icon} {p.label}</button>
            ))}
          </div>
          {prizeType !== "none" && (
            <input value={prize} onChange={(e) => setPrize(e.target.value)}
              placeholder={prizeType === "physical" ? "e.g. Free t-shirt, water bottle" : prizeType === "credit" ? "e.g. $25 account credit" : prizeType === "discount" ? "e.g. 20% off next month" : prizeType === "badge" ? "e.g. Challenge Champion badge" : "Describe the prize..."}
              style={inputStyle} />
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: B.text, display: "block", marginBottom: 6 }}>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: B.text, display: "block", marginBottom: 6 }}>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <button onClick={handleCreate} style={{
          width: "100%", padding: "12px 0", background: B.accent, color: "#fff", border: "none",
          borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer",
          opacity: (title.trim() && description.trim() && startDate && endDate) ? 1 : 0.5
        }}>Create Challenge</button>
      </div>
    </div>
  );
}

/* ── Challenge Feed Card ── */
function ChallengeFeedCard({ challenge, onClick, B, meId = "coach" }) {
  const stats = getChallengeStats(challenge, meId);
  const isParticipant = challenge.participants.includes(meId);
  const progressPct = Math.round((stats.elapsedDays / stats.totalDays) * 100);

  return (
    <Card style={{ padding: 0, overflow: "hidden", cursor: "pointer" }} onClick={onClick}>
      {/* Gradient banner */}
      <div style={{
        background: `linear-gradient(135deg, ${B.accent}, ${B.orange || B.accent}dd)`,
        padding: "14px 16px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 18 }}>{"\uD83C\uDFC6"}</span>
          <span style={{
            background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 10, fontWeight: 700,
            padding: "2px 8px", borderRadius: 5, letterSpacing: 0.8
          }}>CHALLENGE</span>
          {challenge.type === "adherence_target" && (
            <span style={{
              background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 10, fontWeight: 600,
              padding: "2px 8px", borderRadius: 5
            }}>{"\uD83C\uDFAF"} Target</span>
          )}
          <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
            Day {stats.currentDay} of {stats.totalDays}
          </span>
        </div>
        <h3 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>{challenge.title}</h3>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, margin: 0, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {challenge.description}
        </p>
      </div>

      <div style={{ padding: "12px 16px 16px" }}>
        {challenge.type === "adherence_target" && (
          <div style={{
            display: "inline-block", background: `${B.orange || B.accent}18`,
            color: B.orange || B.accent, fontSize: 12, fontWeight: 600,
            padding: "3px 10px", borderRadius: 6, marginBottom: 10
          }}>{"\uD83C\uDFAF"} Daily Target: {challenge.targetDescription}</div>
        )}
        {challenge.prize && challenge.prizeType !== "none" && (
          <div style={{
            display: "inline-block", background: "#fbbf2418",
            color: "#fbbf24", fontSize: 12, fontWeight: 600,
            padding: "4px 12px", borderRadius: 6, marginBottom: 10, marginLeft: challenge.type === "adherence_target" ? 8 : 0,
          }}>
            {challenge.prizeType === "physical" ? "\uD83C\uDF81" : challenge.prizeType === "credit" ? "\uD83D\uDCB0" : challenge.prizeType === "discount" ? "\uD83C\uDFF7\uFE0F" : challenge.prizeType === "badge" ? "\uD83C\uDFC5" : "\u2B50"}{" "}
            Prize: {challenge.prize}
          </div>
        )}

        <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: B.muted, display: "flex", alignItems: "center", gap: 4 }}>
            <CalendarIcon size={13} color={B.muted} />
            {formatDateShort(challenge.startDate)} - {formatDateShort(challenge.endDate)}
          </span>
          <span style={{ fontSize: 12, color: B.muted, display: "flex", alignItems: "center", gap: 4 }}>
            <UsersIcon size={13} color={B.muted} />
            {challenge.participants.length} members joined
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ background: `${B.muted}20`, borderRadius: 5, height: 6, overflow: "hidden", marginBottom: 10 }}>
          <div style={{
            width: `${progressPct}%`, height: "100%", background: B.accent,
            borderRadius: 5, transition: "width 0.3s"
          }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: B.dim }}>{progressPct}% complete</span>
          {isParticipant ? (
            <span style={{
              background: `${B.accent}18`, color: B.accent, fontSize: 12, fontWeight: 600,
              padding: "4px 12px", borderRadius: 6
            }}>Joined</span>
          ) : (
            <span style={{
              background: B.accent, color: "#fff", fontSize: 12, fontWeight: 600,
              padding: "4px 12px", borderRadius: 6
            }}>Join Challenge</span>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────
   Main CommunityFeed Component
   ────────────────────────────────────────────── */

export default function CommunityFeed() {
  const B = useTheme();
  const { members } = useMembers();
  const { isStaff, currentUser } = useAuth();
  const staffName = currentUser?.displayName || currentUser?.username || "Coach";
  const staffId = currentUser?.id || "coach";
  const [posts, setPosts] = useLocalStorage("hf_community_posts", []);
  const [categories] = useLocalStorage("hf_community_categories", DEFAULT_CATEGORIES);
  const [challengesRaw, setChallenges] = useLocalStorage("hf_challenges", []);
  const challenges = Array.isArray(challengesRaw) ? challengesRaw : [];

  const [activeCategory, setActiveCategory] = useState("All");
  const [sortMode, setSortMode] = useState("default"); // default | new | top
  const [composing, setComposing] = useState(false);
  const [composeText, setComposeText] = useState("");
  const [composeCategory, setComposeCategory] = useState("General");
  const [composeMediaType, setComposeMediaType] = useState(null);
  const [composeMediaUrl, setComposeMediaUrl] = useState("");
  const [composePollOptions, setComposePollOptions] = useState(["", ""]);
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [menuOpen, setMenuOpen] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPostText, setEditPostText] = useState("");

  // Challenge state
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);

  // Click outside to close menus
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpen]);

  /* ── Points calculation ── */
  const authorPoints = useMemo(() => {
    const pts = {};
    const add = (id, n) => { pts[id] = (pts[id] || 0) + n; };
    posts.forEach((p) => {
      add(p.authorId, (p.likes || []).length);
      (p.comments || []).forEach((c) => {
        add(c.authorId, (c.likes || []).length);
        (c.replies || []).forEach((r) => add(r.authorId, (r.likes || []).length));
      });
    });
    return pts;
  }, [posts]);

  /* ── Active challenges ── */
  const activeChallenges = useMemo(() => {
    const todayStr = localISO();
    return challenges.filter((c) => c.startDate <= todayStr && c.endDate >= todayStr);
  }, [challenges]);

  /* ── Build combined feed items (posts + challenge cards) ── */
  const feedItems = useMemo(() => {
    // Regular posts
    const postItems = posts.map((p) => ({ type: "post", data: p, sortTime: p.createdAt }));

    // Challenge items as pseudo-posts for the feed
    const challengeItems = challenges.map((c) => {
      // Latest activity: most recent submission timestamp
      let latestSub = new Date(c.createdAt).getTime();
      Object.values(c.submissions).forEach((subs) => {
        subs.forEach((s) => {
          const t = new Date(s.timestamp).getTime();
          if (t > latestSub) latestSub = t;
        });
      });
      return {
        type: "challenge",
        data: c,
        sortTime: new Date(latestSub).toISOString(),
        createdAt: c.createdAt
      };
    });

    return [...postItems, ...challengeItems];
  }, [posts, challenges]);

  /* ── Filtering & sorting ── */
  const filteredItems = useMemo(() => {
    let list;
    if (activeCategory === "All") {
      list = [...feedItems];
    } else if (activeCategory === "Challenges") {
      list = feedItems.filter((item) => item.type === "challenge");
    } else {
      list = feedItems.filter((item) => item.type === "post" && item.data.category === activeCategory);
    }

    // latest activity timestamp for a post
    const latestActivity = (item) => {
      if (item.type === "challenge") {
        return new Date(item.sortTime).getTime();
      }
      const p = item.data;
      let latest = new Date(p.createdAt).getTime();
      (p.comments || []).forEach((c) => {
        latest = Math.max(latest, new Date(c.timestamp ?? c.createdAt).getTime());
        (c.replies || []).forEach((r) => { latest = Math.max(latest, new Date(r.timestamp ?? r.createdAt).getTime()); });
      });
      return latest;
    };

    if (sortMode === "new") {
      list.sort((a, b) => new Date(b.type === "challenge" ? b.data.createdAt : b.data.createdAt) - new Date(a.type === "challenge" ? a.data.createdAt : a.data.createdAt));
    } else if (sortMode === "top") {
      list.sort((a, b) => {
        const aScore = a.type === "post" ? (a.data.likes || []).length : a.data.participants.length;
        const bScore = b.type === "post" ? (b.data.likes || []).length : b.data.participants.length;
        return bScore - aScore;
      });
    } else {
      list.sort((a, b) => latestActivity(b) - latestActivity(a));
    }

    // Pinned posts at top (challenges don't pin)
    const pinned = list.filter((item) => item.type === "post" && item.data.pinned);
    const rest = list.filter((item) => !(item.type === "post" && item.data.pinned));
    return [...pinned, ...rest];
  }, [feedItems, activeCategory, sortMode]);

  /* ── Category post counts ── */
  const catCounts = useMemo(() => {
    const counts = { All: posts.length + challenges.length, Challenges: challenges.length };
    categories.forEach((c) => {
      if (c === "Challenges") {
        counts[c] = challenges.length;
      } else {
        counts[c] = posts.filter((p) => p.category === c).length;
      }
    });
    return counts;
  }, [posts, challenges, categories]);

  /* ── Actions ── */
  const handlePost = useCallback(() => {
    if (!composeText.trim() && composeMediaType !== "poll") return;
    const newPost = {
      id: uuid(),
      authorId: staffId,
      authorName: staffName,
      category: composeCategory,
      content: composeText.trim(),
      mediaType: composeMediaType,
      mediaUrl: composeMediaType === "video" || composeMediaType === "image" ? composeMediaUrl : "",
      pollOptions: composeMediaType === "poll"
        ? composePollOptions.filter((o) => o.trim()).map((t) => ({ text: t.trim(), votes: [] }))
        : [],
      likes: [],
      comments: [],
      pinned: false,
      createdAt: new Date().toISOString(),
    };
    setPosts((prev) => [newPost, ...prev]);
    setComposeText("");
    setComposeCategory("General");
    setComposeMediaType(null);
    setComposeMediaUrl("");
    setComposePollOptions(["", ""]);
    setComposing(false);
  }, [composeText, composeCategory, composeMediaType, composeMediaUrl, composePollOptions, setPosts]);

  const toggleLike = useCallback((postId) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const likes = p.likes || [];
        const liked = likes.includes(staffId);
        return { ...p, likes: liked ? likes.filter((l) => l !== staffId) : [...likes, staffId] };
      })
    );
  }, [setPosts, staffId]);

  const toggleCommentLike = useCallback((postId, commentId) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: (p.comments || []).map((c) => {
            if (c.id === commentId) {
              const likes = c.likes || [];
              const liked = likes.includes(staffId);
              return { ...c, likes: liked ? likes.filter((l) => l !== staffId) : [...likes, staffId] };
            }
            return {
              ...c,
              replies: (c.replies || []).map((r) => {
                if (r.id === commentId) {
                  const likes = r.likes || [];
                  const liked = likes.includes(staffId);
                  return { ...r, likes: liked ? likes.filter((l) => l !== staffId) : [...likes, staffId] };
                }
                return r;
              })
            };
          })
        };
      })
    );
  }, [setPosts, staffId]);

  const addComment = useCallback((postId) => {
    const text = (commentInputs[postId] || "").trim();
    if (!text) return;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const ts = new Date().toISOString();
        return {
          ...p,
          comments: [
            ...(p.comments || []),
            { id: uuid(), authorId: staffId, authorName: staffName, text, content: text, likes: [], timestamp: ts, createdAt: ts, replies: [] }
          ]
        };
      })
    );
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
  }, [commentInputs, setPosts, staffId, staffName]);

  const addReply = useCallback((postId, commentId, text) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const ts = new Date().toISOString();
        return {
          ...p,
          comments: (p.comments || []).map((c) => {
            if (c.id !== commentId) return c;
            return {
              ...c,
              replies: [
                ...(c.replies || []),
                { id: uuid(), authorId: staffId, authorName: staffName, text, content: text, likes: [], timestamp: ts, createdAt: ts, replies: [] }
              ]
            };
          })
        };
      })
    );
  }, [setPosts, staffId, staffName]);

  const togglePin = useCallback((postId) => {
    setPosts((prev) => {
      const pinnedCount = prev.filter((p) => p.pinned && p.id !== postId).length;
      return prev.map((p) => {
        if (p.id !== postId) return p;
        if (!p.pinned && pinnedCount >= 3) return p; // max 3 pinned
        return { ...p, pinned: !p.pinned };
      });
    });
    setMenuOpen(null);
  }, [setPosts]);

  const handleVote = useCallback((postId, optionIndex) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const already = p.pollOptions.some((o) => o.votes.includes(staffId));
        if (already) return p;
        return {
          ...p,
          pollOptions: p.pollOptions.map((o, i) =>
            i === optionIndex ? { ...o, votes: [...o.votes, staffId] } : o
          )
        };
      })
    );
  }, [setPosts, staffId]);

  const handleCreateChallenge = useCallback((challenge) => {
    setChallenges((prev) => [challenge, ...prev]);
  }, [setChallenges]);

  const handleUpdateChallenge = useCallback((updated) => {
    setChallenges((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setSelectedChallenge(updated);
  }, [setChallenges]);

  const totalComments = (p) => (p.comments || []).reduce((s, c) => s + 1 + (c.replies || []).length, 0);

  /* ── Styles ── */
  const btnBase = { background: "none", border: "none", cursor: "pointer", padding: 0 };
  const pillBase = (active) => ({
    padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
    border: `1px solid ${active ? B.accent : B.border}`,
    background: active ? `${B.accent}18` : "transparent",
    color: active ? B.accent : B.muted,
    cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s"
  });
  const sortTab = (active) => ({
    ...btnBase, fontSize: 13, fontWeight: active ? 600 : 400,
    color: active ? B.accent : B.muted,
    borderBottom: active ? `2px solid ${B.accent}` : "2px solid transparent",
    paddingBottom: 6, marginRight: 16
  });
  const toolbarBtn = {
    ...btnBase, display: "flex", alignItems: "center", gap: 4, padding: "6px 10px",
    borderRadius: 8, fontSize: 13, color: B.muted, fontWeight: 500,
    transition: "background 0.15s"
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px" }}>
      {/* Header */}
      <h1 style={{ fontSize: 26, fontWeight: 700, color: B.text, margin: "24px 0 16px" }}>Community</h1>

      {/* Stories — broadcast to every member and coach at this location */}
      <StoriesBar me={{ id: staffId, name: staffName, photo: currentUser?.photo || "" }} />

      {/* Active Challenges Banner */}
      {activeChallenges.length > 0 && activeCategory !== "Challenges" && (
        <div
          onClick={() => setActiveCategory("Challenges")}
          style={{
            background: `linear-gradient(135deg, ${B.accent}15, ${B.orange || B.accent}15)`,
            border: `1px solid ${B.accent}30`,
            borderRadius: 12, padding: "12px 16px", marginBottom: 16, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10, transition: "background 0.2s"
          }}>
          <span style={{ fontSize: 20 }}>{"\uD83C\uDFC6"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: B.text }}>
              {activeChallenges.length} Active Challenge{activeChallenges.length !== 1 ? "s" : ""}
            </div>
            <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>
              {activeChallenges.map((c) => c.title).join(" \u2022 ")}
            </div>
          </div>
          <span style={{ fontSize: 12, color: B.accent, fontWeight: 600 }}>View All &rarr;</span>
        </div>
      )}

      {/* Category tabs */}
      <div style={{
        display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16,
        scrollbarWidth: "none", msOverflowStyle: "none"
      }}>
        {["All", ...categories].map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)} style={pillBase(activeCategory === cat)}>
            {cat === "Challenges" && "\uD83C\uDFC6 "}{cat}{" "}
            <span style={{ opacity: 0.7, fontSize: 11 }}>{catCounts[cat] || 0}</span>
          </button>
        ))}
      </div>

      {/* Compose box + Start Challenge button */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "stretch" }}>
        <Card style={{ flex: 1, padding: composing ? 16 : 12, marginBottom: 0 }}>
          {!composing ? (
            <div onClick={() => setComposing(true)}
              style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <Avatar name={staffName} size={40} B={B} />
              <div style={{
                flex: 1, padding: "10px 14px", borderRadius: 20,
                background: B.dark, border: `1px solid ${B.border}`,
                color: B.dim, fontSize: 14
              }}>What's on your mind?</div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <Avatar name={staffName} size={40} B={B} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: B.text }}>{staffName}</span>
                    <select value={composeCategory} onChange={(e) => setComposeCategory(e.target.value)}
                      style={{
                        background: B.dark, border: `1px solid ${B.border}`, borderRadius: 8,
                        padding: "3px 8px", color: B.text, fontSize: 12, outline: "none"
                      }}>
                      {categories.filter((c) => c !== "Challenges").map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    placeholder="Share something with the community..."
                    autoFocus
                    rows={4}
                    style={{
                      width: "100%", background: "transparent", border: "none", color: B.text,
                      fontSize: 15, lineHeight: 1.5, resize: "vertical", outline: "none",
                      fontFamily: "inherit"
                    }}
                  />
                </div>
              </div>

              {/* Media type inputs */}
              {composeMediaType === "video" && (
                <input value={composeMediaUrl} onChange={(e) => setComposeMediaUrl(e.target.value)}
                  placeholder="Paste YouTube URL..."
                  style={{
                    width: "100%", background: B.dark, border: `1px solid ${B.border}`, borderRadius: 8,
                    padding: "8px 12px", color: B.text, fontSize: 13, marginBottom: 8, outline: "none",
                    boxSizing: "border-box"
                  }}/>
              )}
              {composeMediaType === "image" && (
                <div style={{ marginBottom: 8 }}>
                  <ImageUploadZone value={composeMediaUrl} onChange={(url) => setComposeMediaUrl(url)} label="Upload Image" />
                </div>
              )}
              {composeMediaType === "poll" && (
                <div style={{ marginBottom: 8 }}>
                  {composePollOptions.map((opt, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <input value={opt}
                        onChange={(e) => {
                          const next = [...composePollOptions];
                          next[i] = e.target.value;
                          setComposePollOptions(next);
                        }}
                        placeholder={`Option ${i + 1}`}
                        style={{
                          flex: 1, background: B.dark, border: `1px solid ${B.border}`, borderRadius: 8,
                          padding: "8px 12px", color: B.text, fontSize: 13, outline: "none"
                        }}/>
                      {composePollOptions.length > 2 && (
                        <button onClick={() => setComposePollOptions((prev) => prev.filter((_, j) => j !== i))}
                          style={{ ...btnBase, color: B.red, fontSize: 18, padding: "0 4px" }}>&times;</button>
                      )}
                    </div>
                  ))}
                  {composePollOptions.length < 6 && (
                    <button onClick={() => setComposePollOptions((prev) => [...prev, ""])}
                      style={{ ...btnBase, color: B.accent, fontSize: 13, fontWeight: 600 }}>+ Add option</button>
                  )}
                </div>
              )}

              {/* Toolbar */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderTop: `1px solid ${B.border}`, paddingTop: 10, marginTop: 4
              }}>
                <div style={{ display: "flex", gap: 2 }}>
                  <button onClick={() => setComposeMediaType(composeMediaType === "video" ? null : "video")}
                    style={{ ...toolbarBtn, background: composeMediaType === "video" ? `${B.accent}18` : "transparent", color: composeMediaType === "video" ? B.accent : B.muted }}>
                    <VideoIcon size={16} color={composeMediaType === "video" ? B.accent : B.muted} /> Video
                  </button>
                  <button onClick={() => setComposeMediaType(composeMediaType === "image" ? null : "image")}
                    style={{ ...toolbarBtn, background: composeMediaType === "image" ? `${B.accent}18` : "transparent", color: composeMediaType === "image" ? B.accent : B.muted }}>
                    <ImageIcon size={16} color={composeMediaType === "image" ? B.accent : B.muted} /> Image
                  </button>
                  <button onClick={() => setComposeMediaType(composeMediaType === "poll" ? null : "poll")}
                    style={{ ...toolbarBtn, background: composeMediaType === "poll" ? `${B.accent}18` : "transparent", color: composeMediaType === "poll" ? B.accent : B.muted }}>
                    <PollIcon size={16} color={composeMediaType === "poll" ? B.accent : B.muted} /> Poll
                  </button>
                  <button style={{ ...toolbarBtn, opacity: 0.4, cursor: "default" }}>
                    <span style={{ fontSize: 16 }}>GIF</span>
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setComposing(false); setComposeMediaType(null); }}
                    style={{ ...btnBase, color: B.muted, fontSize: 13, fontWeight: 500, padding: "6px 12px" }}>Cancel</button>
                  <button onClick={handlePost}
                    style={{
                      background: B.accent, color: "#fff", border: "none", borderRadius: 8,
                      padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                      opacity: (!composeText.trim() && composeMediaType !== "poll") ? 0.5 : 1
                    }}>Post</button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Start Challenge button (staff only) */}
        {isStaff && !composing && (
          <button onClick={() => setShowCreateChallenge(true)} style={{
            background: `linear-gradient(135deg, ${B.accent}, ${B.orange || B.accent}dd)`,
            color: "#fff", border: "none", borderRadius: 12, padding: "12px 18px",
            fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
            minWidth: 110, whiteSpace: "nowrap", transition: "opacity 0.2s"
          }}>
            <TrophyIcon size={22} color="#fff" />
            Start Challenge
          </button>
        )}
      </div>

      {/* Sort tabs */}
      <div style={{ display: "flex", marginBottom: 16 }}>
        <button onClick={() => setSortMode("default")} style={sortTab(sortMode === "default")}>Default</button>
        <button onClick={() => setSortMode("new")} style={sortTab(sortMode === "new")}>New</button>
        <button onClick={() => setSortMode("top")} style={sortTab(sortMode === "top")}>Top</button>
      </div>

      {/* Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 40 }}>
        {filteredItems.map((item) => {
          if (item.type === "challenge") {
            return (
              <ChallengeFeedCard
                key={item.data.id}
                challenge={item.data}
                onClick={() => setSelectedChallenge(item.data)}
                B={B}
                meId={staffId}
              />
            );
          }

          const post = item.data;
          const postLikes = post.likes || [];
          const liked = postLikes.includes(staffId);
          const commentsExpanded = expandedComments[post.id];
          const commentCount = totalComments(post);
          const ytId = post.mediaType === "video" ? extractYouTubeId(post.mediaUrl) : null;
          const lvl = communityLevel(authorPoints[post.authorId] || 0);

          return (
            <Card key={post.id} style={{ padding: 0, overflow: "hidden" }}>
              {/* Pinned badge */}
              {post.pinned && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                  background: `${B.accent}08`, borderBottom: `1px solid ${B.border}`,
                  fontSize: 12, color: B.accent, fontWeight: 600
                }}>
                  <PinIcon size={12} color={B.accent} /> Pinned
                </div>
              )}

              <div style={{ padding: 16 }}>
                {/* Post header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                    <Avatar name={post.authorName} size={40} B={B} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: B.text }}>{post.authorName}</span>
                        <LevelBadge level={lvl} B={B} />
                        <CategoryPill cat={post.category} B={B} small />
                      </div>
                      <div style={{ fontSize: 12, color: B.dim, marginTop: 1 }}>{timeAgo(post.createdAt)}</div>
                    </div>
                  </div>
                  {/* Three-dot menu (admin) */}
                  <div style={{ position: "relative" }}>
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === post.id ? null : post.id); }}
                      style={{ ...btnBase, padding: "4px 6px", borderRadius: 6, display: "flex" }}>
                      <MoreIcon size={18} color={B.muted} />
                    </button>
                    {menuOpen === post.id && (
                      <div style={{
                        position: "absolute", right: 0, top: 28, background: B.card,
                        border: `1px solid ${B.border}`, borderRadius: 10, padding: 4,
                        minWidth: 140, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", zIndex: 10
                      }}>
                        {(post.authorId === staffId || isStaff) && (
                          <button onClick={() => { setEditingPostId(post.id); setEditPostText(post.content); setMenuOpen(null); }}
                            style={{
                              ...btnBase, width: "100%", textAlign: "left", padding: "8px 12px",
                              borderRadius: 6, fontSize: 13, color: B.text, display: "flex",
                              alignItems: "center", gap: 8
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = `${B.muted}15`; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                            {"\u270F\uFE0F"} Edit post
                          </button>
                        )}
                        <button onClick={() => togglePin(post.id)}
                          style={{
                            ...btnBase, width: "100%", textAlign: "left", padding: "8px 12px",
                            borderRadius: 6, fontSize: 13, color: B.text, display: "flex",
                            alignItems: "center", gap: 8
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = `${B.muted}15`; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                          <PinIcon size={13} color={B.muted} />
                          {post.pinned ? "Unpin post" : "Pin post"}
                        </button>
                        <button onClick={() => { if (window.confirm("Delete this post? This cannot be undone.")) setPosts(prev => prev.filter(p => p.id !== post.id)); }}
                          style={{
                            ...btnBase, width: "100%", textAlign: "left", padding: "8px 12px",
                            borderRadius: 6, fontSize: 13, color: B.red || "#ef4444", display: "flex",
                            alignItems: "center", gap: 8
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = (B.red || "#ef4444") + "15"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                          {"\uD83D\uDDD1\uFE0F"} Delete post
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Post content */}
                <div style={{
                  fontSize: 15, color: B.text, lineHeight: 1.55, marginBottom: 10,
                  whiteSpace: "pre-wrap", wordBreak: "break-word"
                }}>
                  {editingPostId === post.id ? (
                    <div>
                      <textarea value={editPostText} onChange={e => setEditPostText(e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + B.accent + "60", background: B.darker, color: B.text, fontSize: 15, lineHeight: 1.55, outline: "none", resize: "vertical", minHeight: 80, fontFamily: "inherit", boxSizing: "border-box" }} autoFocus />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => setEditingPostId(null)} style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid " + B.border, background: "transparent", color: B.muted, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                        <button onClick={() => { setPosts(prev => prev.map(p => p.id === post.id ? { ...p, content: editPostText.trim(), editedAt: new Date().toISOString() } : p)); setEditingPostId(null); }}
                          style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: B.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {post.content}
                      {post.editedAt && <span style={{ fontSize: 11, color: B.dim, marginLeft: 6 }}>(edited)</span>}
                    </>
                  )}
                </div>

                {/* Media: YouTube */}
                {post.mediaType === "video" && ytId && (
                  <div style={{
                    position: "relative", paddingBottom: "56.25%", borderRadius: 10,
                    overflow: "hidden", marginBottom: 10, background: "#000"
                  }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${ytId}`}
                      title="Video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{
                        position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                        border: "none"
                      }}
                    />
                  </div>
                )}

                {/* Media: Image */}
                {post.mediaType === "image" && post.mediaUrl && (
                  <img src={post.mediaUrl} alt="Post media" loading="lazy"
                    style={{ width: "100%", maxHeight: 400, objectFit: "cover", borderRadius: 10, marginBottom: 10, display: "block" }} />
                )}

                {/* Media: Poll */}
                {post.mediaType === "poll" && post.pollOptions.length > 0 && (
                  <PollUI options={post.pollOptions} postId={post.id} onVote={handleVote} B={B} meId={staffId} />
                )}

                {/* Actions bar */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 4,
                  paddingTop: 10, borderTop: `1px solid ${B.border}`, marginTop: 4
                }}>
                  <button onClick={() => toggleLike(post.id)}
                    style={{
                      ...btnBase, display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                      color: liked ? B.red : B.muted, transition: "color 0.15s"
                    }}>
                    <HeartIcon filled={liked} size={16} color={liked ? B.red : B.muted} />
                    {postLikes.length > 0 && <span>{postLikes.length}</span>}
                    {postLikes.length === 0 && <span>Like</span>}
                  </button>
                  <button onClick={() => setExpandedComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                    style={{
                      ...btnBase, display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                      color: B.muted
                    }}>
                    <CommentIcon size={16} color={B.muted} />
                    {commentCount > 0 ? commentCount : "Comment"}
                  </button>
                </div>

                {/* Comments section */}
                {commentsExpanded && (
                  <div style={{ marginTop: 8 }}>
                    {(post.comments || []).map((c) => (
                      <Comment key={c.id} c={c} postId={post.id}
                        onLikeComment={toggleCommentLike} onReply={addReply}
                        B={B} authorPoints={authorPoints} meId={staffId} meName={staffName} />
                    ))}
                    {/* Comment input */}
                    <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
                      <Avatar name={staffName} size={30} B={B} />
                      <input
                        value={commentInputs[post.id] || ""}
                        onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addComment(post.id)}
                        placeholder="Write a comment..."
                        style={{
                          flex: 1, background: B.dark, border: `1px solid ${B.border}`, borderRadius: 20,
                          padding: "8px 14px", color: B.text, fontSize: 13, outline: "none"
                        }}
                      />
                      <button onClick={() => addComment(post.id)}
                        style={{
                          background: B.accent, color: "#fff", border: "none", borderRadius: 20,
                          padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                          opacity: (commentInputs[post.id] || "").trim() ? 1 : 0.5
                        }}>Reply</button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {filteredItems.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: B.dim, fontSize: 15 }}>
            {activeCategory === "Challenges"
              ? "No challenges yet. Start one to get your members engaged!"
              : "No posts in this category yet. Be the first to share!"}
          </div>
        )}
      </div>

      {/* Create Challenge Modal */}
      {showCreateChallenge && (
        <CreateChallengeModal
          onClose={() => setShowCreateChallenge(false)}
          onCreate={handleCreateChallenge}
          B={B}
        />
      )}

      {/* Challenge Detail Modal */}
      {selectedChallenge && (
        <ChallengeDetailModal
          challenge={selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
          onUpdate={handleUpdateChallenge}
          B={B}
          isStaff={isStaff}
          meId={staffId}
          members={members}
        />
      )}
    </div>
  );
}
