import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";

/* ========== constants ========== */
const DEFAULT_WAIVER_TEXT = `ASSUMPTION OF RISK AND WAIVER OF LIABILITY

I, the undersigned, acknowledge that I have voluntarily chosen to participate in exercise and fitness activities at this facility. I understand that physical exercise involves inherent risks including, but not limited to, muscle strains, sprains, fractures, cardiovascular events, and other injuries that may arise during physical activity. I assume full responsibility for any risks, injuries, or damages that may occur as a result of my participation.

MEDICAL CLEARANCE AND HEALTH DECLARATION

I certify that I am in good physical health and have no medical conditions that would prevent me from safely participating in exercise programs. I acknowledge that it is my responsibility to consult with a physician before beginning any exercise program. I agree to inform the staff of any changes in my health status. I understand that the staff are not medical professionals and cannot provide medical advice.

PHOTO AND MEDIA RELEASE

I grant permission for photographs, videos, or other media taken during my time at the facility to be used for promotional purposes, including but not limited to social media, website, and marketing materials. I waive any right to compensation or approval for such use. If I do not wish to be photographed, I will notify the front desk in writing.

TERMS AND CONDITIONS

I agree to abide by all facility rules, policies, and procedures. I understand that my membership may be suspended or terminated if I fail to comply. I agree to use all equipment properly and to ask for instruction if unsure. I release the facility, its owners, employees, and agents from any and all liability for injury, loss, or damage arising from my use of the facility and its services. This waiver shall remain in effect for the duration of my membership.`;

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(first, last) {
  return ((first?.[0] || "") + (last?.[0] || "")).toUpperCase();
}

/* ========== Signature Canvas ========== */
function SignatureCanvas({ canvasRef, B }) {
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const getPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }, [canvasRef]);

  const startDraw = useCallback((e) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  }, [getPos]);

  const draw = useCallback((e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = B.text;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPos.current = pos;
  }, [getPos, canvasRef, B.text]);

  const stopDraw = useCallback(() => { isDrawing.current = false; }, []);

  const clear = useCallback(() => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("mouseleave", stopDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDraw);
    return () => {
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDraw);
      canvas.removeEventListener("mouseleave", stopDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDraw);
    };
  }, [canvasRef, startDraw, draw, stopDraw]);

  return { clear };
}

