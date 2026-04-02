export default function Logo({s=140}) {
  let logoUrl = null;
  let primaryColor = "#8fbf3b";
  let gymName = null;
  try {
    const branding = JSON.parse(localStorage.getItem("hf_branding") || "{}");
    if (branding.logo) logoUrl = branding.logo;
    else if (branding.logoUrl) logoUrl = branding.logoUrl;
    if (branding.primaryColor) primaryColor = branding.primaryColor;
    if (branding.gymName) gymName = branding.gymName;
  } catch (e) { /* ignore */ }

  if (logoUrl) {
    return (
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <img src={logoUrl} alt="Logo" style={{height:s*.28,objectFit:"contain"}} onError={e=>{e.target.style.display="none"}}/>
      </div>
    );
  }

  // Fallback: text logo with branding color
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{fontWeight:900,fontSize:s*.17,letterSpacing:-1}}>
        {gymName ? (
          <span style={{color:primaryColor}}>{gymName}</span>
        ) : (
          <><span style={{color:primaryColor}}>Gym</span><span>Kit</span></>
        )}
      </div>
    </div>
  );
}
