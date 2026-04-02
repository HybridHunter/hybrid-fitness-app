import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { PATS, MUSCLES } from "../../data/constants";

export default function ExerciseForm({exercise, onSave, onClose}) {
  const B=useTheme();
  const[n,setN]=useState(exercise?exercise.n:"");
  const[p,setP]=useState(exercise?exercise.p:"Squat");
  const[m,setM]=useState(exercise?exercise.m:"Quads/Glutes");
  const[e,setE]=useState(exercise?exercise.e:"BW");
  const[u,setU]=useState(exercise?exercise.u:"");
  const[g,setG]=useState(exercise?exercise.g||"":"");
  const[c,setC]=useState(exercise?exercise.c||"":"");
  const sel=(label,val,setter,opts)=>(<div style={{marginBottom:10}}><div style={{fontSize:11,color:B.muted,marginBottom:4,fontWeight:600}}>{label}</div><select value={val} onChange={ev=>setter(ev.target.value)} style={{width:"100%",boxSizing:"border-box",background:B.darker,border:"1px solid "+B.border,borderRadius:8,color:B.text,padding:"8px 12px",fontSize:13,outline:"none"}}>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select></div>);
  const field=(label,val,setter,ph)=>(<div style={{marginBottom:10}}><div style={{fontSize:11,color:B.muted,marginBottom:4,fontWeight:600}}>{label}</div><input value={val} onChange={ev=>setter(ev.target.value)} placeholder={ph} style={{width:"100%",boxSizing:"border-box",background:B.darker,border:"1px solid "+B.border,borderRadius:8,color:B.text,padding:"8px 12px",fontSize:13,outline:"none"}}/></div>);
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9998}} onClick={onClose}><div onClick={ev=>ev.stopPropagation()} style={{background:B.dark,border:"1px solid "+B.border,borderRadius:16,width:"90%",maxWidth:480,padding:24,maxHeight:"90vh",overflowY:"auto"}}>
    <div style={{fontSize:15,fontWeight:700,color:B.accent,marginBottom:16}}>{exercise?"Edit Exercise":"Add Exercise"}</div>
    {field("Exercise Name",n,setN,"e.g. Goblet Squat")}
    {sel("Pattern",p,setP,PATS.filter(x=>x!=="All"))}
    {sel("Muscle Group",m,setM,MUSCLES)}
    {field("Equipment",e,setE,"e.g. KB, DB, BW, BB")}
    {field("YouTube URL (optional)",u,setU,"https://youtube.com/watch?v=...")}
    {field("GIF URL (optional)",g,setG,"https://example.com/exercise.gif")}
    {g&&<div style={{marginBottom:10,borderRadius:8,overflow:"hidden",maxWidth:200}}><img src={g} alt="GIF preview" style={{width:"100%",borderRadius:8}} onError={e=>{e.target.style.display="none"}}/></div>}
    <div style={{marginBottom:10}}><div style={{fontSize:11,color:B.muted,marginBottom:4,fontWeight:600}}>Coaching Cues</div><textarea value={c} onChange={ev=>setC(ev.target.value)} placeholder="1. First cue. 2. Second cue. 3. Third cue." rows={3} style={{width:"100%",boxSizing:"border-box",background:B.darker,border:"1px solid "+B.border,borderRadius:8,color:B.text,padding:"8px 12px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"inherit"}}/></div>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
      <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:"1px solid "+B.border,background:"transparent",color:B.muted,cursor:"pointer",fontSize:13,fontWeight:600}}>Cancel</button>
      <button onClick={()=>{if(!n.trim())return;onSave({n:n.trim(),p,m:m.trim(),e:e.trim(),u:u.trim(),g:g.trim()||undefined,c:c.trim()});onClose();}} style={{padding:"8px 20px",borderRadius:8,border:"none",background:B.accent,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>{exercise?"Save Changes":"Add Exercise"}</button>
    </div>
  </div></div>);
}
