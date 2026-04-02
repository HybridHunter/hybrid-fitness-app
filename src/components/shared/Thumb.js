import { getYTThumb } from "../../utils/youtube";
export default function Thumb({ex, onClick, size="md"}) {
  const gif = ex.g; // GIF URL
  const thumb = gif || getYTThumb(ex.u);
  const hasMedia = gif || ex.u;
  const h = size==="sm"?56:size==="lg"?120:80;
  const w = Math.round(h*1.78);
  return (
    <div onClick={onClick} style={{position:"relative",width:w,height:h,borderRadius:8,overflow:"hidden",cursor:hasMedia?"pointer":"default",flexShrink:0,background:"#000"}}>
      {thumb?<img src={thumb} alt={ex.n} style={{width:"100%",height:"100%",objectFit:"cover",opacity:gif?.7:.7}}/>:<div style={{width:"100%",height:"100%",background:"#222"}}/>}
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",padding:4}}>
        <div style={{color:"#fff",fontSize:size==="sm"?8:10,fontWeight:700,textAlign:"center",textShadow:"0 1px 4px rgba(0,0,0,.9)",lineHeight:1.2,maxWidth:"95%",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{ex.n}</div>
        {hasMedia&&!gif&&<div style={{color:"#fff",fontSize:size==="sm"?14:20,marginTop:2,textShadow:"0 1px 6px rgba(0,0,0,.9)"}}>{"\u25B6"}</div>}
        {gif&&<div style={{color:"#fff",fontSize:size==="sm"?8:10,marginTop:2,textShadow:"0 1px 4px rgba(0,0,0,.9)",fontWeight:600}}>GIF</div>}
      </div>
    </div>
  );
}
