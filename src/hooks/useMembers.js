import { useLocalStorage } from "./useLocalStorage";

const DEMO_MEMBERS = [
  {id:crypto.randomUUID(),firstName:"Sarah",lastName:"Johnson",email:"sarah@example.com",phone:"555-0101",pin:"1234",membershipPlanId:"",membershipStatus:"active",photo:"",familyGroupId:null,startDate:"2025-09-15",notes:"Marathon runner, focus on injury prevention",tags:["morning"],address:{street:"742 Evergreen Terrace",city:"Springfield",state:"IL",zip:"62701",country:"US"},movementScores:{Squat:2,Hinge:1,Lunge:0,Push:1,Pull:2,Core:1,Carry:2},gamification:{level:12,xp:2400,totalWorkouts:87,totalWeightLifted:42350,badges:["First Workout","10 Workouts","50 Workouts"],currentStreak:5,longestStreak:14},rank:{current:"Silver",promotionDate:"2026-01-10"},inbody:{lastScan:"2026-03-15",history:[{id:crypto.randomUUID(),date:"2025-11-01",weight:142,bodyFatPercent:26.3,skeletalMuscleMass:54.2,bmi:22.8,bmr:1380,bodyFatMass:37.3,totalBodyWater:77.5,visceralFatLevel:5,segmentalLean:{leftArm:5.1,rightArm:5.3,trunk:42.8,leftLeg:16.2,rightLeg:16.4}},{id:crypto.randomUUID(),date:"2026-01-10",weight:139,bodyFatPercent:24.1,skeletalMuscleMass:55.8,bmi:22.3,bmr:1395,bodyFatMass:33.5,totalBodyWater:79.1,visceralFatLevel:4,segmentalLean:{leftArm:5.3,rightArm:5.5,trunk:43.6,leftLeg:16.8,rightLeg:17.0}},{id:crypto.randomUUID(),date:"2026-03-15",weight:136,bodyFatPercent:22.5,skeletalMuscleMass:57.1,bmi:21.8,bmr:1410,bodyFatMass:30.6,totalBodyWater:80.8,visceralFatLevel:4,segmentalLean:{leftArm:5.5,rightArm:5.7,trunk:44.2,leftLeg:17.2,rightLeg:17.4}}]},createdAt:"2025-09-15T10:00:00Z",_demo:true},
  {id:crypto.randomUUID(),firstName:"Mike",lastName:"Chen",email:"mike@example.com",phone:"555-0102",pin:"2345",membershipPlanId:"",membershipStatus:"active",photo:"",familyGroupId:null,startDate:"2025-11-01",notes:"New to strength training",tags:["evening"],address:{street:"1600 Pennsylvania Ave",city:"Austin",state:"TX",zip:"78701",country:"US"},movementScores:{Squat:-1,Hinge:0,Lunge:-1,Push:0,Pull:-1,Core:0,Carry:0},gamification:{level:5,xp:950,totalWorkouts:32,totalWeightLifted:15200,badges:["First Workout","10 Workouts"],currentStreak:2,longestStreak:7},rank:{current:"Bronze",promotionDate:null},inbody:{lastScan:"2026-02-20",history:[{id:crypto.randomUUID(),date:"2025-12-01",weight:195,bodyFatPercent:28.7,skeletalMuscleMass:62.4,bmi:27.2,bmr:1780,bodyFatMass:56.0,totalBodyWater:99.2,visceralFatLevel:11,segmentalLean:{leftArm:7.2,rightArm:7.5,trunk:50.1,leftLeg:19.8,rightLeg:20.1}},{id:crypto.randomUUID(),date:"2026-02-20",weight:189,bodyFatPercent:25.9,skeletalMuscleMass:64.8,bmi:26.4,bmr:1810,bodyFatMass:48.9,totalBodyWater:102.4,visceralFatLevel:10,segmentalLean:{leftArm:7.6,rightArm:7.9,trunk:51.8,leftLeg:20.6,rightLeg:20.9}}]},createdAt:"2025-11-01T10:00:00Z",_demo:true},
  {id:crypto.randomUUID(),firstName:"Emily",lastName:"Rodriguez",email:"emily@example.com",phone:"555-0103",pin:"3456",membershipPlanId:"",membershipStatus:"active",photo:"",familyGroupId:null,startDate:"2025-06-20",notes:"Competitive CrossFit athlete",tags:["morning","competitor"],address:{street:"350 Fifth Avenue",city:"Denver",state:"CO",zip:"80202",country:"US"},movementScores:{Squat:3,Hinge:2,Lunge:2,Push:3,Pull:2,Core:2,Carry:3},gamification:{level:22,xp:5800,totalWorkouts:156,totalWeightLifted:98400,badges:["First Workout","10 Workouts","50 Workouts","100 Workouts","Iron Club"],currentStreak:12,longestStreak:30},rank:{current:"Gold",promotionDate:"2025-12-01"},inbody:{lastScan:"2026-03-20",history:[{id:crypto.randomUUID(),date:"2025-08-15",weight:135,bodyFatPercent:19.2,skeletalMuscleMass:59.8,bmi:21.1,bmr:1420,bodyFatMass:25.9,totalBodyWater:84.6,visceralFatLevel:3,segmentalLean:{leftArm:5.8,rightArm:6.0,trunk:45.1,leftLeg:17.8,rightLeg:18.0}},{id:crypto.randomUUID(),date:"2025-12-10",weight:133,bodyFatPercent:17.8,skeletalMuscleMass:61.2,bmi:20.8,bmr:1440,bodyFatMass:23.7,totalBodyWater:86.2,visceralFatLevel:3,segmentalLean:{leftArm:6.0,rightArm:6.2,trunk:46.0,leftLeg:18.2,rightLeg:18.5}},{id:crypto.randomUUID(),date:"2026-03-20",weight:132,bodyFatPercent:16.4,skeletalMuscleMass:62.5,bmi:20.6,bmr:1455,bodyFatMass:21.6,totalBodyWater:87.8,visceralFatLevel:2,segmentalLean:{leftArm:6.2,rightArm:6.4,trunk:46.8,leftLeg:18.6,rightLeg:18.9}}]},createdAt:"2025-06-20T10:00:00Z",_demo:true},
  {id:crypto.randomUUID(),firstName:"James",lastName:"Williams",email:"james@example.com",phone:"555-0104",pin:"4567",membershipPlanId:"",membershipStatus:"frozen",photo:"",familyGroupId:null,startDate:"2025-08-10",notes:"Recovering from knee surgery, cleared for upper body only",tags:["rehab"],address:{street:"",city:"",state:"",zip:"",country:"US"},movementScores:{Squat:-3,Hinge:-2,Lunge:-3,Push:1,Pull:1,Core:0,Carry:-1},gamification:{level:8,xp:1600,totalWorkouts:48,totalWeightLifted:22100,badges:["First Workout","10 Workouts"],currentStreak:0,longestStreak:10},rank:{current:"Bronze",promotionDate:null},inbody:{lastScan:null,history:[]},createdAt:"2025-08-10T10:00:00Z",_demo:true},
  {id:crypto.randomUUID(),firstName:"Lisa",lastName:"Park",email:"lisa@example.com",phone:"555-0105",pin:"5678",membershipPlanId:"",membershipStatus:"active",photo:"",familyGroupId:null,startDate:"2026-01-05",notes:"Goals: weight loss and general fitness",tags:["afternoon"],address:{street:"2201 N Lamar Blvd",city:"Austin",state:"TX",zip:"78705",country:"US"},movementScores:{Squat:0,Hinge:0,Lunge:0,Push:-1,Pull:0,Core:-1,Carry:0},gamification:{level:3,xp:450,totalWorkouts:15,totalWeightLifted:6800,badges:["First Workout","10 Workouts"],currentStreak:3,longestStreak:5},rank:{current:"White",promotionDate:null},inbody:{lastScan:"2026-03-01",history:[{id:crypto.randomUUID(),date:"2026-01-10",weight:168,bodyFatPercent:34.2,skeletalMuscleMass:46.8,bmi:28.6,bmr:1340,bodyFatMass:57.5,totalBodyWater:71.2,visceralFatLevel:9,segmentalLean:{leftArm:4.2,rightArm:4.3,trunk:38.6,leftLeg:14.1,rightLeg:14.3}},{id:crypto.randomUUID(),date:"2026-03-01",weight:162,bodyFatPercent:31.8,skeletalMuscleMass:48.2,bmi:27.6,bmr:1360,bodyFatMass:51.5,totalBodyWater:73.8,visceralFatLevel:8,segmentalLean:{leftArm:4.4,rightArm:4.5,trunk:39.4,leftLeg:14.6,rightLeg:14.8}}]},createdAt:"2026-01-05T10:00:00Z",_demo:true},
  {id:crypto.randomUUID(),firstName:"David",lastName:"Martinez",email:"david@example.com",phone:"555-0106",pin:"6789",membershipPlanId:"",membershipStatus:"trial",photo:"",familyGroupId:null,startDate:"2026-03-25",notes:"Free trial week, interested in semi-private training",tags:["trial"],address:{street:"",city:"",state:"",zip:"",country:"US"},movementScores:{Squat:0,Hinge:0,Lunge:0,Push:0,Pull:0,Core:0,Carry:0},gamification:{level:1,xp:50,totalWorkouts:2,totalWeightLifted:1200,badges:["First Workout"],currentStreak:1,longestStreak:1},rank:{current:"White",promotionDate:null},inbody:{lastScan:null,history:[]},createdAt:"2026-03-25T10:00:00Z",_demo:true},
  {id:crypto.randomUUID(),firstName:"Rachel",lastName:"Kim",email:"rachel@example.com",phone:"555-0107",pin:"7890",membershipPlanId:"",membershipStatus:"inactive",photo:"",familyGroupId:null,startDate:"2025-04-01",notes:"Cancelled — moved out of area",tags:[],address:{street:"",city:"",state:"",zip:"",country:"US"},movementScores:{Squat:1,Hinge:1,Lunge:1,Push:1,Pull:1,Core:1,Carry:1},gamification:{level:15,xp:3200,totalWorkouts:104,totalWeightLifted:51200,badges:["First Workout","10 Workouts","50 Workouts","100 Workouts"],currentStreak:0,longestStreak:21},rank:{current:"Silver",promotionDate:"2025-08-15"},inbody:{lastScan:null,history:[]},createdAt:"2025-04-01T10:00:00Z",_demo:true},
  {id:crypto.randomUUID(),firstName:"Tom",lastName:"Baker",email:"tom@example.com",phone:"555-0108",pin:"8901",membershipPlanId:"",membershipStatus:"active",photo:"",familyGroupId:null,startDate:"2025-10-12",notes:"Former college football player, trains 5x/week",tags:["morning","athlete"],address:{street:"1234 Elm Street",city:"Portland",state:"OR",zip:"97201",country:"US"},movementScores:{Squat:2,Hinge:2,Lunge:1,Push:2,Pull:1,Core:1,Carry:2},gamification:{level:18,xp:4200,totalWorkouts:128,totalWeightLifted:78600,badges:["First Workout","10 Workouts","50 Workouts","100 Workouts","Iron Club"],currentStreak:8,longestStreak:22},rank:{current:"Gold",promotionDate:"2026-02-01"},inbody:{lastScan:null,history:[]},createdAt:"2025-10-12T10:00:00Z",_demo:true},
];

const demoCleared = () => { try { return localStorage.getItem("hf_demo_cleared") === "true"; } catch { return false; } };

export function useMembers() {
  const [members, setMembers] = useLocalStorage("hf_members", demoCleared() ? [] : DEMO_MEMBERS);

  const addMember = (member) => {
    const newMember = {
      id: crypto.randomUUID(),
      photo: "",
      familyGroupId: null,
      membershipStatus: "active",
      tags: [],
      address: { street: "", city: "", state: "", zip: "", country: "US" },
      movementScores: { Squat:0, Hinge:0, Lunge:0, Push:0, Pull:0, Core:0, Carry:0 },
      gamification: { level:1, xp:0, totalWorkouts:0, totalWeightLifted:0, badges:[], currentStreak:0, longestStreak:0 },
      rank: { current:"White", promotionDate:null },
      inbody: { lastScan: null, history: [] },
      createdAt: new Date().toISOString(),
      ...member,
    };
    setMembers(prev => [...prev, newMember]);
    return newMember;
  };

  const updateMember = (id, updates) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const deleteMember = (id) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const getMember = (id) => members.find(m => m.id === id) || null;

  return { members, setMembers, addMember, updateMember, deleteMember, getMember };
}
