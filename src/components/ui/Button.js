import { useTheme } from "../../context/ThemeContext";
export default function Button({children, onClick, variant="primary", style={}, ...props}) {
  const B = useTheme();
  const base = {padding:"8px 16px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,border:"none",transition:"all .15s"};
  const variants = {
    primary: {background:B.accent,color:"#fff"},
    danger: {background:B.red+"15",border:"1px solid "+B.red+"30",color:B.red},
    ghost: {background:B.card,border:"1px solid "+B.border,color:B.muted},
  };
  return <button onClick={onClick} style={{...base,...(variants[variant]||variants.primary),...style}} {...props}>{children}</button>;
}
