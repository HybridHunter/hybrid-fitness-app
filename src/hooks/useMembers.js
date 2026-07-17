import { useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { localISO, localMonth } from "../utils/dates";


export function useMembers() {
  const [members, setMembers, membersLoaded] = useLocalStorage("hf_members", []);

  const addMember = (member) => {
    const newMember = {
      id: crypto.randomUUID(),
      photo: "",
      familyGroupId: null,
      membershipStatus: "active",
      tags: [],
      address: { street: "", city: "", state: "", zip: "", country: "US" },
      movementScores: { Squat:0, Hinge:0, Lunge:0, Push:0, Pull:0, Core:0, Carry:0 },
      gamification: { level:1, xp:0, totalWorkouts:0, totalWeightLifted:0, badges:[], currentStreak:0, longestStreak:0 },
      rank: { current:"White", promotionDate:null },
      inbody: { lastScan: null, history: [] },
      createdAt: new Date().toISOString(),
      ...member,
    };
    setMembers(prev => [...prev, newMember]);
    return newMember;
  };

  const updateMember = (id, updates) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const deleteMember = (id) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const getMember = (id) => members.find(m => m.id === id) || null;

  // Auto-process scheduled cancellations, plan expirations, and session carryover
  const [plans, , plansLoaded] = useLocalStorage("hf_plans", []);
  const [attForCarryover, , attLoaded] = useLocalStorage("hf_attendance", []);
  useEffect(() => {
    // Wait for cloud data — running against the stale local cache would
    // overwrite the gym's cloud data (F5/P13)
    if (!membersLoaded || !plansLoaded || !attLoaded) return;
    const today = localISO();
    const thisMonth = today.slice(0, 7);
    let changed = false;

    // Session carryover — once per month, calculate unused sessions from last month
    const carryover = {};
    const lastCarryover = localStorage.getItem("hf_last_carryover_month");
    if (lastCarryover !== thisMonth) {
      const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthKey = localMonth(lastMonth);
      members.forEach(m => {
        if (!m.membershipPlanId) return;
        const plan = plans.find(p => p.id === m.membershipPlanId);
        if (!plan?.sessionsIncluded || !plan?.allowCarryover) return;
        const lastMonthAttendance = (Array.isArray(attForCarryover) ? attForCarryover : []).filter(a => a.memberId === m.id && (!a.noShow || a.countsAgainstAllotment) && a.checkInTime && localMonth(new Date(a.checkInTime)) === lastMonthKey).length;
        const unused = Math.max(0, plan.sessionsIncluded - lastMonthAttendance);
        if (unused > 0 && (m.carryoverSessions || 0) !== unused) {
          carryover[m.id] = unused; changed = true;
        }
      });
      localStorage.setItem("hf_last_carryover_month", thisMonth);
    }
    const updated = members.map(orig => {
      const m = carryover[orig.id] != null ? { ...orig, carryoverSessions: carryover[orig.id] } : orig;
      // Scheduled cancellations
      if (m.cancelScheduled && m.cancelScheduled <= today && m.membershipPlanId) {
        changed = true;
        return { ...m, membershipPlanId: null, cancelScheduled: null, planEndDate: null };
      }
      // Fixed-duration plan expirations
      if (m.planEndDate && m.planEndDate <= today && m.membershipPlanId) {
        const currentPlan = plans.find(p => p.id === m.membershipPlanId);
        if (currentPlan?.endBehavior === "rollover" && currentPlan?.rolloverPlanId) {
          // Roll into the next plan
          const nextPlan = plans.find(p => p.id === currentPlan.rolloverPlanId);
          let newEndDate = null;
          if (nextPlan?.durationType === "fixed" && nextPlan?.durationWeeks) {
            const end = new Date();
            end.setDate(end.getDate() + nextPlan.durationWeeks * 7);
            newEndDate = localISO(end);
          }
          changed = true;
          return { ...m, membershipPlanId: currentPlan.rolloverPlanId, planEndDate: newEndDate };
        } else {
          // Auto-cancel
          changed = true;
          return { ...m, membershipPlanId: null, planEndDate: null };
        }
      }
      // Auto-unfreeze when hold end date passes
      if (m.membershipStatus === "frozen" && m.holdEndDate && m.holdEndDate <= today) {
        changed = true;
        return { ...m, membershipStatus: "active", holdStartDate: null, holdEndDate: null };
      }
      return m;
    });
    if (changed) setMembers(updated);
  }, [members, setMembers, plans, attForCarryover, membersLoaded, plansLoaded, attLoaded]);

  // Auto-clear bookings for sessions that ended today (so they don't carry to next week)
  const [schedule, setSchedule, scheduleLoaded] = useLocalStorage("hf_schedule", []);
  useEffect(() => {
    if (!scheduleLoaded) return; // don't clear based on stale local cache
    const now = new Date();
    const todayDow = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const todayStr = localISO(now);
    const lastCleared = localStorage.getItem("hf_bookings_cleared_date");
    if (lastCleared === todayStr) return; // Only run once per day

    let cleared = false;
    const updated = schedule.map(cls => {
      if (cls.dayOfWeek !== todayDow) return cls;
      if (!cls.bookings || cls.bookings.length === 0) return cls;
      const [eh, em] = (cls.endTime || "23:59").split(":").map(Number);
      const endMin = eh * 60 + em;
      // If session ended today, clear bookings
      if (currentMin > endMin + 30) { // 30 min grace after session ends
        cleared = true;
        return { ...cls, bookings: [], waitlist: [] };
      }
      return cls;
    });
    if (cleared) {
      setSchedule(updated);
      localStorage.setItem("hf_bookings_cleared_date", todayStr);
    }
  }, [schedule, setSchedule, scheduleLoaded]);

  return { members, setMembers, addMember, updateMember, deleteMember, getMember, membersLoaded };
}
