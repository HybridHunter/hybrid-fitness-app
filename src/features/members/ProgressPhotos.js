import { useState, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";

const PHOTO_TYPES = ["front", "side", "back"];
const TYPE_LABELS = { front: "Front", side: "Side", back: "Back" };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

/**
 * ProgressPhotos — used inside MemberProfile as a tab, and in ClientPortal.
 * Props:
 *   memberId: string
 *   readOnly: boolean (client portal = false, they can add their own)
 *   compact: boolean (true = embedded in client portal progress tab)
 */
export default function ProgressPhotos({ memberId, readOnly = false, compact = false }) {
  const B = useTheme();
  const [allPhotos, setAllPhotos] = useLocalStorage("hf_progress_photos", []);
  const [showForm, setShowForm] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(null);
  const [form, setForm] = useState({
    photoUrl: "",
    date: todayISO(),
    type: "front",
    weight: "",
    bodyFatPercent: "",
    notes: "",
  });

  // Filter photos for this member
  const photos = useMemo(
    () => allPhotos
      .filter(p => p.memberId === memberId)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [allPhotos, memberId]
  );

  // Group by date
  const grouped = useMemo(() => {
    const map = {};
    photos.forEach(p => {
      if (!map[p.date]) map[p.date] = [];
      map[p.date].push(p);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [photos]);

  // Unique dates for comparison pickers
  const uniqueDates = useMemo(() => [...new Set(photos.map(p => p.date))].sort(), [photos]);

  // Try to auto-fill body fat from latest InBody
  const getLatestBodyFat = () => {
    try {
      const members = JSON.parse(localStorage.getItem("hf_members") || "[]");
      const member = members.find(m => m.id === memberId);
      if (member?.inbody?.history?.length > 0) {
        const latest = member.inbody.history[member.inbody.history.length - 1];
        return latest.bodyFatPercent || "";
      }
    } catch {}
    return "";
  };

  const handleAdd = () => {
    if (!form.photoUrl.trim()) return;
    const newPhoto = {
      id: crypto.randomUUID(),
      memberId,
      date: form.date || todayISO(),
      photoUrl: form.photoUrl.trim(),
      type: form.type,
      weight: form.weight ? Number(form.weight) : null,
      bodyFatPercent: form.bodyFatPercent ? Number(form.bodyFatPercent) : null,
      notes: form.notes.trim(),
      _createdAt: new Date().toISOString(),
    };
    setAllPhotos(prev => [...prev, newPhoto]);
    setForm({ photoUrl: "", date: todayISO(), type: "front", weight: "", bodyFatPercent: "", notes: "" });
    setShowForm(false);
  };

  const handleDelete = (photoId) => {
    setAllPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  // Styles
  const cardStyle = {
    background: B.card, border: `1px solid ${B.border}`, borderRadius: 12, padding: 16, marginBottom: 12,
  };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4 };
  const inputStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${B.border}`,
    background: B.darker, color: B.text, fontSize: 14, boxSizing: "border-box", outline: "none",
  };
  const btnStyle = (bg, fg) => ({
    padding: "9px 20px", borderRadius: 8, border: "none", background: bg || B.accent,
    color: fg || "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
  });
  const overlay = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  };
  const modal = {
    background: B.card, border: `1px solid ${B.border}`, borderRadius: 16,
    padding: 24, width: 520, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto",
  };

  return (
    <div>
      {/* Header */}
      {!compact && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: B.text, margin: 0 }}>Progress Photos</h3>
          <div style={{ display: "flex", gap: 8 }}>
            {uniqueDates.length >= 2 && (
              <button style={btnStyle(B.border, B.text)} onClick={() => setShowCompare(true)}>
                Before / After
              </button>
            )}
            {!readOnly && (
              <button style={btnStyle()} onClick={() => {
                setForm(f => ({ ...f, bodyFatPercent: f.bodyFatPercent || getLatestBodyFat() }));
                setShowForm(true);
              }}>
                + Add Photo
              </button>
            )}
          </div>
        </div>
      )}

      {compact && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: B.text, margin: 0 }}>My Progress Photos</h3>
          <div style={{ display: "flex", gap: 8 }}>
            {uniqueDates.length >= 2 && (
              <button style={{ ...btnStyle(B.border, B.text), padding: "6px 12px", fontSize: 12 }} onClick={() => setShowCompare(true)}>
                Before / After
              </button>
            )}
            <button style={{ ...btnStyle(), padding: "6px 12px", fontSize: 12 }} onClick={() => {
              setForm(f => ({ ...f, bodyFatPercent: f.bodyFatPercent || getLatestBodyFat() }));
              setShowForm(true);
            }}>
              + Add Photo
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📷</div>
          <div style={{ color: B.dim, fontSize: 14 }}>No progress photos yet.</div>
          {!readOnly && (
            <button style={{ ...btnStyle(), marginTop: 16 }} onClick={() => setShowForm(true)}>
              Add Your First Photo
            </button>
          )}
        </div>
      ) : (
        grouped.map(([date, datePhotos]) => (
          <div key={date} style={{ marginBottom: 20 }}>
            {/* Date header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: B.text }}>{fmtDate(date)}</div>
              {datePhotos[0]?.weight && (
                <span style={{ fontSize: 12, fontWeight: 600, color: B.accent, background: B.accent + "18", padding: "2px 8px", borderRadius: 8 }}>
                  {datePhotos[0].weight} lbs
                </span>
              )}
              {datePhotos[0]?.bodyFatPercent && (
                <span style={{ fontSize: 12, fontWeight: 600, color: B.orange || "#f59e0b", background: (B.orange || "#f59e0b") + "18", padding: "2px 8px", borderRadius: 8 }}>
                  {datePhotos[0].bodyFatPercent}% BF
                </span>
              )}
            </div>

            {/* Photos row */}
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {datePhotos.map(photo => (
                <div key={photo.id} style={{
                  flexShrink: 0, width: compact ? 110 : 150, borderRadius: 12, overflow: "hidden",
                  border: `1px solid ${B.border}`, background: B.darker, cursor: "pointer",
                  transition: "transform 0.15s",
                }}
                  onClick={() => setViewPhoto(photo)}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  <img
                    src={photo.photoUrl}
                    alt={`${TYPE_LABELS[photo.type]} - ${fmtDate(photo.date)}`}
                    style={{ width: "100%", height: compact ? 140 : 180, objectFit: "cover", display: "block" }}
                    onError={e => { e.target.style.display = "none"; }}
                  />
                  <div style={{ padding: "6px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: B.text, textTransform: "uppercase" }}>
                      {TYPE_LABELS[photo.type]}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            {datePhotos.some(p => p.notes) && (
              <div style={{ marginTop: 6, fontSize: 12, color: B.muted, fontStyle: "italic" }}>
                {datePhotos.find(p => p.notes)?.notes}
              </div>
            )}
          </div>
        ))
      )}

      {/* Add Photo Modal */}
      {showForm && (
        <div style={overlay} onClick={() => setShowForm(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: B.text, margin: 0 }}>Add Progress Photo</h2>
              <button onClick={() => setShowForm(false)} style={{ background: B.border, color: B.text, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 16, cursor: "pointer" }}>
                &times;
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Photo URL</label>
                <input style={inputStyle} value={form.photoUrl} onChange={e => setForm(f => ({ ...f, photoUrl: e.target.value }))} placeholder="https://example.com/photo.jpg" />
                <div style={{ fontSize: 11, color: B.dim, marginTop: 4 }}>Paste a direct image URL (file upload coming with Supabase Storage)</div>
              </div>

              {form.photoUrl && (
                <div style={{ background: B.darker, borderRadius: 8, padding: 8, border: `1px solid ${B.border}`, textAlign: "center" }}>
                  <img src={form.photoUrl} alt="Preview" style={{ maxHeight: 160, maxWidth: "100%", borderRadius: 6 }} onError={e => { e.target.style.display = "none"; }} />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" style={inputStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {PHOTO_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Weight (lbs) — optional</label>
                  <input type="number" style={inputStyle} value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="175" />
                </div>
                <div>
                  <label style={labelStyle}>Body Fat % — optional</label>
                  <input type="number" step="0.1" style={inputStyle} value={form.bodyFatPercent} onChange={e => setForm(f => ({ ...f, bodyFatPercent: e.target.value }))} placeholder="22.5" />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "inherit" }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="How are you feeling? Any changes to diet or training?" />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button style={btnStyle(B.border, B.text)} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={{ ...btnStyle(), opacity: form.photoUrl.trim() ? 1 : 0.5 }} onClick={handleAdd} disabled={!form.photoUrl.trim()}>
                Save Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Size View Modal */}
      {viewPhoto && (
        <div style={overlay} onClick={() => setViewPhoto(null)}>
          <div style={{ ...modal, width: 700, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 16, fontWeight: 700, color: B.text }}>{fmtDate(viewPhoto.date)}</span>
                <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: B.accent, textTransform: "uppercase" }}>{TYPE_LABELS[viewPhoto.type]}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {!readOnly && (
                  <button onClick={() => { handleDelete(viewPhoto.id); setViewPhoto(null); }} style={btnStyle("#ef4444" + "22", "#ef4444")}>
                    Delete
                  </button>
                )}
                <button onClick={() => setViewPhoto(null)} style={{ background: B.border, color: B.text, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 16, cursor: "pointer" }}>
                  &times;
                </button>
              </div>
            </div>
            <img src={viewPhoto.photoUrl} alt="Progress" style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 10 }} />
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12 }}>
              {viewPhoto.weight && (
                <span style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{viewPhoto.weight} lbs</span>
              )}
              {viewPhoto.bodyFatPercent && (
                <span style={{ fontSize: 14, fontWeight: 600, color: B.muted }}>{viewPhoto.bodyFatPercent}% BF</span>
              )}
            </div>
            {viewPhoto.notes && (
              <div style={{ marginTop: 8, fontSize: 13, color: B.muted, fontStyle: "italic" }}>{viewPhoto.notes}</div>
            )}
          </div>
        </div>
      )}

      {/* Before/After Comparison Modal */}
      {showCompare && <CompareModal
        B={B}
        photos={photos}
        uniqueDates={uniqueDates}
        onClose={() => setShowCompare(false)}
      />}
    </div>
  );
}

/* ══════ Before/After Comparison ══════ */
function CompareModal({ B, photos, uniqueDates, onClose }) {
  const [startDate, setStartDate] = useState(uniqueDates[0] || "");
  const [endDate, setEndDate] = useState(uniqueDates[uniqueDates.length - 1] || "");

  const startPhotos = useMemo(() => photos.filter(p => p.date === startDate), [photos, startDate]);
  const endPhotos = useMemo(() => photos.filter(p => p.date === endDate), [photos, endDate]);

  // Stats
  const startWeight = startPhotos.find(p => p.weight)?.weight;
  const endWeight = endPhotos.find(p => p.weight)?.weight;
  const startBF = startPhotos.find(p => p.bodyFatPercent)?.bodyFatPercent;
  const endBF = endPhotos.find(p => p.bodyFatPercent)?.bodyFatPercent;
  const elapsed = startDate && endDate ? daysBetween(startDate, endDate) : 0;

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  };
  const modal = {
    background: B.card, border: `1px solid ${B.border}`, borderRadius: 16,
    padding: 24, width: 800, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto",
  };
  const selectStyle = {
    padding: "8px 12px", borderRadius: 8, border: `1px solid ${B.border}`,
    background: B.darker, color: B.text, fontSize: 13, cursor: "pointer", outline: "none",
  };

  const getPhotoByType = (list, type) => list.find(p => p.type === type);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: B.text, margin: 0 }}>Before / After</h2>
          <button onClick={onClose} style={{ background: B.border, color: B.text, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 16, cursor: "pointer" }}>
            &times;
          </button>
        </div>

        {/* Date pickers */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4, display: "block" }}>Before (Start Date)</label>
            <select style={selectStyle} value={startDate} onChange={e => setStartDate(e.target.value)}>
              {uniqueDates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 20, color: B.dim, marginTop: 16 }}>&#8594;</div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4, display: "block" }}>After (End Date)</label>
            <select style={selectStyle} value={endDate} onChange={e => setEndDate(e.target.value)}>
              {uniqueDates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
            </select>
          </div>
        </div>

        {/* Stats overlay */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          {startWeight != null && endWeight != null && (
            <div style={{ background: B.darker, borderRadius: 10, padding: "10px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, textTransform: "uppercase" }}>Weight Change</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: (endWeight - startWeight) < 0 ? B.green || B.accent : B.red || "#ef4444" }}>
                {(endWeight - startWeight) > 0 ? "+" : ""}{(endWeight - startWeight).toFixed(1)} lbs
              </div>
            </div>
          )}
          {startBF != null && endBF != null && (
            <div style={{ background: B.darker, borderRadius: 10, padding: "10px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, textTransform: "uppercase" }}>Body Fat Change</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: (endBF - startBF) < 0 ? B.green || B.accent : B.red || "#ef4444" }}>
                {(endBF - startBF) > 0 ? "+" : ""}{(endBF - startBF).toFixed(1)}%
              </div>
            </div>
          )}
          {elapsed > 0 && (
            <div style={{ background: B.darker, borderRadius: 10, padding: "10px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: B.muted, textTransform: "uppercase" }}>Time Elapsed</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: B.text }}>
                {elapsed < 7 ? `${elapsed} days` : elapsed < 30 ? `${Math.round(elapsed / 7)} weeks` : `${Math.round(elapsed / 30)} months`}
              </div>
            </div>
          )}
        </div>

        {/* Side-by-side photos */}
        {PHOTO_TYPES.map(type => {
          const before = getPhotoByType(startPhotos, type);
          const after = getPhotoByType(endPhotos, type);
          if (!before && !after) return null;
          return (
            <div key={type} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: B.text, marginBottom: 8, textTransform: "uppercase" }}>
                {TYPE_LABELS[type]}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: B.darker, borderRadius: 10, overflow: "hidden", border: `1px solid ${B.border}`, textAlign: "center" }}>
                  {before ? (
                    <img src={before.photoUrl} alt={`Before ${type}`} style={{ width: "100%", maxHeight: 300, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ padding: 40, color: B.dim, fontSize: 13 }}>No {TYPE_LABELS[type].toLowerCase()} photo</div>
                  )}
                  <div style={{ padding: "6px 0", fontSize: 11, fontWeight: 600, color: B.muted }}>
                    Before — {fmtDate(startDate)}
                  </div>
                </div>
                <div style={{ background: B.darker, borderRadius: 10, overflow: "hidden", border: `1px solid ${B.border}`, textAlign: "center" }}>
                  {after ? (
                    <img src={after.photoUrl} alt={`After ${type}`} style={{ width: "100%", maxHeight: 300, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ padding: 40, color: B.dim, fontSize: 13 }}>No {TYPE_LABELS[type].toLowerCase()} photo</div>
                  )}
                  <div style={{ padding: "6px 0", fontSize: 11, fontWeight: 600, color: B.muted }}>
                    After — {fmtDate(endDate)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
