import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { PATS, PC } from "../../data/constants";
import { EX } from "../../data/exercises";
import ExerciseForm from "../../components/shared/ExerciseForm";
import VideoModal from "../../components/shared/VideoModal";
import ConfirmDialog from "../../components/shared/ConfirmDialog";
import Thumb from "../../components/shared/Thumb";

export default function LibraryView({exercises,setExercises}){
  const B=useTheme();
  const[q,setQ]=useState("");
  const[pat,setPat]=useState("All");
  const[video,setVideo]=useState(null);
  const[exForm,setExForm]=useState(null);
  const[confirm,setConfirm]=useState(null);

  const openVideo=(url,title)=>setVideo({url,title});
  const exs=exercises||EX;
  const f=exs.filter(e=>{if(pat!=="All"&&e.p!==pat)return false;if(q&&!e.n.toLowerCase().includes(q.toLowerCase())&&!e.m.toLowerCase().includes(q.toLowerCase()))return false;return true;});

  return(<div>
    {confirm&&<ConfirmDialog msg={confirm.msg} onOk={confirm.action} onNo={()=>setConfirm(null)}/>}
    {video&&<VideoModal url={video.url} title={video.title} onClose={()=>setVideo(null)}/>}
    {exForm!==null&&<ExerciseForm exercise={exForm||undefined} exercises={exercises} onClose={()=>setExForm(null)} onSave={(ex)=>{if(exForm&&exForm.n){setExercises(p=>p.map(x=>x.n===exForm.n&&x.p===exForm.p?ex:x));}else{setExercises(p=>[...p,ex]);}}}/>}

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <div style={{flex:1,minWidth:280}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search exercises..." style={{background:B.card,border:"1px solid "+B.border,borderRadius:10,color:B.text,padding:"12px 18px",fontSize:14,outline:"none",width:"100%",maxWidth:500,boxSizing:"border-box"}}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
          {PATS.map(p=>(<button key={p} onClick={()=>setPat(p)} style={{padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,textTransform:"uppercase",background:pat===p?(PC[p]||B.accent):B.card,color:pat===p?"#fff":B.muted}}>{p} {p!=="All"&&<span style={{opacity:.6}}>({exs.filter(e=>e.p===p).length})</span>}</button>))}
        </div>
      </div>
      <button onClick={()=>setExForm(false)} style={{background:B.accent,border:"none",borderRadius:8,color:"#fff",padding:"10px 20px",fontSize:12,cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>+ Add Exercise</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:8}}>
      {f.map((ex,i)=>(<div key={i} style={{background:B.card,borderRadius:10,border:"1px solid "+(PC[ex.p]||B.border)+"20",padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
        <Thumb ex={ex} onClick={()=>{if(ex.g){window.open(ex.g,"_blank")}else if(ex.u){openVideo(ex.u,ex.n);}}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{color:B.text,fontSize:13,fontWeight:600}}>{ex.n}</div>{ex.g&&<span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:4,background:B.purple+"20",color:B.purple}}>GIF</span>}</div>
          <div style={{color:B.dim,fontSize:11}}>{ex.p} &middot; {ex.m} &middot; {ex.e}</div>

          {ex.c&&<div style={{color:B.muted,fontSize:10,marginTop:3,lineHeight:1.3}}>{ex.c}</div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
          <button onClick={()=>setExForm(ex)} style={{background:B.blue+"30",border:"none",color:"#6ea8fe",padding:"4px 8px",borderRadius:5,fontSize:10,fontWeight:700,cursor:"pointer"}}>Edit</button>
          <button onClick={()=>setConfirm({msg:'Delete "'+ex.n+'" from the exercise library?',action:()=>{setExercises(p=>p.filter(x=>!(x.n===ex.n&&x.p===ex.p)));setConfirm(null);}})} style={{background:B.red+"20",border:"none",color:B.red,padding:"4px 8px",borderRadius:5,fontSize:10,fontWeight:700,cursor:"pointer"}}>&times;</button>
        </div>
      </div>))}
    </div>
  </div>);
}
