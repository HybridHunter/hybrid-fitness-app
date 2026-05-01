// Netlify Scheduled Function: Auto Check-In
// Runs every 5 minutes, checks all gyms for sessions that have started,
// and auto-checks in booked members.

const SUPABASE_URL = 'https://qzvxnklyeadbroesccxt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnhua2x5ZWFkYnJvZXNjY3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTI5MTgsImV4cCI6MjA5MDcyODkxOH0.nDa1iuZwS0E2j-rGizIvVuPRslYn7ugChPJiW-ejSMM';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function supabaseGet(gymId, key) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/data_store?gym_id=eq.${encodeURIComponent(gymId)}&key=eq.${encodeURIComponent(key)}&select=value`,
    { headers: HEADERS }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows.length > 0 ? rows[0].value : null;
}

async function supabaseUpsert(gymId, key, value) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/data_store?on_conflict=gym_id,key`,
    {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ gym_id: gymId, key, value, updated_at: new Date().toISOString() }),
    }
  );
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export default async (req) => {
  console.log('[auto-checkin] Running...');

  try {
    // Get all gyms from registry
    const registry = await supabaseGet('__super__', 'hf_gyms_registry');
    const gyms = Array.isArray(registry) ? registry : [];

    if (gyms.length === 0) {
      console.log('[auto-checkin] No gyms in registry');
      return new Response(JSON.stringify({ message: 'No gyms', processed: 0 }));
    }

    let totalCheckins = 0;

    for (const gym of gyms) {
      const gymId = gym.gymId;

      // Check if auto check-in is enabled for this gym
      const settings = await supabaseGet(gymId, 'hf_noshow_settings');
      if (!settings?.autoCheckIn) continue;

      // Get schedule and attendance
      const schedule = await supabaseGet(gymId, 'hf_schedule');
      const attendance = await supabaseGet(gymId, 'hf_attendance');

      if (!Array.isArray(schedule) || schedule.length === 0) continue;

      const now = new Date();
      const todayDow = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon
      const todayStr = now.toISOString().slice(0, 10);
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const existingAttendance = Array.isArray(attendance) ? attendance : [];

      const newCheckins = [];

      for (const cls of schedule) {
        if (cls.dayOfWeek !== todayDow) continue;
        if (!cls.bookings || cls.bookings.length === 0) continue;

        const [sh, sm] = (cls.startTime || '0:0').split(':').map(Number);
        const startMin = sh * 60 + sm;

        // Auto check-in for sessions that started (up to 4 hours window)
        if (currentMin >= startMin && currentMin <= startMin + 240) {
          for (const memberId of cls.bookings) {
            const alreadyCheckedIn = existingAttendance.some(
              a => a.memberId === memberId && a.checkInTime?.slice(0, 10) === todayStr && a.classId === cls.id
            );
            if (!alreadyCheckedIn) {
              newCheckins.push({
                id: uuid(),
                memberId,
                checkInTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm).toISOString(),
                method: 'auto',
                classId: cls.id,
              });
            }
          }
        }
      }

      if (newCheckins.length > 0) {
        const updatedAttendance = [...existingAttendance, ...newCheckins];
        await supabaseUpsert(gymId, 'hf_attendance', updatedAttendance);
        totalCheckins += newCheckins.length;
        console.log(`[auto-checkin] ${gymId}: ${newCheckins.length} auto check-ins`);
      }
    }

    console.log(`[auto-checkin] Done. Total: ${totalCheckins} check-ins`);
    return new Response(JSON.stringify({ message: 'OK', processed: totalCheckins }));
  } catch (err) {
    console.error('[auto-checkin] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

// Schedule: every 5 minutes
export const config = {
  schedule: "*/5 * * * *",
};
