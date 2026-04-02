import { useTheme } from "../../context/ThemeContext";
export default function ConfirmDialog({msg, onOk, onNo}) {
  const B = useTheme();
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
      <div style={{background:B.card,border:"1px solid "+B.border,borderRadius:16,padding:28,maxWidth:400,width:"90%"}}>
        <div style={{fontSize:15,color:B.text,marginBottom:20,lineHeight:1.5}}>{msg}</div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onNo} style={{padding:"8px 18px",borderRadius:8,border:"1px solid "+B.border,background:"transparent",color:B.muted,cursor:"pointer",fontSize:13,fontWeight:600}}>Cancel</button>
          <button onClick={onOk} style={{padding:"8px 18px",borderRadius:8,border:"none",background:B.red,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>Delete</button>
        </div>
      </div>
    </div>
  );
}
