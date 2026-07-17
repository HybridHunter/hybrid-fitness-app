/*
 * Direct-seed fallback: builds a correctly-shaped gym in the mock store using
 * the exact shapes the Super Admin panel's "create location + demo data" flow
 * writes (SuperAdminPanel.js handleCreateLocation). Used when a UI-driven
 * creation flow fails, so downstream personas can still run.
 */
const crypto = require('crypto');
const uid = () => crypto.randomUUID();

function seedGym(store, { gymId = 'sim-gym-seed', gymName = 'Sim Gym (Seeded)', admin = { username: 'simadmin', password: 'simpass123' } } = {}) {
  const now = new Date().toISOString();

  store.upsert(gymId, 'hf_gym_info', {
    gymId, gymName, phone: '555-0100', email: 'owner@simgym.io',
    address: { street: '1 Sim St', city: 'Simville', state: 'CA', zip: '90000' },
    timezone: 'America/New_York', website: '', createdAt: now, status: 'active',
  });

  store.upsert(gymId, 'hf_users', [
    { id: 'u1', username: admin.username, password: admin.password, role: 'admin', memberId: null, displayName: 'Sim Admin', email: 'simadmin@simgym.io' },
    { id: 'u2', username: 'simcoach', password: 'coachpass123', role: 'coach', memberId: null, displayName: 'Sim Coach', email: 'simcoach@simgym.io' },
  ]);

  store.upsert(gymId, 'hf_subscription', { planId: 'professional', planName: 'Professional', price: 199, status: 'active', createdAt: now });

  const member = (firstName, lastName, email, pin, extra = {}) => ({
    id: uid(), firstName, lastName, email, phone: '555-0101', pin,
    membershipPlanId: 'plan_unlimited', membershipStatus: 'active', photo: '', familyGroupId: null,
    startDate: '2025-09-15', notes: '', tags: [],
    address: { street: '', city: '', state: '', zip: '', country: 'US' },
    movementScores: { Squat: 1, Hinge: 1, Lunge: 1, Push: 1, Pull: 1, Core: 1, Carry: 1 },
    gamification: { level: 2, xp: 200, totalWorkouts: 10, totalWeightLifted: 5000, badges: ['First Workout'], currentStreak: 2, longestStreak: 4 },
    rank: { current: 'White', promotionDate: null },
    inbody: { lastScan: null, history: [] },
    createdAt: now, ...extra,
  });
  store.upsert(gymId, 'hf_members', [
    member('Sarah', 'Johnson', 'sarah@example.com', '1234'),
    member('Mike', 'Chen', 'mike@example.com', '2345'),
    member('Emily', 'Rodriguez', 'emily@example.com', '3456'),
  ]);

  store.upsert(gymId, 'hf_schedule', [
    { id: uid(), name: '6AM Semi-Private', instructor: 'Coach', dayOfWeek: 1, startTime: '06:00', endTime: '06:45', capacity: 8, bookings: [], waitlist: [], recurring: true },
    { id: uid(), name: '5PM Evening', instructor: 'Coach', dayOfWeek: 3, startTime: '17:00', endTime: '17:45', capacity: 8, bookings: [], waitlist: [], recurring: true },
    // One late class every day so booking specs always have a future session
    ...Array.from({ length: 7 }, (_, dow) => ({
      id: uid(), name: 'Late Night Open Gym', instructor: 'Coach', dayOfWeek: dow,
      startTime: '23:00', endTime: '23:45', capacity: 12, bookings: [], waitlist: [], recurring: true,
    })),
  ]);

  store.upsert(gymId, 'hf_plans', [
    { id: 'plan_unlimited', name: 'Unlimited', price: 199, billingCycle: 'monthly', sessionsIncluded: null, description: 'Full access', features: 'Unlimited sessions', active: true },
    { id: 'plan_dropin', name: 'Drop-In', price: 25, billingCycle: 'per-session', sessionsIncluded: 1, description: 'Single session', features: '1 session', active: true },
  ]);

  const registry = store.get('__super__', 'hf_gyms_registry');
  const entry = { gymId, gymName, planId: 'professional', planName: 'Professional', price: 199, adminEmail: 'simadmin@simgym.io', adminUsername: admin.username, status: 'active', createdAt: now, memberCount: 3 };
  store.upsert('__super__', 'hf_gyms_registry', Array.isArray(registry) ? [...registry, entry] : [entry]);

  return gymId;
}

const fs = require('fs');
const path = require('path');
const CREDS_FILE = path.join(__dirname, '..', 'fixtures', 'creds.json');

/**
 * Load creds saved by earlier specs; if missing (e.g. single-spec run after
 * global-setup wiped fixtures), direct-seed a gym and write fresh creds.
 */
function ensureCreds(store) {
  try {
    const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
    if (creds?.gymId && store.get(creds.gymId, 'hf_users')) return creds;
  } catch {}
  const gymId = seedGym(store);
  const creds = {
    gymId,
    admin: { username: 'simadmin', password: 'simpass123' },
    coach: { username: 'simcoach', password: 'coachpass123' },
    demoClient: { email: 'sarah@example.com', pin: '1234' },
    seeded: true,
  };
  fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
  return creds;
}

module.exports = { seedGym, ensureCreds };
