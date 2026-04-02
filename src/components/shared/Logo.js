export default function Logo({s=140}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <img src="https://hybridfitnessgym.com/wp-content/uploads/2020/11/hybrid-fitness-long-website.png" alt="Hybrid Fitness" style={{height:s*.28,objectFit:"contain",filter:"brightness(1.1)"}}/>
    </div>
  );
}
