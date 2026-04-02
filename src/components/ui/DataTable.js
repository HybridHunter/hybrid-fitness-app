import { useTheme } from "../../context/ThemeContext";
export default function DataTable({columns, rows, onRowClick}) {
  const B = useTheme();
  return <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
    <thead><tr>{columns.map(c=><th key={c.key} style={{textAlign:c.align||"left",padding:"8px 10px",borderBottom:"1px solid "+B.border,color:B.muted,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:1,width:c.width||"auto"}}>{c.label}</th>)}</tr></thead>
    <tbody>{rows.map((row,i)=><tr key={row.id||i} onClick={()=>onRowClick&&onRowClick(row)} style={{cursor:onRowClick?"pointer":"default",borderBottom:"1px solid "+B.border+"60"}} onMouseOver={e=>e.currentTarget.style.background=B.card} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
      {columns.map(c=><td key={c.key} style={{padding:"8px 10px",textAlign:c.align||"left",color:B.text}}>{c.render?c.render(row):row[c.key]}</td>)}
    </tr>)}</tbody>
  </table>;
}
