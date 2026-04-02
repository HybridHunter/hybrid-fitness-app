import { useTheme } from "../../context/ThemeContext";
export default function Modal({children, onClose}) {
  const B = useTheme();
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9998}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:B.dark,border:"1px solid "+B.border,borderRadius:16,width:"90%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",padding:24}}>
        {children}
      </div>
    </div>
  );
}
