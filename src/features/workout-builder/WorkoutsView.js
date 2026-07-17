import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { getLabel } from "../../data/constants";
import { printWorkoutSheet } from "../../utils/workoutPrint";
import VideoModal from "../../components/shared/VideoModal";
import ConfirmDialog from "../../components/shared/ConfirmDialog";
import Thumb from "../../components/shared/Thumb";

export default function WorkoutsView({workouts,setWorkouts,exercises,onLoad}){
  const B=useTheme();
  const navigate=useNavigate();
  const[confirm,setConfirm]=useState(null);
  const[video,setVideo]=useState(null);
  const[programs,setPrograms]=useLocalStorage("hf_p",[]);
  const[schedule]=useLocalStorage("hf_schedule",[]);
  const[stations]=useLocalStorage("hf_stations",[]);
  const[remoteWorkouts]=useLocalStorage("hf_remote_workouts",[]);

  const openVideo=(url,title)=>setVideo({url,title});
  const doPrint=(w)=>printWorkoutSheet([w]);

  const askDelete=(w)=>{
    const wid=String(w.id);
    const progCount=programs.filter(p=>(p.workoutIds||[]).some(id=>String(id)===wid)).length;
    const schedCount=schedule.filter(c=>c.workoutId!=null&&String(c.workoutId)===wid).length;
    const stationCount=stations.filter(s=>s.workoutId!=null&&String(s.workoutId)===wid).length;
    const remoteCount=remoteWorkouts.filter(r=>r.workoutId!=null&&String(r.workoutId)===wid).length;
    const refs=[progCount&&progCount+" program(s)",schedCount&&schedCount+" scheduled class(es)",stationCount&&stationCount+" station(s)",remoteCount&&remoteCount+" remote assignment(s)"].filter(Boolean);
    const msg=refs.length
      ?"Delete this workout? It is still used by "+refs.join(", ")+" — those references will stop working (it will be removed from programs automatically). This cannot be undone."
      :"Delete this workout? This cannot be undone.";
    setConfirm({msg,action:()=>{
      setWorkouts(p=>p.filter(x=>x.id!==w.id));
      if(progCount)setPrograms(p=>p.map(pr=>(pr.workoutIds||[]).some(id=>String(id)===wid)?{...pr,workoutIds:pr.workoutIds.filter(id=>String(id)!==wid)}:pr));
      setConfirm(null);
    }});
  };

  return(<div>
    {confirm&&<ConfirmDialog msg={confirm.msg} onOk={confirm.action} onNo={()=>setConfirm(null)}/>}
    {video&&<VideoModal url={video.url} title={video.title} onClose={()=>setVideo(null)}/>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{fontSize:18,fontWeight:700}}>Saved Workouts <span style={{color:B.muted,fontSize:13}}>({workouts.length})</span></div>
      <button onClick={()=>navigate(`/gym/${localStorage.getItem("hf_gym_id") || "default"}/build`)} style={{padding:"8px 20px",borderRadius:8,border:"none",background:B.accent,color:"#fff",fontSize:12,cursor:"pointer",fontWeight:700}}>+ Create Workout</button>
    </div>
    {workouts.length===0?(<div style={{textAlign:"center",padding:60,color:B.dim}}><div style={{fontSize:42,marginBottom:12}}>&#127947;&#65039;</div><div style={{fontSize:15,fontWeight:600}}>No saved workouts yet</div><button onClick={()=>navigate(`/gym/${localStorage.getItem("hf_gym_id") || "default"}/build`)} style={{marginTop:16,padding:"10px 24px",borderRadius:8,border:"none",background:B.accent,color:"#fff",fontSize:13,cursor:"pointer",fontWeight:700}}>Create Your First Workout</button></div>):(
    <div style={{display:"grid",gap:12}}>{workouts.map(w=>(
      <div key={w.id} style={{background:B.card,borderRadius:12,border:"1px solid "+B.border,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
          <div><span style={{color:B.accent,fontWeight:800,fontSize:15}}>{w.name}</span><span style={{color:B.dim,margin:"0 8px"}}>&middot;</span><span style={{color:B.muted,fontSize:12}}>{w.phase} &middot; {w.workoutLabel}</span></div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>doPrint(w)} style={{background:B.accent+"15",border:"1px solid "+B.accent+"30",borderRadius:6,color:B.accent,cursor:"pointer",fontSize:10,padding:"5px 12px",fontWeight:700}}>Print</button>
            <button onClick={()=>onLoad(w)} style={{background:B.blue+"30",border:"1px solid "+B.blue+"50",borderRadius:6,color:"#6ea8fe",cursor:"pointer",fontSize:10,padding:"5px 12px",fontWeight:700}}>Edit</button>
            <button onClick={()=>askDelete(w)} style={{background:B.red+"15",border:"1px solid "+B.red+"30",borderRadius:6,color:B.red,cursor:"pointer",fontSize:10,padding:"5px 12px",fontWeight:700}}>Delete</button>
          </div>
        </div>
        {w.description&&<div style={{fontSize:11,color:B.muted,marginBottom:8,fontStyle:"italic"}}>{w.description}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:3}}>{(w.sections||[]).map((sec,si)=>sec.slots.filter(s=>s.exercise).map((s,i)=>{const sc=sec.color||B.accent;return(
          <div key={si+"-"+i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 10px",borderRadius:6,background:B.dark,fontSize:12}}>
            <span style={{fontWeight:800,color:sc,fontFamily:"monospace",minWidth:22}}>{getLabel(sec.id,sec.slots.indexOf(s))}</span>
            <Thumb ex={s.exercise} size="sm" onClick={()=>{if(s.exercise.u)openVideo(s.exercise.u,s.exercise.n);}}/>
            <span style={{color:B.text,flex:1}}>{s.exercise.n}</span>

            <span style={{color:B.dim,fontSize:10}}>{s.exercise.e}</span>
            {s.sets&&<span style={{color:B.accent,fontSize:11,fontFamily:"monospace"}}>{s.sets}&times;{s.reps}</span>}
            {s.rpe&&<span style={{color:B.orange,fontSize:10}}>RPE {s.rpe}</span>}
            {s.tempo&&<span style={{color:B.purple,fontSize:10}}>{s.tempo}</span>}
          </div>
        );}))}
        </div>
      </div>
    ))}</div>)}
  </div>);
}
