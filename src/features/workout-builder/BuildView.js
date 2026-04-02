import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { DSEC, emptySlot, getLabel } from "../../data/constants";
import ExercisePicker from "../../components/shared/ExercisePicker";
import ExerciseForm from "../../components/shared/ExerciseForm";
import VideoModal from "../../components/shared/VideoModal";
import ConfirmDialog from "../../components/shared/ConfirmDialog";
import Thumb from "../../components/shared/Thumb";

const initSections=()=>DSEC.map(s=>({...s,slots:[emptySlot()]}));

export default function BuildView({exercises,setExercises,workouts,setWorkouts,loadedWorkout,onSaved}){
  const B=useTheme();

  const[sections,setSections]=useState(()=>{
    if(loadedWorkout)return loadedWorkout.sections.map(s=>({...s,slots:s.slots.map(sl=>({...sl}))}));
    return initSections();
  });
  const[phase,setPhase]=useState(loadedWorkout?loadedWorkout.phase:"Phase 1");
  const[wLabel,setWLabel]=useState(loadedWorkout?loadedWorkout.workoutLabel:"Workout #1");
  const[wName,setWName]=useState(loadedWorkout?loadedWorkout.name:"");
  const[wDesc,setWDesc]=useState(loadedWorkout?loadedWorkout.description||"":"");
  const[picker,setPicker]=useState(null);
  const[confirm,setConfirm]=useState(null);
  const[dragInfo,setDragInfo]=useState(null);
  const[video,setVideo]=useState(null);
  const[exForm,setExForm]=useState(null);

  const openVideo=(url,title)=>setVideo({url,title});

  const upSlot=(si,idx,field,val)=>setSections(p=>{const n=p.map(s=>({...s,slots:s.slots.map(sl=>({...sl}))}));n[si].slots[idx]={...n[si].slots[idx],[field]:val};return n;});
  const setExerciseInSlot=(si,idx,ex)=>setSections(p=>{const n=p.map(s=>({...s,slots:s.slots.map(sl=>({...sl}))}));n[si].slots[idx]={...n[si].slots[idx],exercise:ex};return n;});
  const clrSlot=(si,idx)=>setSections(p=>{const n=p.map(s=>({...s,slots:s.slots.map(sl=>({...sl}))}));n[si].slots[idx]=emptySlot();return n;});
  const addSlot=(si)=>setSections(p=>{const n=p.map(s=>({...s,slots:[...s.slots]}));n[si].slots.push(emptySlot());return n;});
  const removeSlot=(si,idx)=>setSections(p=>{if(p[si].slots.length<=1)return p;const n=p.map(s=>({...s,slots:[...s.slots]}));n[si].slots.splice(idx,1);return n;});

  const swapSlots=(si1,idx1,si2,idx2)=>setSections(p=>{const n=p.map(s=>({...s,slots:s.slots.map(sl=>({...sl}))}));const a=n[si1].slots[idx1];const b=n[si2].slots[idx2];n[si1].slots[idx1]=b;n[si2].slots[idx2]=a;return n;});

  const onDragStart=(si,idx)=>(e)=>{setDragInfo({si,idx});e.dataTransfer.effectAllowed="move";};
  const onDragOver=(e)=>{e.preventDefault();};
  const onDrop=(si,idx)=>(e)=>{e.preventDefault();if(!dragInfo||dragInfo.si===si&&dragInfo.idx===idx)return;swapSlots(dragInfo.si,dragInfo.idx,si,idx);setDragInfo(null);};

  const save=()=>{const filled=sections.some(s=>s.slots.some(sl=>sl.exercise));if(!filled)return;setWorkouts(p=>[...p,{id:Date.now(),name:wName||phase+" - "+wLabel,phase,workoutLabel:wLabel,description:wDesc,sections:sections.map(s=>({...s,slots:s.slots.map(sl=>({...sl}))})),date:new Date().toISOString()}]);reset();if(onSaved)onSaved();};
  const reset=()=>{setSections(initSections());setWName("");setWDesc("");};

  const inp=(val,onChange,ph,w)=>(<input value={val} onChange={e=>onChange(e.target.value)} placeholder={ph} style={{background:B.darker,border:"1px solid "+B.border,borderRadius:5,color:B.text,padding:"4px 6px",width:w,fontSize:11,textAlign:"center",outline:"none"}}/>);

  return(<div>
    {confirm&&<ConfirmDialog msg={confirm.msg} onOk={confirm.action} onNo={()=>setConfirm(null)}/>}
    {video&&<VideoModal url={video.url} title={video.title} onClose={()=>setVideo(null)}/>}
    {exForm!==null&&<ExerciseForm exercise={exForm||undefined} exercises={exercises} onClose={()=>setExForm(null)} onSave={(ex)=>{if(exForm&&exForm.n){setExercises(p=>p.map(x=>x.n===exForm.n&&x.p===exForm.p?ex:x));}else{setExercises(p=>[...p,ex]);}}}/>}
    {picker&&<ExercisePicker exercises={exercises} onVideo={openVideo} onSelect={(ex)=>{setExerciseInSlot(picker.si,picker.idx,ex);}} onClose={()=>setPicker(null)}/>}

    <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
      <input value={wName} onChange={e=>setWName(e.target.value)} placeholder="Workout Name..." style={{background:B.card,border:"1px solid "+B.border,borderRadius:8,color:B.text,padding:"8px 12px",fontSize:14,fontWeight:600,outline:"none",flex:1,minWidth:180}}/>
      <select value={phase} onChange={e=>setPhase(e.target.value)} style={{background:B.card,border:"1px solid "+B.border,borderRadius:8,color:B.text,padding:"8px 12px",fontSize:12,outline:"none"}}>{Array.from({length:12},(_,i)=><option key={i}>Phase {i+1}</option>)}</select>
      <select value={wLabel} onChange={e=>setWLabel(e.target.value)} style={{background:B.card,border:"1px solid "+B.border,borderRadius:8,color:B.text,padding:"8px 12px",fontSize:12,outline:"none"}}>{["Workout #1","Workout #2","Workout #3","Strength","Build","Dynamic"].map(w=><option key={w}>{w}</option>)}</select>
      <button onClick={reset} style={{background:B.card,border:"1px solid "+B.border,borderRadius:8,color:B.muted,padding:"8px 14px",fontSize:11,cursor:"pointer",fontWeight:600}}>Clear</button>
      <button onClick={save} style={{background:B.accent,border:"none",borderRadius:8,color:"#fff",padding:"8px 20px",fontSize:12,cursor:"pointer",fontWeight:700}}>Save Workout</button>
    </div>
    <textarea value={wDesc} onChange={e=>setWDesc(e.target.value)} placeholder="Workout description or coaching notes..." rows={2} style={{width:"100%",boxSizing:"border-box",background:B.card,border:"1px solid "+B.border,borderRadius:8,color:B.text,padding:"10px 14px",fontSize:12,outline:"none",resize:"vertical",marginBottom:16,fontFamily:"inherit"}}/>

    {sections.map((sec,si)=>(<div key={sec.id} style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{width:4,height:22,borderRadius:2,background:sec.color}}/>
          <span style={{fontSize:11,fontWeight:700,color:sec.color,letterSpacing:2,textTransform:"uppercase"}}>Section {sec.id} &mdash;</span>
          <input value={sec.name} onChange={e=>setSections(p=>{const n=[...p.map(s=>({...s,slots:[...s.slots]}))];n[si].name=e.target.value;return n;})} style={{background:"transparent",border:"none",borderBottom:"1px solid "+B.border,color:B.text,fontSize:13,fontWeight:600,outline:"none",padding:"2px 4px",width:140}}/>
          <input value={sec.repRange} onChange={e=>setSections(p=>{const n=[...p.map(s=>({...s,slots:[...s.slots]}))];n[si].repRange=e.target.value;return n;})} style={{background:"transparent",border:"none",borderBottom:"1px solid "+B.border,color:B.muted,fontSize:11,outline:"none",padding:"2px 4px",width:100}}/>
          <button onClick={()=>addSlot(si)} style={{background:sec.color+"15",border:"1px solid "+sec.color+"30",borderRadius:6,color:sec.color,cursor:"pointer",fontSize:10,padding:"3px 10px",fontWeight:700}}>+ Slot</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {sec.slots.map((s,idx)=>{const label=getLabel(sec.id,idx);const ex=s.exercise;return(
            <div key={idx} draggable onDragStart={onDragStart(si,idx)} onDragOver={onDragOver} onDrop={onDrop(si,idx)} style={{background:ex?B.card:B.dark,borderRadius:10,border:ex?"1px solid "+sec.color+"25":"1px dashed "+B.border,padding:"8px 12px",display:"flex",alignItems:"center",gap:8,cursor:"grab"}}>
              <span style={{fontWeight:800,color:sec.color,fontSize:12,fontFamily:"monospace",minWidth:22}}>{label}</span>
              {ex?(<>
                <Thumb ex={ex} size="sm" onClick={()=>{if(ex.u)openVideo(ex.u,ex.n);}}/>
                <div style={{flex:1,minWidth:0}}><div style={{color:B.text,fontSize:12,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ex.n}</div><div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap",marginTop:2}}><span style={{color:B.dim,fontSize:10}}>{ex.e}</span></div></div>
                {inp(s.sets,v=>upSlot(si,idx,"sets",v),"Sets",36)}<span style={{color:B.dim,fontSize:10}}>&times;</span>
                {inp(s.reps,v=>upSlot(si,idx,"reps",v),"Reps",36)}
                {inp(s.rpe,v=>upSlot(si,idx,"rpe",v),"RPE",34)}
                {inp(s.tempo,v=>upSlot(si,idx,"tempo",v),"Tempo",46)}
                <button onClick={()=>clrSlot(si,idx)} style={{background:"none",border:"none",color:B.muted,cursor:"pointer",fontSize:14,fontWeight:700,padding:"0 2px"}}>&times;</button>
                <button onClick={()=>removeSlot(si,idx)} title="Remove slot" style={{background:"none",border:"none",color:B.red,cursor:"pointer",fontSize:11,padding:"0 2px",opacity:sec.slots.length<=1?.3:1}}>&#128465;</button>
              </>):(<>
                <button onClick={()=>setPicker({si,idx})} style={{flex:1,background:"transparent",border:"1px dashed "+B.border,borderRadius:6,color:B.dim,cursor:"pointer",padding:8,fontSize:12,textAlign:"left"}}>+ Add exercise</button>
                <button onClick={()=>removeSlot(si,idx)} title="Remove slot" style={{background:"none",border:"none",color:B.red,cursor:"pointer",fontSize:11,padding:"0 4px",opacity:sec.slots.length<=1?.3:1}}>&#128465;</button>
              </>)}
            </div>
          );})}
        </div>
      </div>))}
  </div>);
}
