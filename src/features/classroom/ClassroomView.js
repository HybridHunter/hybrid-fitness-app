import { useState, useMemo, useEffect, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";
import RichTextEditor from "../../components/ui/RichTextEditor";
import PlanAccessPicker, { PlanLockBadge } from "../../components/ui/PlanAccessPicker";

/* ── helpers ─────────────────────────────────────────── */
const uid = () => crypto.randomUUID();

function getYTEmbedUrl(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

/* ── demo data ───────────────────────────────────────── */
const DEMO_COURSES = [
  {
    id: uid(), title: "Foundations of Strength", description: "A comprehensive beginner program covering the essential movement patterns, programming principles, and training fundamentals you need to build a strong foundation.",
    coverImage: "", accessType: "open", requiredLevel: 0, allowedPlanIds: [],
    modules: [
      { id: uid(), title: "Getting Started", dripDays: null, lessons: [
        { id: uid(), title: "Welcome to Foundations of Strength", content: "Welcome to Foundations of Strength! This course is designed to take you from complete beginner to confident, capable lifter. Whether you have never touched a barbell or you have been casually training for years without a real plan, this program will give you the knowledge and structure you need.\n\nOver the coming modules, you will learn the fundamental movement patterns that every great training program is built on. You will understand how to read a program, what sets and reps actually mean, and how to gauge your own effort so you get the most out of every session.\n\nTake your time with each lesson. Watch the videos, practice the movements, and do not rush ahead until you feel comfortable. Strength is a lifelong pursuit, and building a proper foundation now will pay dividends for decades.", videoUrl: "", resources: [{ name: "Printable Course Outline", url: "#" }], published: true },
        { id: uid(), title: "How to Use This Program", content: "This program is structured in a specific order for a reason. Each module builds on the one before it, so we recommend going through lessons sequentially rather than skipping around.\n\nFor each lesson, start by watching the video if one is provided. Then read through the written content, which often contains additional cues and tips not covered in the video. If downloadable resources are attached, grab those too as they are helpful references for when you are actually in the gym.\n\nAt the bottom of each lesson, you will see a Mark Complete button. Use this to track your progress. Once you have finished all lessons in a module, that module will show as complete in your sidebar. Aim to complete one module per week, but adjust to your own pace.", videoUrl: "", resources: [{ name: "Weekly Schedule Template", url: "#" }], published: true },
        { id: uid(), title: "Setting Your Baseline", content: "Before you dive into learning movements and building programs, it is important to know where you are starting from. A baseline assessment gives you an objective snapshot of your current abilities so you can track progress over time.\n\nWe recommend testing a few simple benchmarks: a max set of bodyweight squats, a timed plank hold, and a comfortable set of five on a goblet squat or kettlebell deadlift. Write these numbers down. You are not competing with anyone but yourself.\n\nEvery four to six weeks, retest these benchmarks. You will be amazed at how quickly the numbers improve when you follow a structured program and show up consistently. Progress is rarely linear, but the trend over months will always be upward if you are doing the work.", videoUrl: "", resources: [{ name: "Baseline Assessment Sheet", url: "#" }], published: true },
      ]},
      { id: uid(), title: "Movement Fundamentals", dripDays: null, lessons: [
        { id: uid(), title: "The Squat", content: "The squat is arguably the most important movement pattern in all of strength training. It trains the quads, glutes, and core simultaneously while also demanding mobility through the ankles, hips, and thoracic spine.\n\nStart with the air squat before adding any load. Your feet should be roughly shoulder-width apart with toes turned out slightly. Initiate the movement by pushing your hips back and bending your knees simultaneously. Think about sitting between your legs, not behind them. Your chest stays tall and your weight stays in your midfoot to heel.\n\nOnce you can perform three sets of fifteen air squats with good depth and control, progress to the goblet squat with a kettlebell or dumbbell. The front-loaded weight actually makes it easier to hit depth because it acts as a counterbalance. Master the goblet squat before moving to barbell variations.", videoUrl: "https://www.youtube.com/watch?v=KkMptkopjHA", resources: [{ name: "Squat Cue Sheet", url: "#" }], published: true },
        { id: uid(), title: "The Hinge", content: "The hip hinge is the foundation for deadlifts, kettlebell swings, and any movement where you need to load the posterior chain. It is also probably the movement most people do incorrectly when they first start training.\n\nThe key to a good hinge is understanding that it is a hip movement, not a back movement. Stand with your feet hip-width apart and a slight bend in your knees. Push your hips straight back like you are trying to close a car door with your butt. Your shins stay nearly vertical and your back stays flat.\n\nA great drill is the wall hinge: stand about a foot away from a wall, facing away from it, and push your hips back until they touch the wall. Then take a small step forward and repeat. This teaches you the range of motion before adding any load. Once you can hinge with a flat back and feel the stretch in your hamstrings, you are ready for the kettlebell deadlift.", videoUrl: "https://www.youtube.com/watch?v=Ei37SKkSvqc", resources: [{ name: "Hinge Drill Progression", url: "#" }], published: true },
        { id: uid(), title: "The Push", content: "Pushing movements include everything from push-ups to bench press to overhead press. They train the chest, shoulders, and triceps, and are essential for balanced upper body development.\n\nWe start with the push-up because it is the most accessible pushing movement and it teaches important concepts like full-body tension and scapular movement. Your hands should be just outside shoulder width, fingers spread. Lower yourself until your chest touches the floor, keeping your elbows at roughly a 45-degree angle from your body. Push back up to full lockout.\n\nIf you cannot do a full push-up from the floor yet, elevate your hands on a bench or box rather than dropping to your knees. This keeps the full-body plank position intact and teaches proper bracing. Gradually lower the surface height as you get stronger. Once you can do three sets of ten from the floor with good form, you are ready to start pressing with dumbbells.", videoUrl: "https://www.youtube.com/watch?v=ba8tr1NzwXU", resources: [], published: true },
        { id: uid(), title: "The Pull", content: "Pulling movements are the counterbalance to pushing and are absolutely critical for shoulder health, posture, and upper back strength. If anything, most people should be pulling more than they push.\n\nThe inverted row is the best starting point for beginners. Set a barbell in a rack at about waist height, hang underneath it with your arms straight, and pull your chest to the bar. Keep your body in a straight line from head to heels, just like a plank. This teaches you the pulling pattern and builds the lat and mid-back strength you need for pull-ups.\n\nFrom here, you can progress to band-assisted pull-ups and eventually strict pull-ups. For horizontal pulling, dumbbell rows are your bread and butter. One hand on a bench, pull the dumbbell to your hip, and squeeze your shoulder blade back at the top. Two to three sets of eight to twelve reps per side is a great starting point.", videoUrl: "https://www.youtube.com/watch?v=GZbfZ033f74", resources: [], published: true },
      ]},
      { id: uid(), title: "Programming Basics", dripDays: null, lessons: [
        { id: uid(), title: "Understanding Sets & Reps", content: "If you have ever looked at a workout program and seen something like 3x10 or 4x6, this lesson will make sure you understand exactly what that means and why it matters.\n\nA rep, or repetition, is one complete execution of an exercise from start to finish. A set is a group of consecutive reps. So 3x10 means three sets of ten reps each. Between each set, you take a rest period, typically between sixty seconds and three minutes depending on the goal.\n\nDifferent rep ranges serve different purposes. Low reps with heavy weight, think one to five reps, primarily builds maximal strength. Moderate reps with moderate weight, six to twelve, is the classic hypertrophy range for building muscle. Higher reps with lighter weight, fifteen-plus, builds muscular endurance and is great for metabolic conditioning.\n\nAs a beginner, you will spend most of your time in the six to twelve rep range. This gives you enough reps to practice the movement pattern while still providing a strong stimulus for both strength and muscle growth.", videoUrl: "", resources: [{ name: "Rep Range Cheat Sheet", url: "#" }], published: true },
        { id: uid(), title: "RPE and Tempo Explained", content: "RPE stands for Rate of Perceived Exertion and it is one of the most useful tools for managing training intensity. The RPE scale runs from one to ten, where ten means you could not do another rep and one means the weight feels like nothing.\n\nFor most of your training, you want to be working in the RPE seven to eight range. This means you finish each set with two to three reps still in the tank. Training to absolute failure every set is not necessary for beginners and actually slows recovery. Leaving a couple reps in reserve lets you maintain good form, recover faster between sessions, and accumulate more quality volume over time.\n\nTempo is another powerful tool. It is written as four numbers, like 3-1-2-0, representing the eccentric (lowering), pause at the bottom, concentric (lifting), and pause at the top in seconds. Controlling tempo forces you to own every part of the range of motion and builds stability that fast, sloppy reps simply cannot. Start by slowing down your lowering phase to a two to three second count and you will immediately feel the difference.", videoUrl: "", resources: [{ name: "RPE Scale Reference Card", url: "#" }, { name: "Tempo Training Guide", url: "#" }], published: true },
      ]},
    ],
  },
  {
    id: uid(), title: "Advanced Training Methods", description: "Take your training to the next level with periodization strategies, advanced recovery protocols, and mobility programming for experienced lifters.",
    coverImage: "", accessType: "level-locked", requiredLevel: 3, allowedPlanIds: [],
    modules: [
      { id: uid(), title: "Periodization", dripDays: null, lessons: [
        { id: uid(), title: "Linear vs. Undulating Periodization", content: "Periodization is simply the planned variation of training variables over time. Without periodization, you will eventually plateau because your body adapts to repetitive stimuli. The two most common approaches are linear and undulating periodization.\n\nLinear periodization progresses in one direction over a training block. A classic example is starting with four sets of twelve at moderate weight, then moving to four sets of eight at heavier weight, then four sets of five at near-maximal weight over a twelve-week cycle. It is straightforward, easy to follow, and very effective for beginners and intermediate lifters.\n\nUndulating periodization varies the stimulus within each week. Monday might be a heavy day with sets of three to five, Wednesday a moderate hypertrophy day with sets of eight to twelve, and Friday a light endurance day with sets of fifteen-plus. Research shows both approaches produce similar long-term results, but undulating periodization tends to keep things more interesting and may be better for athletes who need multiple qualities simultaneously.", videoUrl: "", resources: [{ name: "12-Week Linear Template", url: "#" }, { name: "Weekly Undulating Template", url: "#" }], published: true },
        { id: uid(), title: "Deload Weeks and Recovery Blocks", content: "A deload is a planned reduction in training volume or intensity, typically lasting one week. It is not a sign of weakness; it is a strategic tool that allows your body to fully recover and adapt to the stress you have been applying.\n\nMost intermediate and advanced lifters should deload every four to six weeks. During a deload, reduce your working weights by thirty to forty percent and cut your total sets in half. Keep the movement patterns the same so you maintain motor patterns, but give your joints, connective tissue, and nervous system a break.\n\nYou will know you need a deload when your performance stalls for two or more sessions in a row, your motivation drops significantly, you feel persistently fatigued despite adequate sleep, or you start experiencing nagging joint pain. The week after a deload, you will almost always come back stronger. Think of it as pulling back the slingshot before launching forward.", videoUrl: "", resources: [{ name: "Deload Protocol Checklist", url: "#" }], published: true },
        { id: uid(), title: "Block Periodization for Advanced Athletes", content: "Block periodization takes the concept of linear periodization and structures it into distinct training blocks, each with a primary focus. This approach is popular with competitive athletes because it allows you to develop specific qualities in sequence.\n\nA typical block structure might look like this: a four-week accumulation block focused on high-volume hypertrophy work, followed by a four-week transmutation block with moderate volume and heavier loads, followed by a two-week realization block with low volume and peak intensity. Each block feeds into the next.\n\nThe key advantage of block periodization is that it simplifies programming by only emphasizing one or two qualities per block. You are not trying to maximize strength, endurance, and hypertrophy all at once. The downside is that qualities trained in earlier blocks can start to detrain during later blocks, which is why the blocks are kept relatively short and each block includes a small amount of maintenance work for previously developed qualities.", videoUrl: "", resources: [{ name: "Block Periodization Planner", url: "#" }], published: true },
      ]},
      { id: uid(), title: "Recovery & Mobility", dripDays: 7, lessons: [
        { id: uid(), title: "Active Recovery Strategies", content: "Recovery is not just sitting on the couch. Active recovery deliberately promotes blood flow and tissue repair through low-intensity movement. The distinction between rest and active recovery is critical for anyone training four or more days per week.\n\nEffective active recovery methods include walking for twenty to thirty minutes at a conversational pace, light cycling or swimming, foam rolling and soft tissue work targeting areas that feel tight or restricted, and easy mobility flows that take your joints through their full range of motion. The intensity should be low enough that you feel better afterward, not more tired.\n\nTiming matters too. An active recovery session the day after a heavy training day can significantly reduce perceived soreness and improve your performance in the next session. Even ten minutes of walking and foam rolling post-workout has been shown to accelerate recovery compared to doing nothing.", videoUrl: "", resources: [{ name: "Active Recovery Day Template", url: "#" }], published: true },
        { id: uid(), title: "Mobility Programming for Lifters", content: "Mobility is not the same as flexibility. Flexibility is passive range of motion, like being able to touch your toes. Mobility is active range of motion under control, like being able to hold a deep squat with your arms overhead. For lifters, mobility is far more important than flexibility.\n\nThe most effective approach to mobility training is to target it specifically for the movements you perform. If your squat is limited by ankle dorsiflexion, spend time on ankle mobility drills before squat days. If your overhead press is limited by thoracic extension, program thoracic spine work into your warm-up on pressing days.\n\nA simple daily mobility routine that takes less than ten minutes can make a significant difference: ninety-second hip flexor stretch per side, ten controlled deep squats with a hold at the bottom, ten thoracic rotations per side, and ten shoulder dislocates with a band or dowel. Do this consistently and you will notice meaningful improvements in your training positions within two to three weeks.", videoUrl: "", resources: [{ name: "Daily Mobility Flow (10 min)", url: "#" }, { name: "Mobility Self-Assessment", url: "#" }], published: true },
      ]},
    ],
  },
  {
    id: uid(), title: "Nutrition Fundamentals", description: "Learn the science of sports nutrition, from macronutrient basics to practical meal planning strategies that support your training goals.",
    coverImage: "", accessType: "members-only", requiredLevel: 0, allowedPlanIds: [],
    modules: [
      { id: uid(), title: "Macronutrients", dripDays: null, lessons: [
        { id: uid(), title: "Protein: The Building Block", content: "Protein is the most important macronutrient for anyone engaged in resistance training. It provides the amino acids your body needs to repair and build muscle tissue after training. Without adequate protein, you simply cannot recover optimally from hard training sessions.\n\nThe current evidence strongly supports consuming between 0.7 and 1.0 grams of protein per pound of body weight per day for active individuals. For a 180-pound person, that is 126 to 180 grams of protein daily. Spacing this evenly across three to five meals appears to be more effective for muscle protein synthesis than consuming it all in one or two sittings.\n\nGreat protein sources include chicken breast, lean beef, fish, eggs, Greek yogurt, cottage cheese, and whey protein. Each meal should contain 25 to 40 grams of protein to maximally stimulate muscle protein synthesis. If you are struggling to hit your protein target, a protein shake or two can fill the gap without requiring you to eat another full meal.", videoUrl: "", resources: [{ name: "Protein-Rich Foods List", url: "#" }], published: true },
        { id: uid(), title: "Carbohydrates: Your Training Fuel", content: "Carbohydrates are your body's preferred fuel source for high-intensity exercise, which includes all forms of resistance training. When you train hard, your muscles rely on glycogen, the stored form of carbohydrates, to power your contractions. Running low on glycogen means running low on performance.\n\nFor most people who train four to five days per week, two to three grams of carbohydrate per pound of body weight is a solid starting point. Prioritize complex carbohydrate sources like rice, oats, potatoes, sweet potatoes, fruits, and whole grain bread. These provide sustained energy and are packed with vitamins and minerals.\n\nTiming your carbohydrates around your training can also make a difference. Having a carb-rich meal two to three hours before training ensures you have fuel available, and consuming carbohydrates after training helps replenish glycogen stores and supports recovery. This does not need to be complicated; a normal balanced meal before and after training covers most people.", videoUrl: "", resources: [{ name: "Carb Sources Ranked by Quality", url: "#" }], published: true },
        { id: uid(), title: "Fats: Essential for Health", content: "Dietary fat often gets an undeserved bad reputation, but it is absolutely essential for hormonal health, vitamin absorption, brain function, and overall wellbeing. The key is understanding how much you need and which sources to prioritize.\n\nFor most active individuals, fat should comprise roughly 25 to 35 percent of total daily calories. At nine calories per gram, fat is the most calorie-dense macronutrient, which is why portions need to be more carefully monitored than protein or carbohydrate portions.\n\nPrioritize unsaturated fat sources like olive oil, avocado, nuts, seeds, and fatty fish like salmon. These provide anti-inflammatory omega-3 fatty acids that support recovery from training. Moderate amounts of saturated fat from sources like eggs, dairy, and red meat are perfectly fine and contribute to healthy testosterone production. The fats to truly minimize are trans fats and heavily processed vegetable oils, which are pro-inflammatory and offer no nutritional benefit.", videoUrl: "", resources: [{ name: "Healthy Fats Guide", url: "#" }], published: true },
      ]},
      { id: uid(), title: "Meal Planning", dripDays: 7, lessons: [
        { id: uid(), title: "Building a Balanced Plate", content: "Meal planning does not need to be complicated. The simplest and most effective framework is the balanced plate method: fill half your plate with vegetables or fruit, one quarter with a protein source, and one quarter with a starchy carbohydrate. Add a thumb-sized portion of healthy fat and you have a nutritious, well-balanced meal.\n\nThis method works because it naturally creates appropriate portions without requiring you to weigh, measure, or track everything. For most people, three balanced plates per day plus one to two snacks is sufficient to support their training and body composition goals.\n\nThe real key to sustainable nutrition is consistency, not perfection. If eighty percent of your meals follow the balanced plate framework, the remaining twenty percent can be more flexible without derailing your progress. This approach prevents the all-or-nothing mentality that causes so many people to cycle between strict dieting and completely falling off the wagon.", videoUrl: "", resources: [{ name: "Balanced Plate Visual Guide", url: "#" }, { name: "Grocery Shopping List Template", url: "#" }], published: true },
        { id: uid(), title: "Meal Prep for Busy Schedules", content: "The number one reason people fail with their nutrition is not a lack of knowledge; it is a lack of preparation. When you are hungry and tired, you will reach for whatever is most convenient. Meal prep ensures that the most convenient option is also the healthiest one.\n\nPick one day per week, typically Sunday, and batch cook your protein sources and carbohydrates for the week ahead. Cook four to five pounds of chicken breast or lean ground beef, a large pot of rice or roasted potatoes, and chop your vegetables. Store everything in individual containers. Total time investment is about ninety minutes, and it saves you hours of daily cooking and decision-making throughout the week.\n\nStart small if the idea of prepping an entire week feels overwhelming. Even prepping just your lunches for the work week eliminates the five most challenging meals. Once that becomes routine, expand to include breakfasts or dinners. The goal is to remove as many daily decisions as possible so that eating well becomes your default, not something that requires willpower every single day.", videoUrl: "", resources: [{ name: "Weekly Meal Prep Checklist", url: "#" }, { name: "5-Day Lunch Prep Recipes", url: "#" }], published: true },
      ]},
    ],
  },
];

/* ── component ───────────────────────────────────────── */
export default function ClassroomView() {
  const B = useTheme();
  const { members } = useMembers();

  /* ── state ── */
  const [courses, setCourses] = useLocalStorage("hf_courses", []);
  const [progress, setProgress] = useLocalStorage("hf_course_progress", []);
  const [selectedCourseIdx, setSelectedCourseIdx] = useState(0);
  const [selectedLessonPath, setSelectedLessonPath] = useState(null); // { moduleIdx, lessonIdx }
  const [expandedModules, setExpandedModules] = useState({});
  const [editing, setEditing] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewLessonPath, setPreviewLessonPath] = useState(null);
  const [previewExpandedModules, setPreviewExpandedModules] = useState({});

  const course = courses[selectedCourseIdx] || courses[0];

  /* ── progress helpers ── */
  const completedSet = useMemo(() => {
    if (!course) return new Set();
    const ids = new Set();
    progress.filter(p => p.courseId === course.id).forEach(p => (p.lessonIds || []).forEach(l => ids.add(l)));
    return ids;
  }, [progress, course]);

  const totalLessons = useMemo(() => course ? course.modules.reduce((s, m) => s + m.lessons.filter(l => l.published).length, 0) : 0, [course]);
  const completedCount = useMemo(() => {
    if (!course) return 0;
    let c = 0;
    course.modules.forEach(m => m.lessons.forEach(l => { if (l.published && completedSet.has(l.id)) c++; }));
    return c;
  }, [course, completedSet]);
  const pct = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;

  /* ── active lesson ── */
  const activeLesson = useMemo(() => {
    if (!selectedLessonPath || !course) return null;
    const mod = course.modules[selectedLessonPath.moduleIdx];
    return mod ? mod.lessons[selectedLessonPath.lessonIdx] || null : null;
  }, [selectedLessonPath, course]);

  /* ── flat lesson list for prev / next ── */
  const flatLessons = useMemo(() => {
    if (!course) return [];
    const arr = [];
    course.modules.forEach((m, mi) => m.lessons.forEach((l, li) => { if (l.published) arr.push({ moduleIdx: mi, lessonIdx: li, lesson: l }); }));
    return arr;
  }, [course]);

  const flatIdx = useMemo(() => {
    if (!selectedLessonPath) return -1;
    return flatLessons.findIndex(f => f.moduleIdx === selectedLessonPath.moduleIdx && f.lessonIdx === selectedLessonPath.lessonIdx);
  }, [flatLessons, selectedLessonPath]);

  /* ── toggle progress ── */
  function toggleComplete(lessonId) {
    setProgress(prev => {
      const existing = prev.find(p => p.courseId === course.id);
      if (existing) {
        const ids = existing.lessonIds.includes(lessonId) ? existing.lessonIds.filter(id => id !== lessonId) : [...existing.lessonIds, lessonId];
        return prev.map(p => p.courseId === course.id ? { ...p, lessonIds: ids } : p);
      }
      return [...prev, { courseId: course.id, lessonIds: [lessonId], memberId: "admin" }];
    });
  }

  /* ── toggle module expand ── */
  function toggleModule(modIdx) {
    setExpandedModules(prev => ({ ...prev, [modIdx]: !prev[modIdx] }));
  }

  /* ── drip lock check ── */
  function isDripLocked(mod) {
    if (!mod.dripDays) return false;
    // For demo purposes, compare against a fixed join date (member start date)
    // In production this would use the logged-in member's startDate
    return false; // Disabled for admin view
  }

  /* ── editor helpers ── */
  function openEditor(c) {
    setEditCourse(JSON.parse(JSON.stringify(c || {
      id: uid(), title: "", description: "", coverImage: "", accessType: "open", requiredLevel: 0, allowedPlanIds: [],
      modules: [{ id: uid(), title: "Module 1", dripDays: null, lessons: [{ id: uid(), title: "Lesson 1", content: "", videoUrl: "", resources: [], published: true }] }],
    })));
    setEditing(true);
  }

  function saveCourse() {
    if (!editCourse) return;
    setCourses(prev => {
      const idx = prev.findIndex(c => c.id === editCourse.id);
      if (idx >= 0) return prev.map((c, i) => i === idx ? editCourse : c);
      return [...prev, editCourse];
    });
    setEditing(false);
    setEditCourse(null);
  }

  function deleteCourse(id) {
    setCourses(prev => prev.filter(c => c.id !== id));
    setSelectedCourseIdx(0);
    setSelectedLessonPath(null);
  }

  function addModule() {
    setEditCourse(prev => ({ ...prev, modules: [...prev.modules, { id: uid(), title: "", dripDays: null, lessons: [{ id: uid(), title: "", content: "", videoUrl: "", resources: [], published: true }] }] }));
  }

  function removeModule(mi) {
    setEditCourse(prev => ({ ...prev, modules: prev.modules.filter((_, i) => i !== mi) }));
  }

  function updateModule(mi, field, val) {
    setEditCourse(prev => ({ ...prev, modules: prev.modules.map((m, i) => i === mi ? { ...m, [field]: val } : m) }));
  }

  function moveModule(mi, dir) {
    setEditCourse(prev => {
      const mods = [...prev.modules];
      const ni = mi + dir;
      if (ni < 0 || ni >= mods.length) return prev;
      [mods[mi], mods[ni]] = [mods[ni], mods[mi]];
      return { ...prev, modules: mods };
    });
  }

  function addLesson(mi) {
    setEditCourse(prev => ({ ...prev, modules: prev.modules.map((m, i) => i === mi ? { ...m, lessons: [...m.lessons, { id: uid(), title: "", content: "", videoUrl: "", resources: [], published: true }] } : m) }));
  }

  function removeLesson(mi, li) {
    setEditCourse(prev => ({ ...prev, modules: prev.modules.map((m, i) => i === mi ? { ...m, lessons: m.lessons.filter((_, j) => j !== li) } : m) }));
  }

  function updateLesson(mi, li, field, val) {
    setEditCourse(prev => ({ ...prev, modules: prev.modules.map((m, i) => i === mi ? { ...m, lessons: m.lessons.map((l, j) => j === li ? { ...l, [field]: val } : l) } : m) }));
  }

  function addResource(mi, li) {
    setEditCourse(prev => ({ ...prev, modules: prev.modules.map((m, i) => i === mi ? { ...m, lessons: m.lessons.map((l, j) => j === li ? { ...l, resources: [...l.resources, { name: "", url: "" }] } : l) } : m) }));
  }

  function removeResource(mi, li, ri) {
    setEditCourse(prev => ({ ...prev, modules: prev.modules.map((m, i) => i === mi ? { ...m, lessons: m.lessons.map((l, j) => j === li ? { ...l, resources: l.resources.filter((_, k) => k !== ri) } : l) } : m) }));
  }

  function updateResource(mi, li, ri, field, val) {
    setEditCourse(prev => ({ ...prev, modules: prev.modules.map((m, i) => i === mi ? { ...m, lessons: m.lessons.map((l, j) => j === li ? { ...l, resources: l.resources.map((r, k) => k === ri ? { ...r, [field]: val } : r) } : l) } : m) }));
  }

  /* ── preview helpers ── */
  const openPreview = useCallback(() => {
    setPreviewing(true);
    setPreviewLessonPath(null);
    setPreviewExpandedModules({});
  }, []);

  const closePreview = useCallback(() => {
    setPreviewing(false);
    setPreviewLessonPath(null);
    setPreviewExpandedModules({});
  }, []);

  useEffect(() => {
    if (!previewing) return;
    const handleEsc = (e) => { if (e.key === "Escape") closePreview(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [previewing, closePreview]);

  const previewActiveLesson = useMemo(() => {
    if (!previewLessonPath || !course) return null;
    const mod = course.modules[previewLessonPath.moduleIdx];
    return mod ? mod.lessons[previewLessonPath.lessonIdx] || null : null;
  }, [previewLessonPath, course]);

  const previewFlatLessons = useMemo(() => {
    if (!course) return [];
    const arr = [];
    course.modules.forEach((m, mi) => m.lessons.forEach((l, li) => { if (l.published) arr.push({ moduleIdx: mi, lessonIdx: li, lesson: l }); }));
    return arr;
  }, [course]);

  const previewFlatIdx = useMemo(() => {
    if (!previewLessonPath) return -1;
    return previewFlatLessons.findIndex(f => f.moduleIdx === previewLessonPath.moduleIdx && f.lessonIdx === previewLessonPath.lessonIdx);
  }, [previewFlatLessons, previewLessonPath]);

  /* ── styles ── */
  const sidebarW = 320;
  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${B.border}`, background: B.dark, color: B.text, fontSize: 13, outline: "none", boxSizing: "border-box" };
  const btnPrimary = { padding: "8px 18px", borderRadius: 8, border: "none", background: B.green, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" };
  const btnSecondary = { padding: "8px 18px", borderRadius: 8, border: `1px solid ${B.border}`, background: "transparent", color: B.text, fontWeight: 600, fontSize: 13, cursor: "pointer" };
  const btnDanger = { padding: "6px 14px", borderRadius: 8, border: "none", background: B.red, color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" };
  const btnSmall = { padding: "4px 10px", borderRadius: 6, border: `1px solid ${B.border}`, background: "transparent", color: B.muted, fontWeight: 600, fontSize: 11, cursor: "pointer" };

  /* ── access badge ── */
  function accessBadge(c) {
    if (c.accessType === "plan-locked") return { label: "Plan-Locked", bg: (B.orange || "#f59e0b") + "22", color: B.orange || "#f59e0b" };
    if (c.accessType === "level-locked") return { label: `Level ${c.requiredLevel}+`, bg: B.orange + "22", color: B.orange };
    if (c.accessType === "members-only") return { label: "Clients Only", bg: B.purple + "22", color: B.purple };
    return { label: "Open", bg: B.green + "22", color: B.green };
  }

  /* ──────────────────── EDITOR MODAL ──────────────────── */
  if (editing && editCourse) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: 0 }}>{editCourse.title ? "Edit Course" : "New Course"}</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setEditing(false); setEditCourse(null); }} style={btnSecondary}>Cancel</button>
            <button onClick={saveCourse} style={btnPrimary}>Save Course</button>
          </div>
        </div>

        <Card style={{ marginBottom: 20, padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 }}>Course Title</label>
              <input value={editCourse.title} onChange={e => setEditCourse(p => ({ ...p, title: e.target.value }))} placeholder="Course title..." style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 }}>Access Type</label>
              <select value={editCourse.accessType} onChange={e => setEditCourse(p => ({ ...p, accessType: e.target.value, allowedPlanIds: e.target.value === "plan-locked" ? (p.allowedPlanIds || []) : [] }))} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="open">Open Access</option>
                <option value="level-locked">Level-Locked</option>
                <option value="members-only">Clients Only</option>
                <option value="plan-locked">Plan-Locked</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 }}>Description</label>
              <textarea value={editCourse.description} onChange={e => setEditCourse(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Course description..." style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            {editCourse.accessType === "level-locked" && (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 }}>Required Level</label>
                <input type="number" min={1} value={editCourse.requiredLevel} onChange={e => setEditCourse(p => ({ ...p, requiredLevel: Number(e.target.value) }))} style={inputStyle} />
              </div>
            )}
            {editCourse.accessType === "plan-locked" && (
              <div>
                <PlanAccessPicker
                  allowedPlanIds={editCourse.allowedPlanIds || []}
                  onChange={(ids) => setEditCourse(p => ({ ...p, allowedPlanIds: ids }))}
                  B={B}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Modules */}
        {editCourse.modules.map((mod, mi) => (
          <Card key={mod.id} style={{ marginBottom: 16, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button onClick={() => moveModule(mi, -1)} disabled={mi === 0} style={{ ...btnSmall, opacity: mi === 0 ? 0.3 : 1, padding: "2px 6px", fontSize: 10 }}>&#9650;</button>
                <button onClick={() => moveModule(mi, 1)} disabled={mi === editCourse.modules.length - 1} style={{ ...btnSmall, opacity: mi === editCourse.modules.length - 1 ? 0.3 : 1, padding: "2px 6px", fontSize: 10 }}>&#9660;</button>
              </div>
              <input value={mod.title} onChange={e => updateModule(mi, "title", e.target.value)} placeholder="Module title..." style={{ ...inputStyle, fontWeight: 700, fontSize: 15, flex: 1 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ fontSize: 11, color: B.muted, whiteSpace: "nowrap" }}>Drip days:</label>
                <input type="number" min={0} value={mod.dripDays || ""} onChange={e => updateModule(mi, "dripDays", e.target.value ? Number(e.target.value) : null)} placeholder="--" style={{ ...inputStyle, width: 60, textAlign: "center" }} />
              </div>
              <button onClick={() => removeModule(mi)} style={{ ...btnDanger, fontSize: 11, padding: "4px 10px" }}>Remove</button>
            </div>

            {/* Lessons inside module */}
            {mod.lessons.map((les, li) => (
              <div key={les.id} style={{ background: B.dark, borderRadius: 10, border: `1px solid ${B.border}`, padding: 16, marginBottom: 12, marginLeft: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: B.dim, fontWeight: 700, minWidth: 24 }}>L{li + 1}</span>
                  <input value={les.title} onChange={e => updateLesson(mi, li, "title", e.target.value)} placeholder="Lesson title..." style={{ ...inputStyle, flex: 1, fontWeight: 600 }} />
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: B.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={les.published} onChange={e => updateLesson(mi, li, "published", e.target.checked)} /> Published
                  </label>
                  <button onClick={() => removeLesson(mi, li)} style={{ ...btnSmall, color: B.red, borderColor: B.red + "44" }}>Remove</button>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: B.muted, marginBottom: 3 }}>Video URL</label>
                  <input value={les.videoUrl} onChange={e => updateLesson(mi, li, "videoUrl", e.target.value)} placeholder="YouTube URL..." style={inputStyle} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: B.muted, marginBottom: 3 }}>Content</label>
                  <RichTextEditor value={les.content} onChange={(val) => updateLesson(mi, li, "content", val)} placeholder="Lesson content..." />
                </div>
                {/* Resources */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: B.muted, marginBottom: 6 }}>Resources</label>
                  {les.resources.map((res, ri) => (
                    <div key={ri} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input value={res.name} onChange={e => updateResource(mi, li, ri, "name", e.target.value)} placeholder="Name" style={{ ...inputStyle, flex: 1 }} />
                      <input value={res.url} onChange={e => updateResource(mi, li, ri, "url", e.target.value)} placeholder="URL" style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={() => removeResource(mi, li, ri)} style={{ ...btnSmall, color: B.red, borderColor: B.red + "44", padding: "4px 8px" }}>x</button>
                    </div>
                  ))}
                  <button onClick={() => addResource(mi, li)} style={{ ...btnSmall, marginTop: 2 }}>+ Add Resource</button>
                </div>
              </div>
            ))}
            <button onClick={() => addLesson(mi)} style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px", marginLeft: 28 }}>+ Add Lesson</button>
          </Card>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={addModule} style={btnSecondary}>+ Add Module</button>
        </div>
      </div>
    );
  }

  /* ──────────────────── MAIN VIEW ──────────────────── */
  if (!course) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: B.text }}>Classroom</h1>
          <button onClick={() => openEditor(null)} style={btnPrimary}>+ New Course</button>
        </div>
        <Card>
          <div style={{ padding: 40, textAlign: "center", color: B.dim }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#128218;</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Courses Yet</div>
            <div style={{ fontSize: 13 }}>Create your first course to get started.</div>
          </div>
        </Card>
      </div>
    );
  }

  const badge = accessBadge(course);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
      {/* ── TOP BAR ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: B.text, margin: 0 }}>{course.title}</h1>
          <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
          {course.accessType === "plan-locked" && <PlanLockBadge allowedPlanIds={course.allowedPlanIds} B={B} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: B.muted, fontWeight: 600 }}>{completedCount} of {totalLessons} lessons complete</span>
          <button onClick={openPreview} style={{ ...btnSecondary, display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 14 }}>&#128065;</span> Preview Course</button>
          <button onClick={() => openEditor(course)} style={btnSecondary}>Edit Course</button>
          <button onClick={() => openEditor(null)} style={btnPrimary}>+ New Course</button>
        </div>
      </div>

      {/* ── TWO-PANEL LAYOUT ── */}
      <div style={{ display: "flex", gap: 0, flex: 1, minHeight: 0 }}>

        {/* ── LEFT SIDEBAR ── */}
        <div style={{ width: sidebarW, minWidth: sidebarW, background: B.card, borderRadius: "12px 0 0 12px", border: `1px solid ${B.border}`, borderRight: "none", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Course selector */}
          <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${B.border}` }}>
            <select value={selectedCourseIdx} onChange={e => { setSelectedCourseIdx(Number(e.target.value)); setSelectedLessonPath(null); setExpandedModules({}); }} style={{ ...inputStyle, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {courses.map((c, i) => <option key={c.id} value={i}>{c.title}</option>)}
            </select>
            {course.description && <p style={{ fontSize: 12, color: B.muted, margin: "8px 0 0", lineHeight: 1.5 }}>{course.description}</p>}
          </div>

          {/* Module / lesson list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {course.modules.map((mod, mi) => {
              const isExpanded = expandedModules[mi] !== false; // default expanded
              const modLessons = mod.lessons.filter(l => l.published);
              const modComplete = modLessons.filter(l => completedSet.has(l.id)).length;
              const locked = isDripLocked(mod);

              return (
                <div key={mod.id}>
                  {/* Module header */}
                  <div
                    onClick={() => toggleModule(mi)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", cursor: "pointer", userSelect: "none", transition: "background .15s", borderRadius: 0 }}
                    onMouseEnter={e => e.currentTarget.style.background = B.border + "44"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ fontSize: 10, color: B.dim, transition: "transform .2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>&#9654;</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: B.text }}>{mod.title}</span>
                    {locked && <span style={{ fontSize: 13, opacity: 0.5 }} title={`Unlocks ${mod.dripDays} days after joining`}>&#128274;</span>}
                    <span style={{ fontSize: 11, color: modComplete === modLessons.length && modLessons.length > 0 ? B.green : B.dim, fontWeight: 600 }}>{modComplete}/{modLessons.length}</span>
                  </div>

                  {/* Lessons */}
                  {isExpanded && (
                    <div>
                      {modLessons.map((les, li) => {
                        const realLi = mod.lessons.indexOf(les);
                        const isActive = selectedLessonPath && selectedLessonPath.moduleIdx === mi && selectedLessonPath.lessonIdx === realLi;
                        const done = completedSet.has(les.id);

                        return (
                          <div
                            key={les.id}
                            onClick={() => setSelectedLessonPath({ moduleIdx: mi, lessonIdx: realLi })}
                            style={{
                              display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 38px", cursor: "pointer",
                              background: isActive ? B.green + "18" : "transparent",
                              borderLeft: isActive ? `3px solid ${B.green}` : "3px solid transparent",
                              transition: "all .15s",
                            }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = B.border + "33"; }}
                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                          >
                            {/* Checkmark or empty circle */}
                            <div style={{
                              width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                              border: done ? "none" : `2px solid ${B.dim}`,
                              background: done ? B.green : "transparent",
                              color: "#fff", fontSize: 11, fontWeight: 800,
                            }}>
                              {done && <span>&#10003;</span>}
                            </div>
                            <span style={{ fontSize: 13, color: isActive ? B.text : B.muted, fontWeight: isActive ? 600 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{les.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${B.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: B.muted, fontWeight: 600 }}>Progress</span>
              <span style={{ fontSize: 11, color: B.green, fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: B.border, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: B.green, borderRadius: 3, transition: "width .3s ease" }} />
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 1, background: B.card, borderRadius: "0 12px 12px 0", border: `1px solid ${B.border}`, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {activeLesson ? (
            <div style={{ padding: 32, flex: 1 }}>
              {/* Lesson title */}
              <h2 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: "0 0 20px" }}>{activeLesson.title}</h2>

              {/* Video embed */}
              {getYTEmbedUrl(activeLesson.videoUrl) && (
                <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden", marginBottom: 24, background: "#000" }}>
                  <iframe
                    src={getYTEmbedUrl(activeLesson.videoUrl)}
                    title={activeLesson.title}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {/* Content */}
              {activeLesson.content && (
                activeLesson.content.startsWith("<") ? (
                  <div style={{ fontSize: 15, lineHeight: 1.75, color: B.text, marginBottom: 28 }} dangerouslySetInnerHTML={{ __html: activeLesson.content }} />
                ) : (
                  <div style={{ fontSize: 15, lineHeight: 1.75, color: B.text, marginBottom: 28, whiteSpace: "pre-line" }}>
                    {activeLesson.content}
                  </div>
                )
              )}

              {/* Resources */}
              {activeLesson.resources && activeLesson.resources.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: B.text, marginBottom: 12 }}>Resources</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {activeLesson.resources.map((res, ri) => (
                      <a
                        key={ri}
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8,
                          background: B.dark, border: `1px solid ${B.border}`, color: B.green, textDecoration: "none",
                          fontSize: 13, fontWeight: 600, transition: "border-color .15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = B.green}
                        onMouseLeave={e => e.currentTarget.style.borderColor = B.border}
                      >
                        <span style={{ fontSize: 16 }}>&#128196;</span>
                        {res.name || res.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Mark Complete */}
              <div style={{ marginBottom: 32 }}>
                <button
                  onClick={() => toggleComplete(activeLesson.id)}
                  style={{
                    padding: "12px 28px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
                    background: completedSet.has(activeLesson.id) ? B.green : B.border,
                    color: completedSet.has(activeLesson.id) ? "#fff" : B.text,
                    transition: "all .2s",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  {completedSet.has(activeLesson.id) ? (
                    <><span>&#10003;</span> Completed</>
                  ) : (
                    <><span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${B.dim}`, display: "inline-block" }} /> Mark Complete</>
                  )}
                </button>
              </div>

              {/* Prev / Next navigation */}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 20, borderTop: `1px solid ${B.border}` }}>
                {flatIdx > 0 ? (
                  <button
                    onClick={() => setSelectedLessonPath({ moduleIdx: flatLessons[flatIdx - 1].moduleIdx, lessonIdx: flatLessons[flatIdx - 1].lessonIdx })}
                    style={{ ...btnSecondary, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontSize: 16 }}>&#8592;</span> {flatLessons[flatIdx - 1].lesson.title}
                  </button>
                ) : <div />}
                {flatIdx < flatLessons.length - 1 ? (
                  <button
                    onClick={() => setSelectedLessonPath({ moduleIdx: flatLessons[flatIdx + 1].moduleIdx, lessonIdx: flatLessons[flatIdx + 1].lessonIdx })}
                    style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {flatLessons[flatIdx + 1].lesson.title} <span style={{ fontSize: 16 }}>&#8594;</span>
                  </button>
                ) : <div />}
              </div>
            </div>
          ) : (
            /* ── Welcome / course overview ── */
            <div style={{ padding: 32, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ maxWidth: 520, textAlign: "center" }}>
                <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.7 }}>&#127891;</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: B.text, marginBottom: 12 }}>{course.title}</h2>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: B.muted, marginBottom: 24 }}>{course.description}</p>
                <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 28 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: B.text }}>{course.modules.length}</div>
                    <div style={{ fontSize: 12, color: B.muted }}>Modules</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: B.text }}>{totalLessons}</div>
                    <div style={{ fontSize: 12, color: B.muted }}>Lessons</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: B.green }}>{pct}%</div>
                    <div style={{ fontSize: 12, color: B.muted }}>Complete</div>
                  </div>
                </div>
                {flatLessons.length > 0 && (
                  <button
                    onClick={() => {
                      const first = flatLessons.find(f => !completedSet.has(f.lesson.id)) || flatLessons[0];
                      setSelectedLessonPath({ moduleIdx: first.moduleIdx, lessonIdx: first.lessonIdx });
                    }}
                    style={{ ...btnPrimary, padding: "12px 32px", fontSize: 15 }}
                  >
                    {completedCount > 0 ? "Continue Learning" : "Start Course"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ──────────────── PREVIEW MODAL ──────────────── */}
      {previewing && course && (
        <div
          onClick={closePreview}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 10000,
            display: "flex", flexDirection: "column",
          }}
        >
          {/* Preview banner */}
          <div style={{
            background: `linear-gradient(90deg, ${B.green}22 0%, ${B.green}08 100%)`,
            borderBottom: `1px solid ${B.green}40`,
            padding: "10px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 15 }}>&#128065;</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: B.green }}>Preview Mode</span>
              <span style={{ fontSize: 12, color: B.muted }}>-- this is how clients will see this course</span>
            </div>
            <button
              onClick={closePreview}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "none",
                background: B.red || "#ef4444", color: "#fff", fontWeight: 700, fontSize: 14,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{ fontSize: 16 }}>&#10005;</span> Close Preview
            </button>
          </div>

          {/* Preview content */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
              background: B.bg || B.darker || "#111",
              margin: 0,
            }}
          >
            {/* Course header */}
            <div style={{
              padding: "24px 32px 20px", flexShrink: 0,
              borderBottom: `1px solid ${B.border}`,
              background: B.card,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: B.text, margin: 0 }}>{course.title}</h1>
                {(() => { const b = accessBadge(course); return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: b.bg, color: b.color }}>{b.label}</span>; })()}
              </div>
              {course.description && <p style={{ fontSize: 14, color: B.muted, margin: 0, lineHeight: 1.6 }}>{course.description}</p>}
            </div>

            {/* Two-panel layout */}
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

              {/* Left sidebar - module list */}
              <div style={{
                width: sidebarW, minWidth: sidebarW, background: B.card,
                borderRight: `1px solid ${B.border}`,
                display: "flex", flexDirection: "column", overflow: "hidden",
              }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                  {course.modules.map((mod, mi) => {
                    const isExpanded = previewExpandedModules[mi] !== false;
                    const modLessons = mod.lessons.filter(l => l.published);

                    return (
                      <div key={mod.id}>
                        <div
                          onClick={() => setPreviewExpandedModules(prev => ({ ...prev, [mi]: prev[mi] === false ? true : false }))}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", cursor: "pointer", userSelect: "none", transition: "background .15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = B.border + "44"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <span style={{ fontSize: 10, color: B.dim, transition: "transform .2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>&#9654;</span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: B.text }}>{mod.title}</span>
                          <span style={{ fontSize: 11, color: B.dim, fontWeight: 600 }}>{modLessons.length} lessons</span>
                        </div>

                        {isExpanded && (
                          <div>
                            {modLessons.map((les) => {
                              const realLi = mod.lessons.indexOf(les);
                              const isActive = previewLessonPath && previewLessonPath.moduleIdx === mi && previewLessonPath.lessonIdx === realLi;

                              return (
                                <div
                                  key={les.id}
                                  onClick={() => setPreviewLessonPath({ moduleIdx: mi, lessonIdx: realLi })}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 38px", cursor: "pointer",
                                    background: isActive ? B.green + "18" : "transparent",
                                    borderLeft: isActive ? `3px solid ${B.green}` : "3px solid transparent",
                                    transition: "all .15s",
                                  }}
                                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = B.border + "33"; }}
                                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                                >
                                  <div style={{
                                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                    border: `2px solid ${B.dim}`, background: "transparent",
                                  }} />
                                  <span style={{ fontSize: 13, color: isActive ? B.text : B.muted, fontWeight: isActive ? 600 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{les.title}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right panel - lesson content */}
              <div style={{ flex: 1, overflowY: "auto", background: B.card }}>
                {previewActiveLesson ? (
                  <div style={{ padding: 32 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 800, color: B.text, margin: "0 0 20px" }}>{previewActiveLesson.title}</h2>

                    {/* Video embed */}
                    {getYTEmbedUrl(previewActiveLesson.videoUrl) && (
                      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden", marginBottom: 24, background: "#000" }}>
                        <iframe
                          src={getYTEmbedUrl(previewActiveLesson.videoUrl)}
                          title={previewActiveLesson.title}
                          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}

                    {/* Content */}
                    {previewActiveLesson.content && (
                      previewActiveLesson.content.startsWith("<") ? (
                        <div style={{ fontSize: 15, lineHeight: 1.75, color: B.text, marginBottom: 28 }} dangerouslySetInnerHTML={{ __html: previewActiveLesson.content }} />
                      ) : (
                        <div style={{ fontSize: 15, lineHeight: 1.75, color: B.text, marginBottom: 28, whiteSpace: "pre-line" }}>
                          {previewActiveLesson.content}
                        </div>
                      )
                    )}

                    {/* Resources */}
                    {previewActiveLesson.resources && previewActiveLesson.resources.length > 0 && (
                      <div style={{ marginBottom: 28 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: B.text, marginBottom: 12 }}>Resources</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {previewActiveLesson.resources.map((res, ri) => (
                            <div
                              key={ri}
                              style={{
                                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8,
                                background: B.dark, border: `1px solid ${B.border}`, color: B.green,
                                fontSize: 13, fontWeight: 600,
                              }}
                            >
                              <span style={{ fontSize: 16 }}>&#128196;</span>
                              {res.name || res.url}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mark Complete (disabled in preview) */}
                    <div style={{ marginBottom: 32 }}>
                      <button
                        disabled
                        style={{
                          padding: "12px 28px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14,
                          background: B.border, color: B.dim, cursor: "not-allowed", opacity: 0.6,
                          display: "flex", alignItems: "center", gap: 8,
                        }}
                      >
                        <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${B.dim}`, display: "inline-block" }} /> Mark Complete
                      </button>
                    </div>

                    {/* Prev / Next navigation */}
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 20, borderTop: `1px solid ${B.border}` }}>
                      {previewFlatIdx > 0 ? (
                        <button
                          onClick={() => setPreviewLessonPath({ moduleIdx: previewFlatLessons[previewFlatIdx - 1].moduleIdx, lessonIdx: previewFlatLessons[previewFlatIdx - 1].lessonIdx })}
                          style={{ ...btnSecondary, display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <span style={{ fontSize: 16 }}>&#8592;</span> {previewFlatLessons[previewFlatIdx - 1].lesson.title}
                        </button>
                      ) : <div />}
                      {previewFlatIdx < previewFlatLessons.length - 1 ? (
                        <button
                          onClick={() => setPreviewLessonPath({ moduleIdx: previewFlatLessons[previewFlatIdx + 1].moduleIdx, lessonIdx: previewFlatLessons[previewFlatIdx + 1].lessonIdx })}
                          style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6 }}
                        >
                          {previewFlatLessons[previewFlatIdx + 1].lesson.title} <span style={{ fontSize: 16 }}>&#8594;</span>
                        </button>
                      ) : <div />}
                    </div>
                  </div>
                ) : (
                  /* Welcome screen in preview */
                  <div style={{ padding: 32, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
                    <div style={{ maxWidth: 520, textAlign: "center" }}>
                      <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.7 }}>&#127891;</div>
                      <h2 style={{ fontSize: 22, fontWeight: 800, color: B.text, marginBottom: 12 }}>{course.title}</h2>
                      <p style={{ fontSize: 14, lineHeight: 1.7, color: B.muted, marginBottom: 24 }}>{course.description}</p>
                      <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 28 }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 28, fontWeight: 800, color: B.text }}>{course.modules.length}</div>
                          <div style={{ fontSize: 12, color: B.muted }}>Modules</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 28, fontWeight: 800, color: B.text }}>{totalLessons}</div>
                          <div style={{ fontSize: 12, color: B.muted }}>Lessons</div>
                        </div>
                      </div>
                      {previewFlatLessons.length > 0 && (
                        <button
                          onClick={() => setPreviewLessonPath({ moduleIdx: previewFlatLessons[0].moduleIdx, lessonIdx: previewFlatLessons[0].lessonIdx })}
                          style={{ ...btnPrimary, padding: "12px 32px", fontSize: 15 }}
                        >
                          Start Course
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
