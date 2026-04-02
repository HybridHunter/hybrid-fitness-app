export const PC = { Squat:"#e94560",Hinge:"#f59e0b",Lunge:"#22c55e",Push:"#3b82f6",Pull:"#a855f7",Core:"#ff7043",Carry:"#26a69a",Cardio:"#ef4444",Power:"#fbbf24",Mobility:"#78909c",Accessory:"#a1887f" };
export const PATS = ["All","Squat","Hinge","Lunge","Push","Pull","Core","Carry","Cardio","Power","Mobility","Accessory"];
export const MUSCLES = ["Quads/Glutes","Glutes/Hams","Glutes/Add.","Quads/Add.","Hams/Glutes","Hamstrings","Glutes","Post. Chain","Chest","Upper Chest","Chest/Tris","Shoulders","Triceps","Back/Lats","Rear Delts","Biceps","Core","Obliques","Lower Back","Calves","Full Body"];
export const DSEC = [{id:"A",name:"Strength",repRange:"6-8 reps",color:"#8fbf3b",slotCount:1},{id:"B",name:"Accessories",repRange:"8-15 reps",color:"#3b82f6",slotCount:1},{id:"C",name:"Dynamic & Abs",repRange:"Conditioning",color:"#22c55e",slotCount:1}];
export const emptySlot = ()=>({exercise:null,sets:"",reps:"",rpe:"",tempo:"",notes:""});
export const getLabel = (secId,idx)=>secId+(idx+1);
