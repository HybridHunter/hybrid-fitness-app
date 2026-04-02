import { useTheme } from "../../context/ThemeContext";
import Card from "../../components/ui/Card";

export default function ShopView() {
  const B = useTheme();
  return (
    <div>
      <h1 style={{fontSize:24,fontWeight:800,color:B.text,marginBottom:8}}>Shop</h1>
      <p style={{color:B.muted,marginBottom:24}}>Product inventory and point-of-sale tracking.</p>
      <Card>
        <div style={{padding:40,textAlign:"center",color:B.dim}}>
          <div style={{fontSize:48,marginBottom:16}}>🛍️</div>
          <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Coming Soon</div>
          <div style={{fontSize:13}}>Product catalog, inventory management, and simple point-of-sale for supplements, merch, and gear.</div>
        </div>
      </Card>
    </div>
  );
}
