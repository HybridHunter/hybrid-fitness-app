import { useTheme } from "../../context/ThemeContext";
import Card from "../../components/ui/Card";

export default function RankView() {
  const B = useTheme();
  return (
    <div>
      <h1 style={{fontSize:24,fontWeight:800,color:B.text,marginBottom:8}}>Ranks & Progression</h1>
      <p style={{color:B.muted,marginBottom:24}}>Belt/rank system with promotion criteria.</p>
      <Card>
        <div style={{padding:40,textAlign:"center",color:B.dim}}>
          <div style={{fontSize:48,marginBottom:16}}>🎖️</div>
          <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Coming Soon</div>
          <div style={{fontSize:13}}>Customizable belt and rank tiers with promotion requirements, assessment thresholds, and member progress tracking.</div>
        </div>
      </Card>
    </div>
  );
}
