import { useState, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";

const uuid = () => crypto.randomUUID();

const DEFAULT_CATEGORIES = [
  "Nutrition",
  "Training Guides",
  "Recovery",
  "Forms & Documents",
  "Videos",
  "General",
];

const TYPE_ICONS = {
  pdf: "\ud83d\udcc4",
  video: "\u25b6\ufe0f",
  link: "\ud83d\udd17",
  image: "\ud83d\uddbc\ufe0f",
  doc: "\ud83d\udcd8",
  file: "\ud83d\udcc1",
};

const TYPE_COLORS = {
  pdf: "#ef4444",
  video: "#a855f7",
  link: "#3b82f6",
  image: "#f59e0b",
  doc: "#3b82f6",
  file: "#8b949e",
};

const CATEGORY_COLORS = {
  Nutrition: "#4ADE80",
  "Training Guides": "#3b82f6",
  Recovery: "#a855f7",
  "Forms & Documents": "#f59e0b",
  Videos: "#ef4444",
  General: "#8b949e",
};

function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function generateDemoResources() {
  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 86400000).toISOString();
  return [
    {
      id: uuid(),
      title: "Hybrid Fitness Client Handbook",
      description:
        "Everything new clients need to know: gym hours, policies, session descriptions, coach bios, and FAQs. Start here!",
      category: "Forms & Documents",
      type: "pdf",
      url: "https://example.com/member-handbook.pdf",
      uploadedBy: "Gym Owner",
      createdAt: daysAgo(30),
      pinned: true,
      tags: ["onboarding", "handbook", "new members"],
    },
    {
      id: uuid(),
      title: "Macro Tracking Guide",
      description:
        "A step-by-step guide to tracking macros using MyFitnessPal. Covers protein, carbs, fat targets and how to adjust based on goals.",
      category: "Nutrition",
      type: "pdf",
      url: "https://example.com/macro-guide.pdf",
      uploadedBy: "Coach Mike",
      createdAt: daysAgo(21),
      pinned: false,
      tags: ["macros", "nutrition", "meal planning"],
    },
    {
      id: uuid(),
      title: "Foam Rolling Routine",
      description:
        "Full-body foam rolling routine for recovery days. Targets quads, IT band, lats, thoracic spine, and calves. 15-20 minutes.",
      category: "Recovery",
      type: "video",
      url: "https://www.youtube.com/watch?v=SrWEFsS7leA",
      uploadedBy: "Coach Sarah",
      createdAt: daysAgo(14),
      pinned: false,
      tags: ["foam rolling", "mobility", "recovery"],
    },
    {
      id: uuid(),
      title: "Squat Technique Breakdown",
      description:
        "Detailed breakdown of squat mechanics: stance width, bracing, depth, and common faults with corrections.",
      category: "Training Guides",
      type: "video",
      url: "https://www.youtube.com/watch?v=bEv6CCg2BC8",
      uploadedBy: "Coach Mike",
      createdAt: daysAgo(10),
      pinned: false,
      tags: ["squat", "technique", "form check"],
    },
    {
      id: uuid(),
      title: "Meal Prep Templates",
      description:
        "Printable weekly meal prep templates with grocery lists. Includes options for bulking, cutting, and maintenance calories.",
      category: "Nutrition",
      type: "doc",
      url: "https://example.com/meal-prep-templates.docx",
      uploadedBy: "Coach Sarah",
      createdAt: daysAgo(18),
      pinned: false,
      tags: ["meal prep", "templates", "grocery list"],
    },
    {
      id: uuid(),
      title: "RPE Scale Explained",
      description:
        "How to use Rate of Perceived Exertion (RPE) to autoregulate your training. Includes an RPE chart and examples for common lifts.",
      category: "Training Guides",
      type: "link",
      url: "https://www.strongerbyscience.com/rpe/",
      uploadedBy: "Coach Mike",
      createdAt: daysAgo(25),
      pinned: false,
      tags: ["RPE", "autoregulation", "programming"],
    },
    {
      id: uuid(),
      title: "Sleep Optimization Tips",
      description:
        "Evidence-based strategies to improve sleep quality: temperature, light exposure, caffeine timing, and evening routines.",
      category: "Recovery",
      type: "link",
      url: "https://hubermanlab.com/toolkit-for-sleep/",
      uploadedBy: "Gym Owner",
      createdAt: daysAgo(12),
      pinned: false,
      tags: ["sleep", "recovery", "habits"],
    },
    {
      id: uuid(),
      title: "Competition Prep Guide",
      description:
        "12-week competition prep guide for powerlifting or CrossFit. Covers peaking, weight cuts, meet-day nutrition, and warm-up strategy.",
      category: "Training Guides",
      type: "pdf",
      url: "https://example.com/comp-prep-guide.pdf",
      uploadedBy: "Coach Mike",
      createdAt: daysAgo(8),
      pinned: false,
      tags: ["competition", "peaking", "meet prep"],
    },
    {
      id: uuid(),
      title: "Supplement Recommendations",
      description:
        "Our evidence-based supplement recommendations: creatine, protein, vitamin D, fish oil, and magnesium. What works and what doesn't.",
      category: "Nutrition",
      type: "doc",
      url: "https://example.com/supplement-guide.docx",
      uploadedBy: "Coach Sarah",
      createdAt: daysAgo(5),
      pinned: false,
      tags: ["supplements", "creatine", "protein"],
    },
    {
      id: uuid(),
      title: "Gym Rules & Policies",
      description:
        "Facility rules, cancellation policy, guest policy, and code of conduct. Required reading for all members.",
      category: "Forms & Documents",
      type: "pdf",
      url: "https://example.com/gym-rules.pdf",
      uploadedBy: "Gym Owner",
      createdAt: daysAgo(45),
      pinned: true,
      tags: ["rules", "policy", "required"],
    },
  ];
}

