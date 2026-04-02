import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import ConfirmDialog from "../../components/shared/ConfirmDialog";

export default function ProgramsView({programs,setPrograms,workouts}){
  const B=useTheme();
  const[confirm,setConfirm]=useState(null);
  const[printW,setPrintW]=useState(null);

  const doPrint=(w)=>{setPrintW(w);setTimeout(()=>window.print(),200);};

  return(<div>
    {confirm&&<ConfirmDialog msg={confirm.msg} onOk={confirm.action} onNo={()=>setConfirm(null)}/>}

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{fontSize:18,fontWeight:700}}>Programs <span style={{color:B.muted,fontSize:13}}>({programs.length})</span></div>
      <button onClick={()=>{const name=prompt("Program name:");if(name)setPrograms(p=>[...p,{id:Date.now(),name,workoutIds:[],description:"",date:new Date().toISOString()}]);}} style={{background:B.accent,border:"none",borderRadius:8,color:"#fff",padding:"8px 18px",fontSize:12,cursor:"pointer",fontWeight:700}}>+ New Program</button>
    </div>
    {programs.length===0?(<div style={{textAlign:"center",padding:60,color:B.dim}}><div style={{fontSize:42,marginBottom:12}}>&#128203;</div><div style={{fontSize:15,fontWeight:600}}>No programs yet</div><div style={{fontSize:12,marginTop:6}}>Programs are collections of workouts</div></div>):(
    <div style={{display:"grid",gap:16}}>{programs.map(prog=>{const pw=workouts.filter(w=>prog.workoutIds.includes(w.id));const avail=workouts.filter(w=>!prog.workoutIds.includes(w.id));return(
      <div key={prog.id} style={{background:B.card,borderRadius:12,border:"1px solid "+B.border,padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:16,fontWeight:800,color:B.accent}}>{prog.name}</div>
          <button onClick={()=>setConfirm({msg:"Delete this program? This cannot be undone.",action:()=>{setPrograms(p=>p.filter(x=>x.id!==prog.id));setConfirm(null);}})} style={{background:B.red+"15",border:"1px solid "+B.red+"30",borderRadius:6,color:B.red,cursor:"pointer",fontSize:10,padding:"5px 12px",fontWeight:700}}>Delete</button>
        </div>
        <textarea value={prog.description} onChange={e=>setPrograms(p=>p.map(x=>x.id===prog.id?{...x,description:e.target.value}:x))} placeholder="Program description..." rows={2} style={{width:"100%",boxSizing:"border-box",background:B.dark,border:"1px solid "+B.border,borderRadius:6,color:B.text,padding:"8px 10px",fontSize:11,outline:"none",resize:"vertical",marginBottom:10,fontFamily:"inherit"}}/>
        <div style={{fontSize:11,fontWeight:700,color:B.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Workouts in Program</div>
        {pw.length===0&&<div style={{color:B.dim,fontSize:12,padding:8}}>No workouts added yet</div>}
        {pw.map((w,i)=>(
          <div key={w.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,background:B.dark,marginBottom:4}}>
            <span style={{color:B.accent,fontWeight:700,fontSize:12,minWidth:20}}>{i+1}.</span>
            <span style={{color:B.text,fontSize:13,flex:1}}>{w.name}</span>
            <span style={{color:B.dim,fontSize:11}}>{w.phase}</span>
            <button onClick={()=>doPrint(w)} style={{background:B.accent+"15",border:"none",borderRadius:4,color:B.accent,cursor:"pointer",fontSize:10,padding:"3px 8px"}}>Print</button>
            <button onClick={()=>setPrograms(p=>p.map(x=>x.id===prog.id?{...x,workoutIds:x.workoutIds.filter(id=>id!==w.id)}:x))} style={{background:"none",border:"none",color:B.red,cursor:"pointer",fontSize:12}}>&times;</button>
          </div>
        ))}
        {avail.length>0&&(<select onChange={e=>{const wid=Number(e.target.value);if(wid)setPrograms(p=>p.map(x=>x.id===prog.id?{...x,workoutIds:[...x.workoutIds,wid]}:x));e.target.value="";}} defaultValue="" style={{marginTop:8,background:B.dark,border:"1px dashed "+B.border,borderRadius:6,color:B.muted,padding:"6px 10px",fontSize:11,outline:"none",width:"100%"}}><option value="">+ Add workout to program...</option>{avail.map(w=><option key={w.id} value={w.id}>{w.name} ({w.phase})</option>)}</select>)}
      </div>
    );})}
    </div>)}
  </div>);
}
