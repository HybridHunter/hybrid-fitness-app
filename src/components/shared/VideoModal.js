import { useTheme } from "../../context/ThemeContext";
import { getYTId } from "../../utils/youtube";
export default function VideoModal({url, title, onClose}) {
  const B = useTheme();
  const vid = getYTId(url);
  if (!vid) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"90%",maxWidth:800,background:B.dark,borderRadius:16,overflow:"hidden",border:"1px solid "+B.border}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid "+B.border}}>
          <span style={{color:B.accent,fontWeight:700,fontSize:14}}>{title||"Exercise Demo"}</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:B.muted,cursor:"pointer",fontSize:20,fontWeight:700,lineHeight:1}}>{"\u2715"}</button>
        </div>
        <div style={{position:"relative",paddingBottom:"56.25%",height:0}}>
          <iframe src={"https://www.youtube.com/embed/"+vid+"?autoplay=1&rel=0"} title="Demo" allow="autoplay;encrypted-media" allowFullScreen style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none"}}/>
        </div>
      </div>
    </div>
  );
}