/* ================================================================
   MODAL COMPONENT
   ================================================================ */
function ResourceModal({ resource, categories, onSave, onClose, B }) {
  const [form, setForm] = useState(
    resource || {
      title: "",
      description: "",
      category: categories[0] || "General",
      type: "pdf",
      url: "",
      tags: "",
      pinned: false,
    }
  );

  const handleSubmit = () => {
    if (!form.title.trim() || !form.url.trim()) return;
    onSave({
      ...form,
      tags:
        typeof form.tags === "string"
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : form.tags,
    });
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${B.border}`,
    background: B.dark,
    color: B.text,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: B.muted,
    marginBottom: 4,
    display: "block",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: B.card,
          borderRadius: 16,
          border: `1px solid ${B.border}`,
          padding: 24,
          width: 480,
          maxWidth: "90vw",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: 0, color: B.text, fontSize: 18 }}>
            {resource ? "Edit Resource" : "Add Resource"}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: B.muted,
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            \u2715
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              style={inputStyle}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Resource title"
            />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Brief description of this resource"
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Category</label>
              <select
                style={inputStyle}
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Type</label>
              <select
                style={inputStyle}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {["pdf", "video", "link", "image", "doc", "file"].map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>URL *</label>
            <input
              style={inputStyle}
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div>
            <label style={labelStyle}>Tags (comma-separated)</label>
            <input
              style={inputStyle}
              value={
                Array.isArray(form.tags) ? form.tags.join(", ") : form.tags
              }
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: B.text,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
            />
            Pin this resource to the top
          </label>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 20,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: `1px solid ${B.border}`,
              background: "transparent",
              color: B.text,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: B.accent,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              opacity: form.title.trim() && form.url.trim() ? 1 : 0.5,
            }}
          >
            {resource ? "Save Changes" : "Add Resource"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   CATEGORY MANAGER MODAL
   ================================================================ */
function CategoryManager({ categories, setCategories, onClose, B }) {
  const [newCat, setNewCat] = useState("");

  const addCategory = () => {
    const name = newCat.trim();
    if (name && !categories.includes(name)) {
      setCategories([...categories, name]);
      setNewCat("");
    }
  };

  const removeCategory = (cat) => {
    setCategories(categories.filter((c) => c !== cat));
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: B.card,
          borderRadius: 16,
          border: `1px solid ${B.border}`,
          padding: 24,
          width: 380,
          maxWidth: "90vw",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, color: B.text, fontSize: 16 }}>
            Manage Categories
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: B.muted,
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            \u2715
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginBottom: 14,
          }}
        >
          {categories.map((cat) => (
            <div
              key={cat}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: 8,
                background: B.dark,
                border: `1px solid ${B.border}`,
              }}
            >
              <span style={{ fontSize: 13, color: B.text }}>{cat}</span>
              <button
                onClick={() => removeCategory(cat)}
                style={{
                  background: "none",
                  border: "none",
                  color: B.muted,
                  fontSize: 14,
                  cursor: "pointer",
                  padding: "2px 6px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = B.red)}
                onMouseLeave={(e) => (e.currentTarget.style.color = B.muted)}
              >
                \u2715
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            placeholder="New category name"
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${B.border}`,
              background: B.dark,
              color: B.text,
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={addCategory}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: B.accent,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN VIEW
   ================================================================ */
export default function ResourcesView() {
  const B = useTheme();
  const { isStaff, isAdmin, currentUser } = useAuth();
  const [resources, setResources] = useLocalStorage(
    "hf_resources",
    generateDemoResources()
  );
  const [categories, setCategories] = useLocalStorage(
    "hf_resource_categories",
    [...DEFAULT_CATEGORIES]
  );

  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  const [modal, setModal] = useState(null); // null | "add" | resource object
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  /* ---- filtering ---- */
  const filtered = useMemo(() => {
    let list = [...resources];
    if (activeCategory !== "All") {
      list = list.filter((r) => r.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          (r.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    // pinned first, then by date descending
    list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return list;
  }, [resources, activeCategory, search]);

  /* ---- category counts ---- */
  const categoryCounts = useMemo(() => {
    const counts = { All: resources.length };
    categories.forEach((c) => {
      counts[c] = resources.filter((r) => r.category === c).length;
    });
    return counts;
  }, [resources, categories]);

  /* ---- handlers ---- */
  const handleSave = (formData) => {
    if (modal && modal.id) {
      // editing
      setResources(
        resources.map((r) =>
          r.id === modal.id ? { ...r, ...formData } : r
        )
      );
    } else {
      // adding
      setResources([
        ...resources,
        {
          ...formData,
          id: uuid(),
          uploadedBy: currentUser?.displayName || "Unknown",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setModal(null);
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this resource?")) {
      setResources(resources.filter((r) => r.id !== id));
    }
  };

  const handleTogglePin = (id) => {
    setResources(
      resources.map((r) => (r.id === id ? { ...r, pinned: !r.pinned } : r))
    );
  };

  const handleOpen = (resource) => {
    window.open(resource.url, "_blank", "noopener");
  };

  /* ---- pill style helper ---- */
  const pillStyle = (active) => ({
    padding: "6px 14px",
    borderRadius: 20,
    border: `1px solid ${active ? B.accent : B.border}`,
    background: active ? `${B.accent}22` : "transparent",
    color: active ? B.accent : B.text,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  const getCategoryColor = (cat) => CATEGORY_COLORS[cat] || B.accent;

  /* ---- RENDER ---- */
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: B.text, fontSize: 26, fontWeight: 700 }}>
            Resources
          </h1>
          <p style={{ margin: "4px 0 0", color: B.muted, fontSize: 14 }}>
            Shared files and materials for members
          </p>
        </div>
        {isStaff && (
          <button
            onClick={() => setModal("add")}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: B.accent,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add Resource
          </button>
        )}
      </div>

      {/* CATEGORY TABS */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {["All", ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={pillStyle(activeCategory === cat)}
          >
            {cat}{" "}
            <span style={{ opacity: 0.6, marginLeft: 4 }}>
              {categoryCounts[cat] || 0}
            </span>
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={() => setShowCategoryManager(true)}
            title="Manage categories"
            style={{
              background: "none",
              border: `1px solid ${B.border}`,
              color: B.muted,
              fontSize: 14,
              cursor: "pointer",
              padding: "5px 10px",
              borderRadius: 20,
              flexShrink: 0,
            }}
          >
            {"\u2699"}
          </button>
        )}
      </div>

      {/* SEARCH + VIEW TOGGLE */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resources by title, description, or tags..."
          style={{
            flex: 1,
            minWidth: 200,
            padding: "9px 14px",
            borderRadius: 10,
            border: `1px solid ${B.border}`,
            background: B.card,
            color: B.text,
            fontSize: 13,
            outline: "none",
          }}
        />
        <div
          style={{
            display: "flex",
            borderRadius: 10,
            border: `1px solid ${B.border}`,
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setViewMode("grid")}
            style={{
              padding: "8px 14px",
              border: "none",
              background:
                viewMode === "grid" ? `${B.accent}22` : "transparent",
              color: viewMode === "grid" ? B.accent : B.muted,
              fontSize: 14,
              cursor: "pointer",
            }}
            title="Grid view"
          >
            {"\u25A6"}
          </button>
          <button
            onClick={() => setViewMode("list")}
            style={{
              padding: "8px 14px",
              border: "none",
              borderLeft: `1px solid ${B.border}`,
              background:
                viewMode === "list" ? `${B.accent}22` : "transparent",
              color: viewMode === "list" ? B.accent : B.muted,
              fontSize: 14,
              cursor: "pointer",
            }}
            title="List view"
          >
            {"\u2630"}
          </button>
        </div>
      </div>

      {/* EMPTY STATE */}
      {filtered.length === 0 && (
        <Card
          style={{
            textAlign: "center",
            padding: 48,
            color: B.muted,
            fontSize: 14,
          }}
        >
          No resources found.{" "}
          {search && "Try adjusting your search or filters."}
        </Card>
      )}

      {/* GRID VIEW */}
      {viewMode === "grid" && filtered.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((r) => {
            const ytId = r.type === "video" ? getYouTubeId(r.url) : null;
            return (
              <Card key={r.id} style={{ padding: 0, overflow: "hidden" }}>
                {/* YouTube thumbnail */}
                {ytId && (
                  <div
                    style={{
                      width: "100%",
                      height: 160,
                      background: `url(https://img.youtube.com/vi/${ytId}/mqdefault.jpg) center/cover`,
                      position: "relative",
                      cursor: "pointer",
                    }}
                    onClick={() => handleOpen(r)}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.3)",
                      }}
                    >
                      <span style={{ fontSize: 36 }}>{"\u25B6\uFE0F"}</span>
                    </div>
                  </div>
                )}

                <div style={{ padding: 16 }}>
                  {/* Pin badge */}
                  {r.pinned && (
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: B.orange,
                        marginBottom: 6,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {"\uD83D\uDCCC"} Pinned
                    </div>
                  )}

                  {/* Type icon + title */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 20,
                        lineHeight: 1,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {TYPE_ICONS[r.type]}
                    </span>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 700,
                        color: B.text,
                        lineHeight: 1.3,
                      }}
                    >
                      {r.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p
                    style={{
                      margin: "0 0 10px",
                      fontSize: 13,
                      color: B.muted,
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {r.description}
                  </p>

                  {/* Category badge */}
                  <span
                    style={{
                      display: "inline-block",
                      padding: "3px 10px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      background: getCategoryColor(r.category) + "22",
                      color: getCategoryColor(r.category),
                      marginBottom: 8,
                    }}
                  >
                    {r.category}
                  </span>

                  {/* Tags */}
                  {r.tags && r.tags.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                        marginBottom: 10,
                      }}
                    >
                      {r.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: "2px 8px",
                            borderRadius: 8,
                            fontSize: 10,
                            background: `${B.border}`,
                            color: B.muted,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Meta */}
                  <div
                    style={{
                      fontSize: 11,
                      color: B.dim || B.muted,
                      marginBottom: 12,
                    }}
                  >
                    Uploaded by {r.uploadedBy} &middot; {fmtDate(r.createdAt)}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleOpen(r)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: B.accent,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Open
                    </button>
                    {isStaff && (
                      <>
                        <button
                          onClick={() => handleTogglePin(r.id)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: `1px solid ${B.border}`,
                            background: "transparent",
                            color: r.pinned ? B.orange : B.muted,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          {r.pinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          onClick={() => setModal(r)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: `1px solid ${B.border}`,
                            background: "transparent",
                            color: B.text,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: `1px solid ${B.border}`,
                            background: "transparent",
                            color: B.red,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && filtered.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${B.border}`,
                  textAlign: "left",
                }}
              >
                <th
                  style={{
                    padding: "10px 14px",
                    fontWeight: 600,
                    color: B.muted,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Resource
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    fontWeight: 600,
                    color: B.muted,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Category
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    fontWeight: 600,
                    color: B.muted,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Tags
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    fontWeight: 600,
                    color: B.muted,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Date
                </th>
                <th
                  style={{
                    padding: "10px 14px",
                    fontWeight: 600,
                    color: B.muted,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: `1px solid ${B.border}`,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = `${B.border}44`)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <td style={{ padding: "10px 14px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>
                        {TYPE_ICONS[r.type]}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, color: B.text }}>
                          {r.pinned && (
                            <span style={{ color: B.orange, marginRight: 4 }}>
                              \ud83d\udccc
                            </span>
                          )}
                          {r.title}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        background: getCategoryColor(r.category) + "22",
                        color: getCategoryColor(r.category),
                      }}
                    >
                      {r.category}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 3,
                      }}
                    >
                      {(r.tags || []).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: "1px 6px",
                            borderRadius: 6,
                            fontSize: 10,
                            background: B.border,
                            color: B.muted,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: B.muted,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtDate(r.createdAt)}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => handleOpen(r)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          border: "none",
                          background: B.accent,
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Open
                      </button>
                      {isStaff && (
                        <>
                          <button
                            onClick={() => handleTogglePin(r.id)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: `1px solid ${B.border}`,
                              background: "transparent",
                              color: r.pinned ? B.orange : B.muted,
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            {r.pinned ? "Unpin" : "Pin"}
                          </button>
                          <button
                            onClick={() => setModal(r)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: `1px solid ${B.border}`,
                              background: "transparent",
                              color: B.text,
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: `1px solid ${B.border}`,
                              background: "transparent",
                              color: B.red,
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* MODALS */}
      {modal && (
        <ResourceModal
          resource={modal === "add" ? null : modal}
          categories={categories}
          onSave={handleSave}
          onClose={() => setModal(null)}
          B={B}
        />
      )}
      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          setCategories={setCategories}
          onClose={() => setShowCategoryManager(false)}
          B={B}
        />
      )}
    </div>
  );
}
