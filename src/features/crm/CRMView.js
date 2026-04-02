import { useTheme } from "../../context/ThemeContext";
import Card from "../../components/ui/Card";

export default function CRMView() {
  const B = useTheme();
  return (
    <div>
      <h1 style={{fontSize:24,fontWeight:800,color:B.text,marginBottom:8}}>Lead Pipeline</h1>
      <p style={{color:B.muted,marginBottom:24}}>Kanban-style lead tracking and communication log.</p>
      <Card>
        <div style={{padding:40,textAlign:"center",color:B.dim}}>
          <div style={{fontSize:48,marginBottom:16}}>🔻</div>
          <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Coming Soon</div>
          <div style={{fontSize:13}}>Drag-and-drop lead pipeline with stage tracking, follow-up reminders, and communication history.</div>
        </div>
      </Card>
    </div>
  );
}
