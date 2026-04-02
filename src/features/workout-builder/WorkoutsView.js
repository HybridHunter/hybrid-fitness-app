import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { DSEC, getLabel } from "../../data/constants";
import VideoModal from "../../components/shared/VideoModal";
import ConfirmDialog from "../../components/shared/ConfirmDialog";
import Thumb from "../../components/shared/Thumb";

function PrintArea({w}){if(!w)return null;const secs=w.sections||DSEC;
return(<div id="print-area"><style>{`
@media print{
  body>*{display:none!important}
  #print-area{display:block!important;position:fixed;left:0;top:0;width:100%;padding:24px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;font-size:11px;z-index:99999}
  #print-area *{visibility:visible!important;color:#000!important}
  .no-print{display:none!important}
}
@media screen{#print-area{display:none}}
`}</style>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"3px solid #1a1a1a",paddingBottom:10,marginBottom:14}}>
  <img src="https://hybridfitnessgym.com/wp-content/uploads/2020/11/hybrid-fitness-long-website.png" alt="Hybrid Fitness" style={{height:36,objectFit:"contain"}}/>
  <div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:800}}>{w.name||"Workout"}</div><div style={{fontSize:12,color:"#555"}}>{w.phase} &middot; {w.workoutLabel}</div></div>
</div>
{w.description&&<div style={{fontSize:11,color:"#444",marginBottom:12,fontStyle:"italic",borderLeft:"3px solid #ccc",paddingLeft:8}}>{w.description}</div>}
{secs.map((sec,si)=>{const ss=w.sections[si]?.slots||[];const filled=ss.filter(s=>s.exercise);if(!filled.length)return null;return(<div key={si} style={{marginBottom:12,pageBreakInside:"avoid"}}>
  <div style={{fontSize:13,fontWeight:800,textTransform:"uppercase",borderBottom:"2px solid #333",paddingBottom:3,marginBottom:6}}>{sec.id}. {sec.name} <span style={{fontWeight:400,fontSize:10,color:"#888"}}>({sec.repRange})</span></div>
  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
    <thead><tr style={{background:"#f0f0f0"}}><th style={{textAlign:"left",padding:"4px 6px",width:24,borderBottom:"1px solid #ccc"}}>#</th><th style={{textAlign:"left",padding:"4px 6px",borderBottom:"1px solid #ccc"}}>Exercise</th><th style={{textAlign:"center",padding:"4px 6px",width:40,borderBottom:"1px solid #ccc"}}>Sets</th><th style={{textAlign:"center",padding:"4px 6px",width:40,borderBottom:"1px solid #ccc"}}>Reps</th><th style={{textAlign:"center",padding:"4px 6px",width:34,borderBottom:"1px solid #ccc"}}>RPE</th><th style={{textAlign:"center",padding:"4px 6px",width:50,borderBottom:"1px solid #ccc"}}>Tempo</th><th style={{textAlign:"left",padding:"4px 6px",borderBottom:"1px solid #ccc"}}>Notes</th></tr></thead>
    <tbody>{ss.map((s,i)=>{if(!s.exercise)return null;return(<tr key={i} style={{borderBottom:"1px solid #e0e0e0"}}>
      <td style={{padding:"5px 6px",fontWeight:700}}>{getLabel(sec.id,i)}</td>
      <td style={{padding:"5px 6px"}}><strong>{s.exercise.n}</strong>{s.exercise.c&&<div style={{fontSize:9,color:"#666",marginTop:2}}>{s.exercise.c}</div>}</td>
      <td style={{textAlign:"center",padding:"5px 6px"}}>{s.sets}</td>
      <td style={{textAlign:"center",padding:"5px 6px"}}>{s.reps}</td>
      <td style={{textAlign:"center",padding:"5px 6px"}}>{s.rpe}</td>
      <td style={{textAlign:"center",padding:"5px 6px"}}>{s.tempo}</td>
      <td style={{padding:"5px 6px",fontSize:10,color:"#555"}}>{s.notes}</td>
    </tr>);})}</tbody>
  </table>
</div>);})}
<div style={{textAlign:"center",marginTop:16,fontSize:9,color:"#aaa",borderTop:"1px solid #ddd",paddingTop:8}}>hybridfitnessgym.com &middot; Hybrid Systems, LLC</div>
</div>);}

export default function WorkoutsView({workouts,setWorkouts,exercises,onLoad}){
  const B=useTheme();
  const[confirm,setConfirm]=useState(null);
  const[printW,setPrintW]=useState(null);
  const[video,setVideo]=useState(null);

  const openVideo=(url,title)=>setVideo({url,title});
  const doPrint=(w)=>{setPrintW(w);setTimeout(()=>window.print(),200);};

  return(<div>
    {confirm&&<ConfirmDialog msg={confirm.msg} onOk={confirm.action} onNo={()=>setConfirm(null)}/>}
    {video&&<VideoModal url={video.url} title={video.title} onClose={()=>setVideo(null)}/>}
    <PrintArea w={printW}/>

    <div style={{fontSize:18,fontWeight:700,marginBottom:16}}>Saved Workouts <span style={{color:B.muted,fontSize:13}}>({workouts.length})</span></div>
    {workouts.length===0?(<div style={{textAlign:"center",padding:60,color:B.dim}}><div style={{fontSize:42,marginBottom:12}}>&#127947;&#65039;</div><div style={{fontSize:15,fontWeight:600}}>No saved workouts yet</div></div>):(
    <div style={{display:"grid",gap:12}}>{workouts.map(w=>(
      <div key={w.id} style={{background:B.card,borderRadius:12,border:"1px solid "+B.border,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
          <div><span style={{color:B.accent,fontWeight:800,fontSize:15}}>{w.name}</span><span style={{color:B.dim,margin:"0 8px"}}>&middot;</span><span style={{color:B.muted,fontSize:12}}>{w.phase} &middot; {w.workoutLabel}</span></div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>doPrint(w)} style={{background:B.accent+"15",border:"1px solid "+B.accent+"30",borderRadius:6,color:B.accent,cursor:"pointer",fontSize:10,padding:"5px 12px",fontWeight:700}}>Print</button>
            <button onClick={()=>onLoad(w)} style={{background:B.blue+"30",border:"1px solid "+B.blue+"50",borderRadius:6,color:"#6ea8fe",cursor:"pointer",fontSize:10,padding:"5px 12px",fontWeight:700}}>Edit</button>
            <button onClick={()=>setConfirm({msg:"Delete this workout? This cannot be undone.",action:()=>{setWorkouts(p=>p.filter(x=>x.id!==w.id));setConfirm(null);}})} style={{background:B.red+"15",border:"1px solid "+B.red+"30",borderRadius:6,color:B.red,cursor:"pointer",fontSize:10,padding:"5px 12px",fontWeight:700}}>Delete</button>
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
