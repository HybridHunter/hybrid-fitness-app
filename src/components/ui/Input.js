import { useTheme } from "../../context/ThemeContext";
export default function Input({value, onChange, placeholder, style={}, ...props}) {
  const B = useTheme();
  return <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{background:B.card,border:"1px solid "+B.border,borderRadius:8,color:B.text,padding:"8px 12px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",...style}} {...props}/>;
}
