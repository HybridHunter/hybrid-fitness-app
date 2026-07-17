import { useState, useMemo, useCallback, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";
import { sendLocalNotification, getNotificationPrefs } from "../../utils/pushNotifications";
import { localISO } from "../../utils/dates";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
// Calendar hours — made dynamic via settings

const CLASS_COLORS = ["#8fbf3b","#063461","#a855f7","#f59e0b","#ef4444","#3b82f6"];
function getSessionColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
  return CLASS_COLORS[Math.abs(hash) % CLASS_COLORS.length];
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0,0,0,0);
  return date;
}

function fmtDate(d) {
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function fmtTime(t) {
  const [h,m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${String(m).padStart(2,"0")} ${ampm}`;
}

function timeToMinutes(t) {
  const [h,m] = t.split(":").map(Number);
  return h * 60 + m;
}

const INITIAL_CLASSES = [
  {id:crypto.randomUUID(),name:"6AM Semi-Private",instructor:"Coach Mike",dayOfWeek:0,startTime:"06:00",endTime:"06:45",capacity:8,bookings:[],waitlist:[],recurring:true,workoutId:"",_demo:true},
  {id:crypto.randomUUID(),name:"7AM Strength",instructor:"Coach Sarah",dayOfWeek:1,startTime:"07:00",endTime:"08:00",capacity:12,bookings:[],waitlist:[],recurring:true,workoutId:"",_demo:true},
  {id:crypto.randomUUID(),name:"9AM Open Gym",instructor:"Staff",dayOfWeek:2,startTime:"09:00",endTime:"10:00",capacity:20,bookings:[],waitlist:[],recurring:true,workoutId:"",_demo:true},
  {id:crypto.randomUUID(),name:"12PM Lunch Express",instructor:"Coach Mike",dayOfWeek:3,startTime:"12:00",endTime:"12:30",capacity:6,bookings:[],waitlist:[],recurring:true,workoutId:"",_demo:true},
  {id:crypto.randomUUID(),name:"5PM Evening Semi-Private",instructor:"Coach Sarah",dayOfWeek:4,startTime:"17:00",endTime:"17:45",capacity:8,bookings:[],waitlist:[],recurring:true,workoutId:"",_demo:true},
  {id:crypto.randomUUID(),name:"6PM Advanced",instructor:"Coach Mike",dayOfWeek:5,startTime:"18:00",endTime:"19:00",capacity:10,bookings:[],waitlist:[],recurring:true,workoutId:"",_demo:true},
];

const EMPTY_FORM = {name:"",instructor:"",dayOfWeek:0,selectedDays:[],startTime:"06:00",endTime:"06:45",capacity:8,recurring:true,workoutId:""};

export default function ScheduleView() {
  const B = useTheme();
  const { members, getMember } = useMembers();
  const auth = useAuth();
  const staffUsers = useMemo(() => {
    const users = auth?.users || [];
    return users.filter(u => u.role === "admin" || u.role === "coach");
  }, [auth]);
  const [classes, setClasses] = useLocalStorage("hf_schedule", []);
  const [instructorCustom, setInstructorCustom] = useState(false);
  const [workouts] = useLocalStorage("hf_w", []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [form, setForm] = useState({...EMPTY_FORM});
  const [bookingMemberId, setBookingMemberId] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingDropdownOpen, setBookingDropdownOpen] = useState(false);
  const [attendance, setAttendance] = useLocalStorage("hf_attendance", []);
  const [payments, setPayments] = useLocalStorage("hf_payments", []);
  const [noShowSettings, setNoShowSettings] = useLocalStorage("hf_noshow_settings", { feeEnabled: false, feeAmount: 25, cancelWindowHours: 12, penaltyEnabled: true, lateCancelFeeEnabled: false, lateCancelFeeThreshold: 3, autoCheckIn: false });
  const [noShowConfirm, setNoShowConfirm] = useState(null);
  const [showNoShowSettings, setShowNoShowSettings] = useState(false);
  const [featureToggles] = useLocalStorage("hf_feature_toggles", {});
  const workoutBuilderEnabled = featureToggles.workout_builder !== false;
  const [scheduleSettings, setScheduleSettings] = useLocalStorage("hf_schedule_settings", { startHour: 5, endHour: 21 });
  const HOURS = Array.from({length: scheduleSettings.endHour - scheduleSettings.startHour + 1}, (_, i) => i + scheduleSettings.startHour);
  const [privateSessions, setPrivateSessions] = useLocalStorage("hf_private_sessions", []);
  const [showPrivateLog, setShowPrivateLog] = useState(false);
  const [privateForm, setPrivateForm] = useState({ memberId: "", coachId: "", date: localISO(), startTime: "", endTime: "", notes: "" });

  const monday = useMemo(() => {
    const m = getMonday(new Date());
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);

  const weekDates = useMemo(() =>
    Array.from({length:7},(_,i) => {
      const d = new Date(monday);
      d.setDate(d.getDate()+i);
      return d;
    })
  , [monday]);

  const weekLabel = `${fmtDate(weekDates[0])} - ${fmtDate(weekDates[6])}`;

  const getWorkout = (workoutId) => workouts.find(w => w.id === workoutId) || null;

  const getWorkoutSummary = (workout) => {
    if (!workout) return null;
    const sections = workout.sections || [];
    const exerciseCount = sections.reduce((sum, s) => sum + (s.slots ? s.slots.length : 0), 0);
    return { name: workout.name, phase: workout.phase || "", sections: sections.length, exercises: exerciseCount };
  };

  const handleCreateClass = () => {
    if (!form.name.trim()) return;
    const days = form.selectedDays.length > 0 ? form.selectedDays : [form.dayOfWeek];
    const newClasses = days.map(day => ({
      ...form, id: crypto.randomUUID(), dayOfWeek: day,
      capacity: Number(form.capacity) || 8, bookings: [], waitlist: [],
    }));
    // Remove selectedDays from stored class data
    newClasses.forEach(c => delete c.selectedDays);
    setClasses(prev => [...prev, ...newClasses]);
    setForm({...EMPTY_FORM});
    setShowNewModal(false);
  };

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingClassId, setEditingClassId] = useState(null);

  const handleEditClass = (cls) => {
    setForm({ name: cls.name, instructor: cls.instructor, dayOfWeek: cls.dayOfWeek, selectedDays: [], startTime: cls.startTime, endTime: cls.endTime, capacity: cls.capacity, recurring: cls.recurring, workoutId: cls.workoutId || "" });
    setEditingClassId(cls.id);
    setShowNewModal(true);
  };

  const handleSaveEdit = () => {
    if (!form.name.trim()) return;
    const days = form.selectedDays.length > 0 ? form.selectedDays : [form.dayOfWeek];
    const formFields = { name: form.name, instructor: form.instructor, startTime: form.startTime, endTime: form.endTime, capacity: Number(form.capacity) || 8, recurring: form.recurring, workoutId: form.workoutId };
    setClasses(prev => {
      // Update the edited class to the first selected day, then create one class per additional day (like creation does)
      const updated = prev.map(c => c.id === editingClassId ? { ...c, ...formFields, dayOfWeek: days[0] } : c);
      const extras = days.slice(1).map(day => ({
        ...formFields, id: crypto.randomUUID(), dayOfWeek: day, bookings: [], waitlist: [],
      }));
      return [...updated, ...extras];
    });
    setEditingClassId(null);
    setForm({...EMPTY_FORM});
    setShowNewModal(false);
  };

  const handleDeleteClass = (id) => {
    const cls = classes.find(c => c.id === id);
    if (cls && cls.recurring) {
      // The instance being viewed is this class's day within the currently displayed week
      setDeleteConfirm({ id, name: cls.name, recurring: true, date: localISO(weekDates[cls.dayOfWeek]) });
    } else {
      setClasses(prev => prev.filter(c => c.id !== id));
      setSelectedClass(null);
    }
  };

  const confirmDelete = (mode) => {
    if (!deleteConfirm) return;
    if (mode === "all") {
      // Delete this session (which represents all recurring instances)
      setClasses(prev => prev.filter(c => c.id !== deleteConfirm.id));
    } else {
      // "Just this one" — add a per-date exception; recurrence continues on other dates
      setClasses(prev => prev.map(c => c.id === deleteConfirm.id ? { ...c, exceptions: [...(c.exceptions || []), deleteConfirm.date] } : c));
    }
    setSelectedClass(null);
    setDeleteConfirm(null);
  };

  const handleUpdateWorkoutId = (classId, workoutId) => {
    setClasses(prev => prev.map(c => c.id === classId ? { ...c, workoutId } : c));
  };

  const handleBookMember = useCallback((classId, memberId) => {
    if (!memberId) return;
    const cls = classes.find(c => c.id === classId);
    const m = getMember(memberId);
    setClasses(prev => prev.map(c => {
      if (c.id !== classId) return c;
      const bookings = c.bookings || [];
      const waitlist = c.waitlist || [];
      if (bookings.includes(memberId) || waitlist.includes(memberId)) return c;
      if (bookings.length < c.capacity) return { ...c, bookings: [...bookings, memberId] };
      return { ...c, waitlist: [...waitlist, memberId] };
    }));

    // Send notification
    if (getNotificationPrefs().booking !== false && m && cls) {
      const name = `${m.firstName} ${m.lastName}`;
      sendLocalNotification(`${name} booked ${cls.name}`, {
        body: `${DAYS[cls.dayOfWeek]} ${fmtTime(cls.startTime)} - ${fmtTime(cls.endTime)}`,
      });
    }

    setBookingMemberId("");
  }, [setClasses, classes, getMember]);

  const handleRemoveMember = useCallback((classId, memberId) => {
    setClasses(prev => prev.map(c => {
      if (c.id !== classId) return c;
      const bookings = c.bookings || [];
      const waitlist = c.waitlist || [];
      let newBookings = bookings.filter(id => id !== memberId);
      let newWaitlist = waitlist.filter(id => id !== memberId);
      // Promote from waitlist if a booking spot opened
      if (newBookings.length < c.capacity && newWaitlist.length > 0 && bookings.includes(memberId)) {
        newBookings = [...newBookings, newWaitlist[0]];
        newWaitlist = newWaitlist.slice(1);
      }
      return { ...c, bookings: newBookings, waitlist: newWaitlist };
    }));
  }, [setClasses]);

  // Auto check-in is now handled globally in useMembers hook

  const handleNoShow = (classId, memberId, chargeFee) => {
    const m = getMember(memberId);
    const cls = classes.find(c => c.id === classId);
    const memberName = m ? `${m.firstName} ${m.lastName}` : "Unknown";
    const todayStr = localISO();

    if (noShowSettings.autoCheckIn) {
      // Auto check-in mode: remove the auto check-in record, mark as no-show flagged to NOT count against allotment
      setAttendance(prev => {
        const withoutAutoCheckin = prev.filter(a => !(a.memberId === memberId && a.classId === classId && a.checkInTime && localISO(new Date(a.checkInTime)) === todayStr && a.method === "auto"));
        return [...withoutAutoCheckin, {
          id: crypto.randomUUID(),
          memberId,
          checkInTime: new Date().toISOString(),
          method: "no-show",
          classId,
          noShow: true,
          noAllotmentDeduction: true,
        }];
      });
    } else {
      // Standard mode: record as no-show flagged to count against allotment
      setAttendance(prev => [...prev, {
        id: crypto.randomUUID(),
        memberId,
        checkInTime: new Date().toISOString(),
        method: "no-show",
        classId,
        noShow: true,
        countsAgainstAllotment: true,
      }]);
    }

    // Remove from booking
    handleRemoveMember(classId, memberId);

    // Charge no-show fee if enabled
    if (chargeFee && noShowSettings.feeAmount > 0) {
      setPayments(prev => [...prev, {
        id: "pay_" + Date.now(),
        member: memberName,
        memberId,
        amount: noShowSettings.feeAmount,
        date: localISO(),
        status: "paid",
        method: "No-Show Fee",
        description: `No-show fee — ${cls?.name || "Session"}`,
        isFEO: false,
      }]);
    }

    setNoShowConfirm(null);
  };

  // Keep selectedClass in sync with classes state
  const activeClass = selectedClass ? classes.find(c => c.id === selectedClass.id) || null : null;

  const btn = (extra={}) => ({
    padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,...extra
  });

  const overlay = {
    position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",
    display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000
  };

  const modal = {
    background:B.card,border:`1px solid ${B.border}`,borderRadius:16,padding:24,
    width:480,maxWidth:"90vw",maxHeight:"85vh",overflowY:"auto"
  };

  const inputStyle = {
    width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${B.border}`,
    background:B.darker,color:B.text,fontSize:14,outline:"none",boxSizing:"border-box"
  };

  const labelStyle = { display:"block",fontSize:12,fontWeight:600,color:B.muted,marginBottom:4 };

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:800,color:B.text,margin:0}}>Schedule</h1>
          <p style={{color:B.muted,margin:"4px 0 0",fontSize:14}}>Weekly session calendar, booking, and waitlists.</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:B.muted}}>
            <select value={scheduleSettings.startHour} onChange={e=>setScheduleSettings(p=>({...p,startHour:Number(e.target.value)}))}
              style={{padding:"4px 6px",borderRadius:6,border:"1px solid "+B.border,background:B.darker,color:B.text,fontSize:12,outline:"none"}}>
              {Array.from({length:24},(_,i)=>i).map(h=><option key={h} value={h}>{h===0?"12 AM":h<12?`${h} AM`:h===12?"12 PM":`${h-12} PM`}</option>)}
            </select>
            <span>to</span>
            <select value={scheduleSettings.endHour} onChange={e=>setScheduleSettings(p=>({...p,endHour:Number(e.target.value)}))}
              style={{padding:"4px 6px",borderRadius:6,border:"1px solid "+B.border,background:B.darker,color:B.text,fontSize:12,outline:"none"}}>
              {Array.from({length:24},(_,i)=>i).map(h=><option key={h} value={h}>{h===0?"12 AM":h<12?`${h} AM`:h===12?"12 PM":`${h-12} PM`}</option>)}
            </select>
          </div>
          <button onClick={()=>{setForm({...EMPTY_FORM});setShowNewModal(true)}} style={btn({background:B.accent,color:B.darker,fontSize:14,padding:"10px 20px"})}>
            + New Session
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <Card style={{marginBottom:16,padding:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16}}>
          <button onClick={()=>setWeekOffset(w=>w-1)} style={btn({background:B.border,color:B.text,padding:"6px 14px",fontSize:18})}>
            &#8592;
          </button>
          <span style={{fontSize:15,fontWeight:700,color:B.text,minWidth:160,textAlign:"center"}}>{weekLabel}</span>
          <button onClick={()=>setWeekOffset(w=>w+1)} style={btn({background:B.border,color:B.text,padding:"6px 14px",fontSize:18})}>
            &#8594;
          </button>
          {weekOffset !== 0 && (
            <button onClick={()=>setWeekOffset(0)} style={btn({background:"transparent",color:B.accent,fontSize:12,padding:"4px 10px",border:`1px solid ${B.accent}`})}>
              Today
            </button>
          )}
        </div>
      </Card>

      {/* Calendar Grid */}
      <Card style={{padding:0,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"60px repeat(7,1fr)",minHeight:600}}>
          {/* Header row */}
          <div style={{background:B.darker,borderBottom:`1px solid ${B.border}`,padding:"10px 4px",textAlign:"center"}}>
            <span style={{fontSize:11,color:B.dim}}></span>
          </div>
          {DAYS.map((day,i) => (
            <div key={day} style={{background:B.darker,borderBottom:`1px solid ${B.border}`,borderLeft:`1px solid ${B.border}`,padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:12,fontWeight:700,color:B.text}}>{day}</div>
              <div style={{fontSize:11,color:B.muted}}>{fmtDate(weekDates[i])}</div>
            </div>
          ))}

          {/* Time rows */}
          {HOURS.map(hour => (
            <div key={hour} style={{display:"contents"}}>
              {/* Time label */}
              <div style={{
                borderBottom:`1px solid ${B.border}`,padding:"4px 6px",display:"flex",
                alignItems:"flex-start",justifyContent:"center",minHeight:48
              }}>
                <span style={{fontSize:10,fontWeight:600,color:B.dim,marginTop:2}}>
                  {hour === 0 ? "12 AM" : hour <= 12 ? `${hour} ${hour < 12 ? "AM" : "PM"}` : `${hour-12} PM`}
                </span>
              </div>
              {/* Day cells */}
              {DAYS.map((_, dayIdx) => {
                const cellDate = localISO(weekDates[dayIdx]);
                const dayClasses = classes.filter(c =>
                  c.dayOfWeek === dayIdx &&
                  !(c.exceptions || []).includes(cellDate) &&
                  timeToMinutes(c.startTime) >= hour * 60 &&
                  timeToMinutes(c.startTime) < (hour + 1) * 60
                );
                return (
                  <div key={dayIdx} style={{
                    borderBottom:`1px solid ${B.border}`,borderLeft:`1px solid ${B.border}`,
                    padding:2,position:"relative",minHeight:48
                  }}>
                    {dayClasses.map((cls, ci) => {
                      const color = getSessionColor(cls.name);
                      const hasWorkout = cls.workoutId && getWorkout(cls.workoutId);
                      const minuteOffset = timeToMinutes(cls.startTime) % 60;
                      const isMidHour = minuteOffset > 0;
                      return (
                        <div key={cls.id} onClick={()=>setSelectedClass(cls)} style={{
                          background:color+"22",border:`1px solid ${color}55`,borderLeft:`3px solid ${color}`,
                          borderRadius:6,padding:"4px 6px",marginBottom:2,cursor:"pointer",
                          transition:"transform 0.1s",
                          marginLeft: isMidHour ? 8 : 0,
                        }}
                        onMouseEnter={e=>e.currentTarget.style.transform="scale(1.02)"}
                        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
                        >
                          {isMidHour && (
                            <div style={{height:2,width:12,background:color,borderRadius:1,marginBottom:2,opacity:0.7}} />
                          )}
                          <div style={{display:"flex",alignItems:"center",gap:3}}>
                            <div style={{fontSize:11,fontWeight:700,color:B.text,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1}}>{cls.name}</div>
                            {hasWorkout && (
                              <span style={{
                                fontSize:8,fontWeight:800,color:"#fff",background:color,
                                borderRadius:3,padding:"1px 4px",lineHeight:1.3,flexShrink:0
                              }}>WOD</span>
                            )}
                          </div>
                          <div style={{fontSize: isMidHour ? 10 : 9,fontWeight: isMidHour ? 700 : 400,color: isMidHour ? color : B.muted}}>{fmtTime(cls.startTime)}-{fmtTime(cls.endTime)}</div>
                          <div style={{fontSize:9,color:B.muted}}>{cls.instructor}</div>
                          <div style={{fontSize:9,fontWeight:600,color:(cls.bookings?.length || 0)>=cls.capacity?B.orange:color}}>
                            {cls.bookings?.length || 0}/{cls.capacity} booked
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {/* Class Detail Modal */}
      {activeClass && (
        <div style={overlay} onClick={()=>setSelectedClass(null)}>
          <div style={modal} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <h2 style={{fontSize:20,fontWeight:800,color:B.text,margin:0}}>{activeClass.name}</h2>
                <p style={{color:B.muted,fontSize:13,margin:"4px 0 0"}}>
                  {DAYS[activeClass.dayOfWeek]} &middot; {fmtTime(activeClass.startTime)} - {fmtTime(activeClass.endTime)} &middot; {activeClass.instructor}
                </p>
              </div>
              <button onClick={()=>setSelectedClass(null)} style={btn({background:B.border,color:B.text,padding:"4px 10px",fontSize:16})}>
                &times;
              </button>
            </div>

            {/* Workout Template — hidden if workout_builder feature is off */}
            {workoutBuilderEnabled && <div style={{marginBottom:20,padding:14,borderRadius:10,background:B.darker,border:`1px solid ${B.border}`}}>
              <h3 style={{fontSize:13,fontWeight:700,color:B.text,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:15}}>&#x1F3CB;</span> Workout Template
              </h3>
              <select
                value={activeClass.workoutId || ""}
                onChange={e => handleUpdateWorkoutId(activeClass.id, e.target.value)}
                style={{...inputStyle,cursor:"pointer",marginBottom:0}}
              >
                <option value="">None</option>
                {workouts.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}{w.phase ? ` — ${w.phase}` : ""}
                  </option>
                ))}
              </select>
              {(() => {
                const summary = getWorkoutSummary(getWorkout(activeClass.workoutId));
                if (!summary) return null;
                return (
                  <div style={{marginTop:8,display:"flex",gap:12,fontSize:12,color:B.muted}}>
                    <span style={{background:B.accent+"22",color:B.accent,padding:"2px 8px",borderRadius:6,fontWeight:600}}>
                      {summary.exercises} exercise{summary.exercises !== 1 ? "s" : ""}
                    </span>
                    <span style={{background:B.accent+"22",color:B.accent,padding:"2px 8px",borderRadius:6,fontWeight:600}}>
                      {summary.sections} section{summary.sections !== 1 ? "s" : ""}
                    </span>
                    {summary.phase && (
                      <span style={{background:"#a855f722",color:"#a855f7",padding:"2px 8px",borderRadius:6,fontWeight:600}}>
                        {summary.phase}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>}

            {/* Capacity bar */}
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:B.muted,marginBottom:4}}>
                <span>Capacity</span>
                <span style={{fontWeight:700,color:(activeClass.bookings?.length || 0)>=activeClass.capacity?B.orange:B.accent}}>
                  {activeClass.bookings?.length || 0}/{activeClass.capacity}
                </span>
              </div>
              <div style={{height:6,background:B.border,borderRadius:3,overflow:"hidden"}}>
                <div style={{
                  height:"100%",borderRadius:3,transition:"width 0.3s",
                  width:`${Math.min(100,((activeClass.bookings?.length || 0)/activeClass.capacity)*100)}%`,
                  background:(activeClass.bookings?.length || 0)>=activeClass.capacity?B.orange:B.accent
                }}/>
              </div>
            </div>

            {/* Booked Members */}
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <h3 style={{fontSize:14,fontWeight:700,color:B.text,margin:0}}>Booked Members ({activeClass.bookings?.length || 0})</h3>
                <button onClick={()=>setShowNoShowSettings(!showNoShowSettings)} style={btn({background:"transparent",color:B.muted,padding:"2px 8px",fontSize:11,border:"1px solid "+B.border})}>
                  {"\u2699\uFE0F"} No-Show Settings
                </button>
              </div>

              {showNoShowSettings && (
                <div style={{padding:"12px 14px",borderRadius:10,background:B.card,border:"1px solid "+B.border,marginBottom:10,display:"flex",flexDirection:"column",gap:10}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                    <input type="checkbox" checked={!!noShowSettings.autoCheckIn} onChange={e=>setNoShowSettings(prev=>({...prev,autoCheckIn:e.target.checked}))} style={{width:16,height:16,accentColor:B.accent}} />
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:B.text}}>Auto check-in</div>
                      <div style={{fontSize:11,color:B.dim}}>Automatically check in booked members when session starts. Mark as no-show instead of removing.</div>
                    </div>
                  </label>
                  {noShowSettings.autoCheckIn && (
                    <div style={{paddingLeft:24,fontSize:12,color:B.muted,lineHeight:1.5}}>
                      When enabled, no-show records are flagged as exempt from session allotment since the member was auto-checked in and then marked absent.
                    </div>
                  )}
                  <div style={{borderTop:"1px solid "+B.border+"44",paddingTop:10}}></div>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                    <input type="checkbox" checked={noShowSettings.feeEnabled} onChange={e=>setNoShowSettings(prev=>({...prev,feeEnabled:e.target.checked}))} style={{width:16,height:16,accentColor:B.accent}} />
                    <span style={{fontSize:13,fontWeight:600,color:B.text}}>Charge no-show fee</span>
                  </label>
                  {noShowSettings.feeEnabled && (
                    <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:24}}>
                      <span style={{fontSize:13,color:B.muted}}>Fee amount: $</span>
                      <input type="number" min="0" step="1" value={noShowSettings.feeAmount} onChange={e=>setNoShowSettings(prev=>({...prev,feeAmount:Number(e.target.value)||0}))}
                        style={{width:70,padding:"4px 8px",borderRadius:6,border:"1px solid "+B.border,background:B.dark,color:B.text,fontSize:13,outline:"none"}} />
                    </div>
                  )}
                  <div style={{borderTop:"1px solid "+B.border+"44",paddingTop:10}}>
                    <div style={{fontSize:12,fontWeight:700,color:B.muted,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Booking Cancellation Policy</div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span style={{fontSize:13,color:B.muted}}>Free cancel window:</span>
                      <input type="number" min="0" value={noShowSettings.cancelWindowHours} onChange={e=>setNoShowSettings(prev=>({...prev,cancelWindowHours:Number(e.target.value)||0}))}
                        style={{width:60,padding:"4px 8px",borderRadius:6,border:"1px solid "+B.border,background:B.dark,color:B.text,fontSize:13,outline:"none"}} />
                      <span style={{fontSize:13,color:B.muted}}>hours before session</span>
                    </div>
                    <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                      <input type="checkbox" checked={noShowSettings.penaltyEnabled !== false} onChange={e=>setNoShowSettings(prev=>({...prev,penaltyEnabled:e.target.checked}))} style={{width:16,height:16,accentColor:B.accent}} />
                      <span style={{fontSize:13,color:B.text}}>Late cancel still counts against session allotment</span>
                    </label>
                    <div style={{fontSize:11,color:B.dim,marginTop:4}}>
                      Clients cancelling within {noShowSettings.cancelWindowHours}h of their session will be warned that their session will be deducted.
                    </div>
                    <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:8}}>
                      <input type="checkbox" checked={!!noShowSettings.lateCancelFeeEnabled} onChange={e=>setNoShowSettings(prev=>({...prev,lateCancelFeeEnabled:e.target.checked}))} style={{width:16,height:16,accentColor:B.accent}} />
                      <span style={{fontSize:13,color:B.text}}>Charge no-show fee for repeat late cancels</span>
                    </label>
                    {noShowSettings.lateCancelFeeEnabled && (
                      <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4,paddingLeft:24}}>
                        <span style={{fontSize:12,color:B.muted}}>After</span>
                        <input type="number" min="1" value={noShowSettings.lateCancelFeeThreshold || 3} onChange={e=>setNoShowSettings(prev=>({...prev,lateCancelFeeThreshold:Number(e.target.value)||3}))}
                          style={{width:50,padding:"4px 8px",borderRadius:6,border:"1px solid "+B.border,background:B.dark,color:B.text,fontSize:13,outline:"none"}} />
                        <span style={{fontSize:12,color:B.muted}}>late cancels this month, charge ${noShowSettings.feeAmount} fee</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(activeClass.bookings?.length || 0) === 0 && (
                <p style={{color:B.dim,fontSize:13,fontStyle:"italic"}}>No members booked yet.</p>
              )}
              {(activeClass.bookings || []).map(mid => {
                const m = getMember(mid);
                const todayStr = localISO();
                const isAutoCheckedIn = noShowSettings.autoCheckIn && attendance.some(a => a.memberId === mid && a.classId === activeClass.id && a.checkInTime && localISO(new Date(a.checkInTime)) === todayStr && a.method === "auto");
                return (
                  <div key={mid} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",borderRadius:8,background:isAutoCheckedIn ? B.green + "12" : B.darker,marginBottom:4,border:isAutoCheckedIn ? "1px solid " + B.green + "30" : "none"}}>
                    <span style={{fontSize:13,color:B.text,fontWeight:500}}>
                      {isAutoCheckedIn && <span style={{color:B.green,marginRight:6}}>{"\u2713"}</span>}
                      {m ? `${m.firstName} ${m.lastName}` : "Unknown Member"}
                      {isAutoCheckedIn && <span style={{fontSize:10,color:B.green,marginLeft:6}}>auto checked in</span>}
                    </span>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>setNoShowConfirm({classId:activeClass.id,memberId:mid,memberName:m?`${m.firstName} ${m.lastName}`:"Unknown"})} style={btn({background:(B.orange||"#f59e0b")+"22",color:B.orange||"#f59e0b",padding:"2px 10px",fontSize:11})}>
                        {isAutoCheckedIn ? "Mark No-Show" : "No Show"}
                      </button>
                      {!isAutoCheckedIn && (
                        <button onClick={()=>handleRemoveMember(activeClass.id,mid)} style={btn({background:B.red+"22",color:B.red,padding:"2px 10px",fontSize:11})}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Waitlist */}
            {(activeClass.waitlist?.length || 0) > 0 && (
              <div style={{marginBottom:20}}>
                <h3 style={{fontSize:14,fontWeight:700,color:B.orange,marginBottom:8}}>Waitlist ({activeClass.waitlist?.length || 0})</h3>
                {(activeClass.waitlist || []).map((mid,i) => {
                  const m = getMember(mid);
                  return (
                    <div key={mid} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",borderRadius:8,background:B.darker,marginBottom:4}}>
                      <span style={{fontSize:13,color:B.muted}}>#{i+1} {m ? `${m.firstName} ${m.lastName}` : "Unknown"}</span>
                      <button onClick={()=>handleRemoveMember(activeClass.id,mid)} style={btn({background:B.red+"22",color:B.red,padding:"2px 10px",fontSize:11})}>
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Book Client */}
            <div style={{marginBottom:20}}>
              <h3 style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:8}}>Book a Client</h3>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1,position:"relative"}}>
                  <input
                    style={inputStyle}
                    placeholder="Search by name..."
                    value={bookingSearch}
                    onChange={e=>{setBookingSearch(e.target.value);setBookingDropdownOpen(true);setBookingMemberId("");}}
                    onFocus={()=>setBookingDropdownOpen(true)}
                  />
                  {bookingDropdownOpen && bookingSearch.trim() && (() => {
                    const q = bookingSearch.toLowerCase();
                    const results = members
                      .filter(m => !(activeClass.bookings || []).includes(m.id) && !(activeClass.waitlist || []).includes(m.id))
                      .filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q))
                      .slice(0, 8);
                    if (results.length === 0) return null;
                    return (
                      <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:100,background:B.card,border:"1px solid "+B.border,borderRadius:8,marginTop:4,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,0.3)"}}>
                        {results.map(m=>(
                          <div key={m.id} onClick={()=>{setBookingMemberId(m.id);setBookingSearch(`${m.firstName} ${m.lastName}`);setBookingDropdownOpen(false);}}
                            style={{padding:"8px 12px",cursor:"pointer",fontSize:13,color:B.text,borderBottom:"1px solid "+B.border+"33"}}
                            onMouseEnter={e=>e.currentTarget.style.background=B.accent+"15"}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            {m.firstName} {m.lastName}
                            <span style={{fontSize:11,color:B.dim,marginLeft:8}}>{m.email}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <button onClick={()=>{handleBookMember(activeClass.id,bookingMemberId);setBookingSearch("");}}
                  style={btn({background:B.accent,color:B.darker,padding:"10px 16px",opacity:bookingMemberId?"1":"0.5"})}
                  disabled={!bookingMemberId}
                >
                  {(activeClass.bookings?.length || 0) >= activeClass.capacity ? "Add to Waitlist" : "Book Member"}
                </button>
              </div>
            </div>

            {/* Edit / Delete */}
            <div style={{borderTop:`1px solid ${B.border}`,paddingTop:16,display:"flex",justifyContent:"flex-end",gap:8}}>
              {activeClass.recurring && <span style={{fontSize:11,color:B.dim,lineHeight:"32px",marginRight:8}}>This is a recurring session</span>}
              <button onClick={()=>handleEditClass(activeClass)}
                style={btn({background:B.accent+"22",color:B.accent,padding:"8px 20px"})}>
                Edit
              </button>
              <button onClick={()=>handleDeleteClass(activeClass.id)}
                style={btn({background:B.red+"22",color:B.red,padding:"8px 20px"})}
              >
                Delete Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Private Training Log */}
      <Card style={{marginTop:20,padding:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}} onClick={()=>setShowPrivateLog(!showPrivateLog)}>
          <h3 style={{fontSize:16,fontWeight:700,color:B.text,margin:0}}>Private Training Sessions</h3>
          <span style={{color:B.dim}}>{showPrivateLog ? "\u25B2" : "\u25BC"}</span>
        </div>
        {showPrivateLog && (
          <div style={{marginTop:14}}>
            {/* Add private session form */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,alignItems:"flex-end"}}>
              <div>
                <label style={labelStyle}>Client</label>
                <select value={privateForm.memberId} onChange={e=>setPrivateForm(p=>({...p,memberId:e.target.value}))} style={{...inputStyle,width:160}}>
                  <option value="">Select client...</option>
                  {members.filter(m=>!!m.membershipPlanId).map(m=><option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Coach</label>
                <select value={privateForm.coachId} onChange={e=>setPrivateForm(p=>({...p,coachId:e.target.value}))} style={{...inputStyle,width:140}}>
                  <option value="">Select...</option>
                  {staffUsers.map(c=><option key={c.id} value={c.id}>{c.displayName||c.username}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={privateForm.date} onChange={e=>setPrivateForm(p=>({...p,date:e.target.value}))} style={{...inputStyle,width:140}}/>
              </div>
              <div>
                <label style={labelStyle}>Time</label>
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  <input type="time" value={privateForm.startTime} onChange={e=>setPrivateForm(p=>({...p,startTime:e.target.value}))} style={{...inputStyle,width:100}}/>
                  <span style={{color:B.dim}}>-</span>
                  <input type="time" value={privateForm.endTime} onChange={e=>setPrivateForm(p=>({...p,endTime:e.target.value}))} style={{...inputStyle,width:100}}/>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <input value={privateForm.notes} onChange={e=>setPrivateForm(p=>({...p,notes:e.target.value}))} placeholder="Optional notes" style={{...inputStyle,width:160}}/>
              </div>
              <button onClick={()=>{
                if(!privateForm.memberId||!privateForm.date) return;
                const m=getMember(privateForm.memberId);
                const c=staffUsers.find(x=>x.id===privateForm.coachId);
                setPrivateSessions(prev=>[{id:crypto.randomUUID(),memberId:privateForm.memberId,memberName:m?`${m.firstName} ${m.lastName}`:"Unknown",coachId:privateForm.coachId,coachName:c?.displayName||c?.username||"",date:privateForm.date,startTime:privateForm.startTime,endTime:privateForm.endTime,notes:privateForm.notes,createdAt:new Date().toISOString()},...prev]);
                // Also log as attendance
                setAttendance(prev=>[...prev,{id:crypto.randomUUID(),memberId:privateForm.memberId,checkInTime:new Date(`${privateForm.date}T${privateForm.startTime||"09:00"}`).toISOString(),method:"private",classId:null}]);
                setPrivateForm({memberId:"",coachId:"",date:localISO(),startTime:"",endTime:"",notes:""});
              }} style={btn({background:B.accent,color:"#fff",padding:"8px 16px",fontSize:13})}>
                Log Session
              </button>
            </div>

            {/* Session list */}
            {privateSessions.length === 0 ? (
              <div style={{color:B.dim,fontSize:13,padding:"8px 0"}}>No private sessions logged yet.</div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {privateSessions.slice(0,30).map(ps=>(
                  <div key={ps.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",borderRadius:8,background:B.darker}}>
                    <div style={{fontSize:13,fontWeight:600,color:B.text,minWidth:90}}>{new Date(ps.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                    <div style={{flex:1}}>
                      <span style={{fontWeight:600,color:B.text}}>{ps.memberName}</span>
                      {ps.coachName && <span style={{color:B.muted,fontSize:12}}> with {ps.coachName}</span>}
                    </div>
                    {ps.startTime && <span style={{fontSize:12,color:B.dim}}>{ps.startTime}{ps.endTime ? `-${ps.endTime}` : ""}</span>}
                    {ps.notes && <span style={{fontSize:11,color:B.dim,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ps.notes}</span>}
                    <button onClick={()=>setPrivateSessions(prev=>prev.filter(p=>p.id!==ps.id))} style={{background:"none",border:"none",color:B.red,cursor:"pointer",fontSize:12}}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Delete Recurring Confirmation */}
      {deleteConfirm && (
        <div style={overlay} onClick={()=>setDeleteConfirm(null)}>
          <div style={{...modal, maxWidth: 420}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 12px",fontSize:18,fontWeight:700,color:B.text}}>Delete Recurring Session</h3>
            <p style={{color:B.text,fontSize:14,lineHeight:1.6,margin:"0 0 8px"}}>
              <strong>{deleteConfirm.name}</strong> is a recurring session.
            </p>
            <p style={{color:B.muted,fontSize:13,margin:"0 0 20px"}}>
              Would you like to delete just this single instance or all future recurring sessions?
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={()=>confirmDelete("single")} style={{
                padding:"12px 20px",borderRadius:10,border:`1px solid ${B.border}`,
                background:B.dark,color:B.text,fontSize:14,fontWeight:600,cursor:"pointer",
                textAlign:"left",transition:"all 0.15s"
              }}>
                <div style={{fontWeight:700}}>Delete only this instance</div>
                <div style={{fontSize:12,color:B.muted,marginTop:2}}>Removes the session from this date only — other weeks stay on the schedule</div>
              </button>
              <button onClick={()=>confirmDelete("all")} style={{
                padding:"12px 20px",borderRadius:10,border:`1px solid ${B.red}40`,
                background:B.red+"15",color:B.red,fontSize:14,fontWeight:600,cursor:"pointer",
                textAlign:"left",transition:"all 0.15s"
              }}>
                <div style={{fontWeight:700}}>Delete all recurring sessions</div>
                <div style={{fontSize:12,color:B.red+"99",marginTop:2}}>Remove this session entirely from the schedule</div>
              </button>
              <button onClick={()=>setDeleteConfirm(null)} style={{
                padding:"8px 20px",borderRadius:8,border:`1px solid ${B.border}`,
                background:"transparent",color:B.muted,fontSize:13,fontWeight:600,cursor:"pointer",
                alignSelf:"flex-end",marginTop:4
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* No-Show Confirmation */}
      {noShowConfirm && (
        <div style={overlay} onClick={()=>setNoShowConfirm(null)}>
          <div style={{...modal, maxWidth: 420}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:18,fontWeight:700,color:B.text,margin:"0 0 12px"}}>Mark as No-Show</h3>
            <p style={{color:B.muted,fontSize:14,margin:"0 0 8px"}}>
              <strong>{noShowConfirm.memberName}</strong> did not attend this session.
            </p>
            <p style={{color:B.dim,fontSize:12,margin:"0 0 16px",lineHeight:1.5}}>
              This will be recorded as a no-show and will NOT count as attendance.
              {noShowSettings.feeEnabled && ` A $${noShowSettings.feeAmount} no-show fee will be charged.`}
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {noShowSettings.feeEnabled && (
                <button onClick={()=>handleNoShow(noShowConfirm.classId,noShowConfirm.memberId,true)} style={{
                  padding:"12px 16px",borderRadius:10,border:"1px solid "+B.border,background:B.red+"12",color:B.red,
                  fontSize:14,fontWeight:600,cursor:"pointer",textAlign:"left"
                }}>
                  <div style={{fontWeight:700}}>No-Show + Charge ${noShowSettings.feeAmount} Fee</div>
                  <div style={{fontSize:12,color:B.red+"99",marginTop:2}}>Mark as no-show and charge the no-show fee</div>
                </button>
              )}
              <button onClick={()=>handleNoShow(noShowConfirm.classId,noShowConfirm.memberId,false)} style={{
                padding:"12px 16px",borderRadius:10,border:"1px solid "+B.border,background:(B.orange||"#f59e0b")+"12",color:B.orange||"#f59e0b",
                fontSize:14,fontWeight:600,cursor:"pointer",textAlign:"left"
              }}>
                <div style={{fontWeight:700}}>No-Show (No Fee)</div>
                <div style={{fontSize:12,color:(B.orange||"#f59e0b")+"99",marginTop:2}}>Mark as no-show without charging</div>
              </button>
              <button onClick={()=>setNoShowConfirm(null)} style={{
                padding:"8px 20px",borderRadius:8,border:"1px solid "+B.border,background:"transparent",
                color:B.muted,fontSize:13,fontWeight:600,cursor:"pointer",alignSelf:"flex-end",marginTop:4
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* New Session Modal */}
      {showNewModal && (
        <div style={overlay} onClick={()=>setShowNewModal(false)}>
          <div style={modal} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontSize:20,fontWeight:800,color:B.text,margin:0}}>{editingClassId ? "Edit Session" : "New Session"}</h2>
              <button onClick={()=>setShowNewModal(false)} style={btn({background:B.border,color:B.text,padding:"4px 10px",fontSize:16})}>
                &times;
              </button>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={labelStyle}>Session Name</label>
                <input style={inputStyle} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Morning Strength" />
              </div>
              <div>
                <label style={labelStyle}>Instructor</label>
                {instructorCustom ? (
                  <div style={{display:"flex",gap:8}}>
                    <input style={{...inputStyle,flex:1}} value={form.instructor} onChange={e=>setForm(f=>({...f,instructor:e.target.value}))} placeholder="e.g. Coach Mike" />
                    <button type="button" onClick={()=>{setInstructorCustom(false);setForm(f=>({...f,instructor:""}))}} style={{padding:"8px 12px",borderRadius:8,border:"1px solid "+B.border,background:"transparent",color:B.muted,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>Use List</button>
                  </div>
                ) : (
                  <select style={{...inputStyle,cursor:"pointer"}} value={form.instructor} onChange={e=>{if(e.target.value==="__custom__"){setInstructorCustom(true);setForm(f=>({...f,instructor:""}));}else{setForm(f=>({...f,instructor:e.target.value}));}}}>
                    <option value="">Select instructor...</option>
                    {staffUsers.map(u=><option key={u.id} value={u.displayName||u.username}>{u.displayName||u.username} ({u.role})</option>)}
                    <option value="__custom__">Custom...</option>
                  </select>
                )}
              </div>
              <div>
                <label style={labelStyle}>Days</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {DAYS.map((d,i) => {
                    const selected = form.selectedDays.includes(i);
                    return (
                      <button key={i} type="button" onClick={() => setForm(f => ({...f, selectedDays: selected ? f.selectedDays.filter(x=>x!==i) : [...f.selectedDays, i]}))}
                        style={{padding:"6px 14px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:selected?`2px solid ${B.accent}`:`1px solid ${B.border}`,background:selected?B.accent+"15":"transparent",color:selected?B.accent:B.muted}}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <label style={labelStyle}>Start Time</label>
                  <input type="time" style={inputStyle} value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))} />
                </div>
                <div>
                  <label style={labelStyle}>End Time</label>
                  <input type="time" style={inputStyle} value={form.endTime} onChange={e=>setForm(f=>({...f,endTime:e.target.value}))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Capacity</label>
                <input type="number" min="1" style={inputStyle} value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:e.target.value}))} />
              </div>
              {workoutBuilderEnabled && (
              <div>
                <label style={labelStyle}>Workout Template</label>
                <select style={{...inputStyle,cursor:"pointer"}} value={form.workoutId} onChange={e=>setForm(f=>({...f,workoutId:e.target.value}))}>
                  <option value="">None</option>
                  {workouts.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.phase ? ` — ${w.phase}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              )}
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:B.text,fontSize:13}}>
                <input type="checkbox" checked={form.recurring} onChange={e=>setForm(f=>({...f,recurring:e.target.checked}))}
                  style={{width:16,height:16,accentColor:B.accent}}
                />
                Recurring weekly session
              </label>
            </div>

            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
              <button onClick={()=>{setShowNewModal(false);setEditingClassId(null);}} style={btn({background:B.border,color:B.text})}>Cancel</button>
              <button onClick={editingClassId ? handleSaveEdit : handleCreateClass} style={btn({background:B.accent,color:B.darker,opacity:form.name.trim()?"1":"0.5"})} disabled={!form.name.trim()}>
                {editingClassId ? "Save Changes" : "Create Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
