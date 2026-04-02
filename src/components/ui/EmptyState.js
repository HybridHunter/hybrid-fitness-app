import { useTheme } from "../../context/ThemeContext";
export default function EmptyState({icon, title, subtitle}) {
  const B = useTheme();
  return <div style={{textAlign:"center",padding:60,color:B.dim}}>{icon&&<div style={{fontSize:42,marginBottom:12}}>{icon}</div>}<div style={{fontSize:15,fontWeight:600}}>{title}</div>{subtitle&&<div style={{fontSize:12,marginTop:6}}>{subtitle}</div>}</div>;
}
