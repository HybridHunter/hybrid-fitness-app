import { useTheme } from "../../context/ThemeContext";
export default function Card({children, style={}, onClick, ...props}) {
  const B = useTheme();
  return <div onClick={onClick} style={{background:B.card,borderRadius:12,border:"1px solid "+B.border,padding:16,...style}} {...props}>{children}</div>;
}