/* ========== Main Component ========== */
export default function WaiverView() {
  const B = useTheme();
  const { members } = useMembers();
  const [waiverTemplate, setWaiverTemplate] = useLocalStorage("hf_waiver_template", DEFAULT_WAIVER_TEXT);
  const [waivers, setWaivers] = useLocalStorage("hf_waivers", (() => {
    try {
      const stored = localStorage.getItem("hf_members");
      const m = stored ? JSON.parse(stored) : [];
      return m.slice(0, 4).map((member, i) => ({
        id: crypto.randomUUID(),
        memberId: member.id,
        signedAt: new Date(Date.now() - (i + 1) * 86400000 * (i * 15 + 5)).toISOString(),
        signaturePng: "",
        fullName: member.firstName + " " + member.lastName,
        waiverText: DEFAULT_WAIVER_TEXT,
      }));
    } catch { return []; }
  })());

  const [templateDraft, setTemplateDraft] = useState(waiverTemplate);
  const [templateEditing, setTemplateEditing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState("");
  const [signingMemberId, setSigningMemberId] = useState(null);
  const [viewingWaiverId, setViewingWaiverId] = useState(null);

  // Signing form state
  const [agreed, setAgreed] = useState(false);
  const [sigFullName, setSigFullName] = useState("");
  const canvasRef = useRef(null);
  const clearRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const waiverMap = useMemo(() => {
    const map = {};
    (Array.isArray(waivers) ? waivers : []).forEach(w => { map[w.memberId] = w; });
    return map;
  }, [waivers]);

  const filtered = useMemo(() => {
    return members.filter(m => {
      if (filter === "signed") return !!waiverMap[m.id];
      if (filter === "unsigned") return !waiverMap[m.id];
      return true;
    });
  }, [members, filter, waiverMap]);

  const signingMember = members.find(m => m.id === signingMemberId);
  const viewingWaiver = waivers.find(w => w.id === viewingWaiverId);
  const viewingMember = viewingWaiver ? members.find(m => m.id === viewingWaiver.memberId) : null;

  const handleSign = useCallback(() => {
    if (!agreed || !sigFullName.trim()) return;
    const canvas = canvasRef.current;
    const signaturePng = canvas ? canvas.toDataURL("image/png") : "";
    const newWaiver = {
      id: crypto.randomUUID(),
      memberId: signingMemberId,
      signedAt: new Date().toISOString(),
      signaturePng,
      fullName: sigFullName.trim(),
      waiverText: waiverTemplate,
    };
    setWaivers(prev => [...prev.filter(w => w.memberId !== signingMemberId), newWaiver]);
    setSigningMemberId(null);
    setAgreed(false);
    setSigFullName("");
    showToast("Waiver signed successfully!");
  }, [agreed, sigFullName, signingMemberId, waiverTemplate, setWaivers, showToast]);

  const openSigning = useCallback((memberId) => {
    const m = members.find(x => x.id === memberId);
    setSigningMemberId(memberId);
    setAgreed(false);
    setSigFullName(m ? m.firstName + " " + m.lastName : "");
  }, [members]);

  /* ========== styles ========== */
  const s = {
    page: { padding: 32, maxWidth: 1200, margin: "0 auto" },
    h1: { fontSize: 28, fontWeight: 700, color: B.text, margin: 0 },
    subtitle: { color: B.muted, fontSize: 14, marginTop: 4 },
    section: { marginTop: 28 },
    sectionTitle: { fontSize: 18, fontWeight: 600, color: B.text, marginBottom: 12 },
    label: { fontSize: 13, fontWeight: 600, color: B.muted, marginBottom: 6, display: "block" },
    textarea: { width: "100%", minHeight: 180, background: B.darker, color: B.text, border: "1px solid " + B.border, borderRadius: 8, padding: 12, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
    btn: (bg, fg) => ({ padding: "8px 18px", borderRadius: 8, border: "none", background: bg || B.green, color: fg || "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }),
    btnSm: (bg, fg) => ({ padding: "5px 12px", borderRadius: 6, border: "none", background: bg || B.border, color: fg || B.text, fontWeight: 500, fontSize: 12, cursor: "pointer" }),
    table: { width: "100%", borderCollapse: "collapse" },
    th: { textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 600, color: B.muted, borderBottom: "1px solid " + B.border, textTransform: "uppercase", letterSpacing: 0.5 },
    td: { padding: "10px 12px", borderBottom: "1px solid " + B.border, fontSize: 14, color: B.text },
    avatar: { width: 32, height: 32, borderRadius: "50%", background: B.green + "22", color: B.green, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, marginRight: 10, verticalAlign: "middle" },
    badge: (color) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: color + "22", color }),
    filterBtn: (active) => ({ padding: "6px 16px", borderRadius: 999, border: "1px solid " + (active ? B.green : B.border), background: active ? B.green + "18" : "transparent", color: active ? B.green : B.muted, fontWeight: 500, fontSize: 13, cursor: "pointer", marginRight: 8 }),
    overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
    modal: { background: B.card, borderRadius: 16, border: "1px solid " + B.border, maxWidth: 640, width: "100%", maxHeight: "90vh", overflow: "auto", padding: 28 },
    input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid " + B.border, background: B.darker, color: B.text, fontSize: 14, boxSizing: "border-box" },
    toast: { position: "fixed", bottom: 24, right: 24, background: B.green, color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 2000, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" },
  };

  return (
    <div style={s.page}>
      <h1 style={s.h1}>Waivers & Agreements</h1>
      <p style={s.subtitle}>Manage digital waivers, view signing status, and collect signatures.</p>

      {/* Template Editor */}
      <div style={s.section}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={s.sectionTitle}>Waiver Template</h2>
            {!templateEditing ? (
              <button style={s.btn(B.border, B.text)} onClick={() => { setTemplateDraft(waiverTemplate); setTemplateEditing(true); }}>Edit Template</button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button style={s.btn(B.border, B.text)} onClick={() => setTemplateEditing(false)}>Cancel</button>
                <button style={s.btn()} onClick={() => { setWaiverTemplate(templateDraft); setTemplateEditing(false); showToast("Waiver template saved!"); }}>Save Template</button>
              </div>
            )}
          </div>
          {templateEditing ? (
            <textarea style={s.textarea} value={templateDraft} onChange={e => setTemplateDraft(e.target.value)} />
          ) : (
            <div style={{ background: B.darker, borderRadius: 8, padding: 16, fontSize: 13, color: B.muted, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto", lineHeight: 1.6 }}>
              {waiverTemplate}
            </div>
          )}
        </Card>
      </div>

      {/* Member Waiver Status */}
      <div style={s.section}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <h2 style={{ ...s.sectionTitle, margin: 0 }}>Client Waiver Status</h2>
            <div>
              {["all", "signed", "unsigned"].map(f => (
                <button key={f} style={s.filterBtn(filter === f)} onClick={() => setFilter(f)}>
                  {f === "all" ? "All" : f === "signed" ? "Signed" : "Unsigned"}{" "}
                  ({f === "all" ? members.length : f === "signed" ? Object.keys(waiverMap).length : members.length - Object.keys(waiverMap).length})
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Client</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Date Signed</th>
                  <th style={s.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const w = waiverMap[m.id];
                  const signed = !!w;
                  return (
                    <tr key={m.id}>
                      <td style={s.td}>
                        <span style={s.avatar}>{getInitials(m.firstName, m.lastName)}</span>
                        {m.firstName} {m.lastName}
                      </td>
                      <td style={s.td}>
                        <span style={s.badge(signed ? B.green : B.orange)}>
                          {signed ? "Signed" : "Not Signed"}
                        </span>
                      </td>
                      <td style={{ ...s.td, color: B.muted }}>{signed ? fmtDate(w.signedAt) : "---"}</td>
                      <td style={s.td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {signed ? (
                            <button style={s.btnSm()} onClick={() => setViewingWaiverId(w.id)}>View</button>
                          ) : (
                            <>
                              <button style={s.btnSm(B.green + "22", B.green)} onClick={() => openSigning(m.id)}>Sign Waiver</button>
                              <button style={s.btnSm()} onClick={() => showToast(`Waiver sent to ${m.email}`)}>Send Waiver</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} style={{ ...s.td, textAlign: "center", color: B.muted, padding: 32 }}>No clients match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Signing Modal */}
      {signingMember && (
        <div style={s.overlay} onClick={() => setSigningMemberId(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: B.text, margin: 0 }}>Sign Waiver</h2>
              <button style={{ background: "none", border: "none", color: B.muted, fontSize: 22, cursor: "pointer" }} onClick={() => setSigningMemberId(null)}>x</button>
            </div>
            <p style={{ color: B.muted, fontSize: 13, marginBottom: 12 }}>
              Signing for: <strong style={{ color: B.text }}>{signingMember.firstName} {signingMember.lastName}</strong>
            </p>

            {/* Waiver text */}
            <div style={{ background: B.darker, borderRadius: 8, padding: 16, fontSize: 12, color: B.muted, whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto", lineHeight: 1.6, marginBottom: 16, border: "1px solid " + B.border }}>
              {waiverTemplate}
            </div>

            {/* Agreement checkbox */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2, accentColor: B.green }} />
              <span style={{ fontSize: 13, color: B.text, fontWeight: 500 }}>I have read and agree to the terms above</span>
            </label>

            {/* Signature canvas */}
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Signature (draw below)</label>
              <div style={{ border: "1px solid " + B.border, borderRadius: 8, background: B.darker, position: "relative" }}>
                <canvas
                  ref={el => {
                    canvasRef.current = el;
                    if (el && !el._initialized) {
                      el._initialized = true;
                      el.width = el.parentElement.clientWidth - 2;
                      el.height = 120;
                    }
                  }}
                  style={{ display: "block", borderRadius: 8, cursor: "crosshair", width: "100%", height: 120 }}
                />
              </div>
              <SignatureCanvasBinder canvasRef={canvasRef} clearRef={clearRef} B={B} />
              <button style={{ ...s.btnSm(B.border, B.muted), marginTop: 6 }} onClick={() => clearRef.current && clearRef.current()}>Clear Signature</button>
            </div>

            {/* Full name */}
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Full Name</label>
              <input style={s.input} value={sigFullName} onChange={e => setSigFullName(e.target.value)} placeholder="Type your full name" />
            </div>

            {/* Date */}
            <div style={{ marginBottom: 20 }}>
              <label style={s.label}>Date</label>
              <input style={{ ...s.input, opacity: 0.7 }} value={new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} readOnly />
            </div>

            <button
              style={{ ...s.btn(), width: "100%", padding: "12px 0", opacity: (agreed && sigFullName.trim()) ? 1 : 0.4, cursor: (agreed && sigFullName.trim()) ? "pointer" : "not-allowed" }}
              onClick={handleSign}
              disabled={!agreed || !sigFullName.trim()}
            >
              Sign Waiver
            </button>
          </div>
        </div>
      )}

      {/* View Signed Waiver Modal */}
      {viewingWaiver && (
        <div style={s.overlay} onClick={() => setViewingWaiverId(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: B.text, margin: 0 }}>Signed Waiver</h2>
              <button style={{ background: "none", border: "none", color: B.muted, fontSize: 22, cursor: "pointer" }} onClick={() => setViewingWaiverId(null)}>x</button>
            </div>

            {viewingMember && (
              <p style={{ color: B.muted, fontSize: 13, marginBottom: 12 }}>
                Client: <strong style={{ color: B.text }}>{viewingMember.firstName} {viewingMember.lastName}</strong>
              </p>
            )}

            <div style={{ background: B.darker, borderRadius: 8, padding: 16, fontSize: 12, color: B.muted, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto", lineHeight: 1.6, marginBottom: 16, border: "1px solid " + B.border }}>
              {viewingWaiver.waiverText}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={s.label}>Full Name</label>
                <p style={{ color: B.text, fontSize: 14, margin: 0 }}>{viewingWaiver.fullName}</p>
              </div>
              <div>
                <label style={s.label}>Date Signed</label>
                <p style={{ color: B.text, fontSize: 14, margin: 0 }}>{fmtDate(viewingWaiver.signedAt)}</p>
              </div>
            </div>

            {viewingWaiver.signaturePng && (
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Signature</label>
                <div style={{ background: B.darker, borderRadius: 8, padding: 12, border: "1px solid " + B.border }}>
                  <img src={viewingWaiver.signaturePng} alt="Signature" style={{ maxWidth: "100%", maxHeight: 100 }} />
                </div>
              </div>
            )}

            <button style={s.btn(B.border, B.text)} onClick={() => showToast("PDF download started...")}>
              Download PDF
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}

/* Helper component that binds canvas drawing events */
function SignatureCanvasBinder({ canvasRef, clearRef, B }) {
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = e.touches ? e.touches[0] : e;
    return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const startDraw = (e) => {
      e.preventDefault();
      isDrawing.current = true;
      lastPos.current = getPos(e);
    };
    const draw = (e) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      const ctx = canvas.getContext("2d");
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = B.text;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.stroke();
      lastPos.current = pos;
    };
    const stopDraw = () => { isDrawing.current = false; };

    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("mouseleave", stopDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDraw);

    clearRef.current = () => {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    return () => {
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDraw);
      canvas.removeEventListener("mouseleave", stopDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDraw);
    };
  }, [canvasRef, clearRef, getPos, B.text]);

  return null;
}
