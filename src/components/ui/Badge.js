import { useTheme } from "../../context/ThemeContext";
export default function Badge({label, color}) {
  const B = useTheme();
  const c = color || B.accent;
  return <span style={{padding:"3px 10px",borderRadius:6,fontSize:10,fontWeight:700,textTransform:"uppercase",background:c+"20",color:c}}>{label}</span>;
}
