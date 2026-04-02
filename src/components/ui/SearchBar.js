import { useTheme } from "../../context/ThemeContext";
export default function SearchBar({value, onChange, placeholder="Search..."}) {
  const B = useTheme();
  return <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{background:B.card,border:"1px solid "+B.border,borderRadius:10,color:B.text,padding:"12px 18px",fontSize:14,outline:"none",width:"100%",maxWidth:500,boxSizing:"border-box"}}/>;
}
