import { useTheme } from "../../context/ThemeContext";
export default function Tabs({tabs, active, onChange}) {
  const B = useTheme();
  return <div style={{display:"flex",gap:4,marginBottom:16}}>{tabs.map(t=>(
    <button key={t.id} onClick={()=>onChange(t.id)} style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1,background:active===t.id?B.accent:B.card,color:active===t.id?"#fff":B.muted,transition:"all .15s"}}>{t.label}</button>
  ))}</div>;
}
