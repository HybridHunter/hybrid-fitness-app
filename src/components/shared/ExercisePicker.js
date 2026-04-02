import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { PATS, PC } from "../../data/constants";
import Thumb from "./Thumb";

export default function ExercisePicker({onSelect, onClose, exercises, onVideo}) {
  const B=useTheme();
  const[q,setQ]=useState("");const[pat,setPat]=useState("All");
  const f=(exercises||[]).filter(e=>{if(pat!=="All"&&e.p!==pat)return false;if(q&&!e.n.toLowerCase().includes(q.toLowerCase())&&!e.m.toLowerCase().includes(q.toLowerCase()))return false;return true;});
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9998}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:B.dark,border:"1px solid "+B.border,borderRadius:16,width:"90%",maxWidth:620,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{padding:"16px 20px",borderBottom:"1px solid "+B.border}}>
      <div style={{fontSize:14,fontWeight:700,color:B.accent,marginBottom:10}}>Select Exercise</div>
      <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." style={{width:"100%",boxSizing:"border-box",background:B.card,border:"1px solid "+B.border,borderRadius:8,color:B.text,padding:"10px 14px",fontSize:13,outline:"none"}}/>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>{PATS.map(p=>(<button key={p} onClick={()=>setPat(p)} style={{padding:"3px 8px",borderRadius:6,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,textTransform:"uppercase",background:pat===p?(PC[p]||B.accent):B.card,color:pat===p?"#fff":B.muted}}>{p}</button>))}</div>
    </div>
    <div style={{overflowY:"auto",flex:1,padding:"8px 12px"}}>{f.slice(0,60).map((ex,i)=>{const c=PC[ex.p]||B.accent;return(<div key={i} onClick={()=>{onSelect(ex);onClose();}} style={{padding:"6px 10px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",gap:8,marginBottom:2}} onMouseOver={e=>e.currentTarget.style.background=c+"18"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
      <Thumb ex={ex} size="sm" onClick={(ev)=>{if(ex.u){ev.stopPropagation();onVideo(ex.u,ex.n);}}}/>
      <div style={{flex:1,minWidth:0}}><div style={{color:B.text,fontSize:13,fontWeight:500}}>{ex.n}</div><div style={{color:B.dim,fontSize:10}}>{ex.p} &middot; {ex.m} &middot; {ex.e}</div>{ex.c&&<div style={{color:B.muted,fontSize:9,marginTop:2,lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ex.c}</div>}</div>
    </div>);})}</div>
  </div></div>);
}
