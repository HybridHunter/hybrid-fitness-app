import { useState, useMemo, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const HOURS = Array.from({length:15},(_,i)=>i+6); // 6AM-8PM

const CLASS_COLORS = ["#8fbf3b","#063461","#a855f7","#f59e0b","#ef4444","#3b82f6"];

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

const EMPTY_FORM = {name:"",instructor:"",dayOfWeek:0,startTime:"06:00",endTime:"06:45",capacity:8,recurring:true,workoutId:""};

export default function ScheduleView() {
  const B = useTheme();
  const { members, getMember } = useMembers();
  const auth = useAuth();
  const staffUsers = useMemo(() => {
    const users = auth?.users || [];
    return users.filter(u => u.role === "admin" || u.role === "coach");
  }, [auth]);
  const [classes, setClasses] = useLocalStorage("hf_schedule", INITIAL_CLASSES);
  const [instructorCustom, setInstructorCustom] = useState(false);
  const [workouts] = useLocalStorage("hf_w", []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [form, setForm] = useState({...EMPTY_FORM});
  const [bookingMemberId, setBookingMemberId] = useState("");

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
    const exerciseCount = sections.reduce((sum, s) => sum + (s.exercises ? s.exercises.length : 0), 0);
    return { name: workout.name, phase: workout.phase || "", sections: sections.length, exercises: exerciseCount };
  };

  const handleCreateClass = () => {
    if (!form.name.trim()) return;
    const newClass = { ...form, id: crypto.randomUUID(), capacity: Number(form.capacity) || 8, bookings: [], waitlist: [] };
    setClasses(prev => [...prev, newClass]);
    setForm({...EMPTY_FORM});
    setShowNewModal(false);
  };

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleDeleteClass = (id) => {
    const cls = classes.find(c => c.id === id);
    if (cls && cls.recurring) {
      setDeleteConfirm({ id, name: cls.name, recurring: true });
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
      // "Just this one" — mark it as non-recurring (single instance remains)
      setClasses(prev => prev.map(c => c.id === deleteConfirm.id ? { ...c, recurring: false } : c));
    }
    setSelectedClass(null);
    setDeleteConfirm(null);
  };

  const handleUpdateWorkoutId = (classId, workoutId) => {
    setClasses(prev => prev.map(c => c.id === classId ? { ...c, workoutId } : c));
  };

  const handleBookMember = useCallback((classId, memberId) => {
    if (!memberId) return;
    setClasses(prev => prev.map(c => {
      if (c.id !== classId) return c;
      if (c.bookings.includes(memberId) || c.waitlist.includes(memberId)) return c;
      if (c.bookings.length < c.capacity) return { ...c, bookings: [...c.bookings, memberId] };
      return { ...c, waitlist: [...c.waitlist, memberId] };
    }));
    setBookingMemberId("");
  }, [setClasses]);

  const handleRemoveMember = useCallback((classId, memberId) => {
    setClasses(prev => prev.map(c => {
      if (c.id !== classId) return c;
      let newBookings = c.bookings.filter(id => id !== memberId);
      let newWaitlist = c.waitlist.filter(id => id !== memberId);
      // Promote from waitlist if a booking spot opened
      if (newBookings.length < c.capacity && newWaitlist.length > 0 && c.bookings.includes(memberId)) {
        newBookings = [...newBookings, newWaitlist[0]];
        newWaitlist = newWaitlist.slice(1);
      }
      return { ...c, bookings: newBookings, waitlist: newWaitlist };
    }));
  }, [setClasses]);

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
        <button onClick={()=>{setForm({...EMPTY_FORM});setShowNewModal(true)}} style={btn({background:B.accent,color:B.darker,fontSize:14,padding:"10px 20px"})}>
          + New Session
        </button>
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
                const dayClasses = classes.filter(c =>
                  c.dayOfWeek === dayIdx &&
                  timeToMinutes(c.startTime) >= hour * 60 &&
                  timeToMinutes(c.startTime) < (hour + 1) * 60
                );
                return (
                  <div key={dayIdx} style={{
                    borderBottom:`1px solid ${B.border}`,borderLeft:`1px solid ${B.border}`,
                    padding:2,position:"relative",minHeight:48
                  }}>
                    {dayClasses.map((cls, ci) => {
                      const color = CLASS_COLORS[classes.indexOf(cls) % CLASS_COLORS.length];
                      const hasWorkout = cls.workoutId && getWorkout(cls.workoutId);
                      return (
                        <div key={cls.id} onClick={()=>setSelectedClass(cls)} style={{
                          background:color+"22",border:`1px solid ${color}55`,borderLeft:`3px solid ${color}`,
                          borderRadius:6,padding:"4px 6px",marginBottom:2,cursor:"pointer",
                          transition:"transform 0.1s",
                        }}
                        onMouseEnter={e=>e.currentTarget.style.transform="scale(1.02)"}
                        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
                        >
                          <div style={{display:"flex",alignItems:"center",gap:3}}>
                            <div style={{fontSize:11,fontWeight:700,color:B.text,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1}}>{cls.name}</div>
                            {hasWorkout && (
                              <span style={{
                                fontSize:8,fontWeight:800,color:"#fff",background:color,
                                borderRadius:3,padding:"1px 4px",lineHeight:1.3,flexShrink:0
                              }}>WOD</span>
                            )}
                          </div>
                          <div style={{fontSize:9,color:B.muted}}>{fmtTime(cls.startTime)}-{fmtTime(cls.endTime)}</div>
                          <div style={{fontSize:9,color:B.muted}}>{cls.instructor}</div>
                          <div style={{fontSize:9,fontWeight:600,color:cls.bookings.length>=cls.capacity?B.orange:color}}>
                            {cls.bookings.length}/{cls.capacity} booked
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

            {/* Workout Template */}
            <div style={{marginBottom:20,padding:14,borderRadius:10,background:B.darker,border:`1px solid ${B.border}`}}>
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
            </div>

            {/* Capacity bar */}
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:B.muted,marginBottom:4}}>
                <span>Capacity</span>
                <span style={{fontWeight:700,color:activeClass.bookings.length>=activeClass.capacity?B.orange:B.accent}}>
                  {activeClass.bookings.length}/{activeClass.capacity}
                </span>
              </div>
              <div style={{height:6,background:B.border,borderRadius:3,overflow:"hidden"}}>
                <div style={{
                  height:"100%",borderRadius:3,transition:"width 0.3s",
                  width:`${Math.min(100,(activeClass.bookings.length/activeClass.capacity)*100)}%`,
                  background:activeClass.bookings.length>=activeClass.capacity?B.orange:B.accent
                }}/>
              </div>
            </div>

            {/* Booked Members */}
            <div style={{marginBottom:20}}>
              <h3 style={{fontSize:14,fontWeight:700,color:B.text,marginBottom:8}}>Booked Members ({activeClass.bookings.length})</h3>
              {activeClass.bookings.length === 0 && (
                <p style={{color:B.dim,fontSize:13,fontStyle:"italic"}}>No members booked yet.</p>
              )}
              {activeClass.bookings.map(mid => {
                const m = getMember(mid);
                return (
                  <div key={mid} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",borderRadius:8,background:B.darker,marginBottom:4}}>
                    <span style={{fontSize:13,color:B.text,fontWeight:500}}>{m ? `${m.firstName} ${m.lastName}` : "Unknown Member"}</span>
                    <button onClick={()=>handleRemoveMember(activeClass.id,mid)} style={btn({background:B.red+"22",color:B.red,padding:"2px 10px",fontSize:11})}>
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Waitlist */}
            {activeClass.waitlist.length > 0 && (
              <div style={{marginBottom:20}}>
                <h3 style={{fontSize:14,fontWeight:700,color:B.orange,marginBottom:8}}>Waitlist ({activeClass.waitlist.length})</h3>
                {activeClass.waitlist.map((mid,i) => {
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
                <select value={bookingMemberId} onChange={e=>setBookingMemberId(e.target.value)}
                  style={{...inputStyle,flex:1,cursor:"pointer"}}
                >
                  <option value="">Select member...</option>
                  {members
                    .filter(m => !activeClass.bookings.includes(m.id) && !activeClass.waitlist.includes(m.id))
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                    ))
                  }
                </select>
                <button onClick={()=>handleBookMember(activeClass.id,bookingMemberId)}
                  style={btn({background:B.accent,color:B.darker,padding:"10px 16px",opacity:bookingMemberId?"1":"0.5"})}
                  disabled={!bookingMemberId}
                >
                  {activeClass.bookings.length >= activeClass.capacity ? "Add to Waitlist" : "Book Member"}
                </button>
              </div>
            </div>

            {/* Delete */}
            <div style={{borderTop:`1px solid ${B.border}`,paddingTop:16,display:"flex",justifyContent:"flex-end",gap:8}}>
              {activeClass.recurring && <span style={{fontSize:11,color:B.dim,lineHeight:"32px",marginRight:8}}>This is a recurring session</span>}
              <button onClick={()=>handleDeleteClass(activeClass.id)}
                style={btn({background:B.red+"22",color:B.red,padding:"8px 20px"})}
              >
                Delete Session
              </button>
            </div>
          </div>
        </div>
      )}

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
                <div style={{fontSize:12,color:B.muted,marginTop:2}}>The session will stop recurring but this single instance stays on the schedule</div>
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

      {/* New Session Modal */}
      {showNewModal && (
        <div style={overlay} onClick={()=>setShowNewModal(false)}>
          <div style={modal} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontSize:20,fontWeight:800,color:B.text,margin:0}}>New Session</h2>
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
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <div>
                  <label style={labelStyle}>Day</label>
                  <select style={inputStyle} value={form.dayOfWeek} onChange={e=>setForm(f=>({...f,dayOfWeek:Number(e.target.value)}))}>
                    {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
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
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:B.text,fontSize:13}}>
                <input type="checkbox" checked={form.recurring} onChange={e=>setForm(f=>({...f,recurring:e.target.checked}))}
                  style={{width:16,height:16,accentColor:B.accent}}
                />
                Recurring weekly session
              </label>
            </div>

            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
              <button onClick={()=>setShowNewModal(false)} style={btn({background:B.border,color:B.text})}>Cancel</button>
              <button onClick={handleCreateClass} style={btn({background:B.accent,color:B.darker,opacity:form.name.trim()?"1":"0.5"})} disabled={!form.name.trim()}>
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
