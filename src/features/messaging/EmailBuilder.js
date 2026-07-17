import { useState, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMembers } from "../../hooks/useMembers";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import Card from "../../components/ui/Card";
import { sendBulkEmail } from "../../utils/messaging";

const MERGE_TAGS = ["{firstName}", "{lastName}", "{gymName}"];

const TEMPLATES = {
  welcome: {
    label: "Welcome Email",
    subject: "Welcome to {gymName}!",
    body: `<p>Hi {firstName},</p>
<p>Welcome to <b>{gymName}</b>! We're thrilled to have you as part of our community.</p>
<p>Here are your next steps to get started:</p>
<ul>
<li>Download our app and log in with your email</li>
<li>Book your first session from the schedule</li>
<li>Complete your initial assessment so we can personalize your training</li>
<li>Introduce yourself in the community feed</li>
</ul>
<p>If you have any questions, don't hesitate to reach out. We're here to help you crush your goals!</p>
<p>See you soon,<br/>The {gymName} Team</p>`,
  },
  reminder: {
    label: "Session Reminder",
    subject: "Don't forget your session tomorrow!",
    body: `<p>Hey {firstName},</p>
<p>Just a friendly reminder that you have a session scheduled for <b>tomorrow</b>.</p>
<p>Make sure to:</p>
<ul>
<li>Get a good night's sleep</li>
<li>Stay hydrated</li>
<li>Bring your water bottle and towel</li>
</ul>
<p>We're looking forward to seeing you!</p>
<p>— {gymName}</p>`,
  },
  missed: {
    label: "Missed You",
    subject: "We miss you at {gymName}!",
    body: `<p>Hi {firstName},</p>
<p>We noticed it's been a while since your last visit, and we wanted to check in.</p>
<p>Your goals are still waiting for you, and the team at <b>{gymName}</b> is here to support you every step of the way.</p>
<p>Life gets busy — we get it. But even one session a week can make a huge difference. Why not come back this week?</p>
<p>If anything is holding you back, reply to this email and let us know. We'd love to help.</p>
<p>Hope to see you soon!</p>
<p>— The {gymName} Team</p>`,
  },
  birthday: {
    label: "Birthday",
    subject: "Happy Birthday {firstName}!",
    body: `<p>Happy Birthday, {firstName}! 🎂</p>
<p>Everyone at <b>{gymName}</b> wants to wish you an amazing day.</p>
<p>As a birthday treat, enjoy a complimentary guest pass — bring a friend to your next session on us!</p>
<p>Here's to another year of getting stronger. 💪</p>
<p>— The {gymName} Team</p>`,
  },
  payment: {
    label: "Payment Reminder",
    subject: "Payment reminder from {gymName}",
    body: `<p>Hi {firstName},</p>
<p>This is a friendly reminder that your upcoming payment for <b>{gymName}</b> is due soon.</p>
<p>Please ensure your payment method on file is up to date to avoid any interruption to your membership.</p>
<p>If you have any questions about your billing, feel free to reply to this email or contact us directly.</p>
<p>Thank you!</p>
<p>— {gymName} Billing</p>`,
  },
  custom: {
    label: "Custom",
    subject: "",
    body: "",
  },
};

const RECIPIENT_GROUPS = [
  { key: "all_active", label: "All Active Members" },
  { key: "all_trial", label: "All Trial Members" },
  { key: "all_frozen", label: "All Frozen Members" },
  { key: "all_inactive", label: "All Inactive Members" },
];

function mergeTags(text, member, gymName) {
  if (!text) return text;
  return text
    .replace(/\{firstName\}/g, member?.firstName || "Member")
    .replace(/\{lastName\}/g, member?.lastName || "")
    .replace(/\{gymName\}/g, gymName || "Our Gym");
}

/* ─── tiny toolbar button ─── */
function ToolbarBtn({ label, title, onClick, B, active }) {
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        background: active ? `${B.accent}22` : "transparent",
        border: `1px solid ${active ? B.accent : B.border}`,
        color: active ? B.accent : B.text,
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all .15s",
      }}
    >
      {label}
    </button>
  );
}

export default function EmailBuilder() {
  const B = useTheme();
  const { members } = useMembers();
  const [gymProfile] = useLocalStorage("hf_gym_profile", {});
  const gymName = gymProfile?.name || "Our Gym";

  /* ── state ── */
  const [step, setStep] = useState("compose"); // compose | recipients | preview | sending | sent
  const [template, setTemplate] = useState("welcome");
  const [subject, setSubject] = useState(TEMPLATES.welcome.subject);
  const [body, setBody] = useState(TEMPLATES.welcome.body);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [manualIds, setManualIds] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  /* template switch */
  const applyTemplate = (key) => {
    setTemplate(key);
    setSubject(TEMPLATES[key].subject);
    setBody(TEMPLATES[key].body);
  };

  /* recipients list */
  const resolvedRecipients = useMemo(() => {
    const set = new Set();
    members.forEach((m) => {
      if (selectedGroups.includes("all_active") && m.membershipStatus === "active") set.add(m.id);
      if (selectedGroups.includes("all_trial") && m.membershipStatus === "trial") set.add(m.id);
      if (selectedGroups.includes("all_frozen") && m.membershipStatus === "frozen") set.add(m.id);
      if (selectedGroups.includes("all_inactive") && m.membershipStatus === "inactive") set.add(m.id);
    });
    manualIds.forEach((id) => set.add(id));
    return members.filter((m) => set.has(m.id));
  }, [members, selectedGroups, manualIds]);

  /* member search filter */
  const searchResults = useMemo(() => {
    if (!memberSearch.trim()) return [];
    const q = memberSearch.toLowerCase();
    return members
      .filter(
        (m) =>
          `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
          (m.email && m.email.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [members, memberSearch]);

  /* preview sample */
  const sampleMember = resolvedRecipients[0] || members[0] || { firstName: "Jane", lastName: "Doe" };

  /* formatting helpers */
  const execCmd = (cmd, val) => document.execCommand(cmd, false, val);

  /* send */
  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const data = await sendBulkEmail({
        // Leave {firstName} in the subject — the server merges it per recipient (like the body)
        subject: subject.replace(/\{gymName\}/g, gymName),
        html: body,
        recipients: resolvedRecipients.map((m) => ({
          email: m.email,
          name: m.firstName,
          variables: { firstName: m.firstName || "Member", lastName: m.lastName || "", gymName },
        })),
      });
      if (data.error) throw new Error(data.error);
      setSendResult({ ok: true, count: data.sent ?? resolvedRecipients.length });
      setStep("sent");
    } catch (err) {
      setSendResult({ ok: false, error: err.message });
    } finally {
      setSending(false);
    }
  };

  /* shared styles */
  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${B.border}`,
    background: B.dark,
    color: B.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };
  const btnPrimary = {
    background: B.accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity .15s",
  };
  const btnSecondary = {
    background: "transparent",
    color: B.accent,
    border: `1px solid ${B.accent}`,
    borderRadius: 8,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };
  const pill = (active) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    borderRadius: 20,
    border: `1px solid ${active ? B.accent : B.border}`,
    background: active ? `${B.accent}18` : "transparent",
    color: active ? B.accent : B.text,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all .15s",
  });

  /* ── step indicator ── */
  const steps = ["compose", "recipients", "preview"];
  const stepLabels = { compose: "Compose", recipients: "Recipients", preview: "Preview & Send" };

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: B.text }}>Email Campaigns</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: B.muted }}>Build and send targeted emails to your members</p>
        </div>
      </div>

      {/* Step indicator */}
      {step !== "sent" && (
        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {steps.map((s, i) => {
            const active = s === step;
            const done = steps.indexOf(step) > i;
            return (
              <button
                key={s}
                onClick={() => setStep(s)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  background: active ? `${B.accent}15` : done ? `${B.accent}08` : "transparent",
                  border: `1px solid ${active ? B.accent : B.border}`,
                  borderRadius: 8,
                  color: active ? B.accent : done ? B.accent : B.muted,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  transition: "all .15s",
                }}
              >
                <span style={{ marginRight: 6, fontSize: 11 }}>{done ? "✓" : i + 1}</span>
                {stepLabels[s]}
              </button>
            );
          })}
        </div>
      )}

      {/* ═══════════ COMPOSE ═══════════ */}
      {step === "compose" && (
        <>
          {/* Template picker */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: B.text, marginBottom: 12 }}>Choose a Template</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => applyTemplate(key)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: `1.5px solid ${template === key ? B.accent : B.border}`,
                    background: template === key ? `${B.accent}15` : "transparent",
                    color: template === key ? B.accent : B.text,
                    fontSize: 13,
                    fontWeight: template === key ? 600 : 400,
                    cursor: "pointer",
                    transition: "all .15s",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Subject */}
          <Card style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: B.muted, display: "block", marginBottom: 6 }}>Subject Line</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject line..."
              style={inputStyle}
            />
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: B.muted, lineHeight: "24px" }}>Insert:</span>
              {MERGE_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSubject((s) => s + " " + tag)}
                  style={{
                    background: `${B.purple}15`,
                    color: B.purple,
                    border: `1px solid ${B.purple}30`,
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </Card>

          {/* Body editor */}
          <Card style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: B.muted, display: "block", marginBottom: 6 }}>Email Body</label>

            {/* Toolbar */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, padding: "8px 0", borderBottom: `1px solid ${B.border}` }}>
              <ToolbarBtn label="B" title="Bold" onClick={() => execCmd("bold")} B={B} />
              <ToolbarBtn label="I" title="Italic" onClick={() => execCmd("italic")} B={B} />
              <ToolbarBtn label="U" title="Underline" onClick={() => execCmd("underline")} B={B} />
              <ToolbarBtn
                label="🔗"
                title="Insert Link"
                onClick={() => {
                  const url = prompt("Enter URL:");
                  if (url) execCmd("createLink", url);
                }}
                B={B}
              />
              <ToolbarBtn label="• List" title="Bullet List" onClick={() => execCmd("insertUnorderedList")} B={B} />
              <ToolbarBtn label="1. List" title="Numbered List" onClick={() => execCmd("insertOrderedList")} B={B} />
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: B.muted }}>Merge:</span>
                {MERGE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => execCmd("insertHTML", `<span style="color:${B.purple};font-weight:600">${tag}</span>`)}
                    onMouseDown={(e) => e.preventDefault()}
                    style={{
                      background: `${B.purple}15`,
                      color: B.purple,
                      border: `1px solid ${B.purple}30`,
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* ContentEditable area */}
            <div
              contentEditable
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: body }}
              onBlur={(e) => setBody(e.currentTarget.innerHTML)}
              style={{
                minHeight: 240,
                padding: 14,
                borderRadius: 8,
                border: `1px solid ${B.border}`,
                background: B.dark,
                color: B.text,
                fontSize: 14,
                lineHeight: 1.7,
                outline: "none",
                overflowY: "auto",
              }}
            />
          </Card>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setStep("recipients")} style={btnPrimary}>
              Next: Select Recipients →
            </button>
          </div>
        </>
      )}

      {/* ═══════════ RECIPIENTS ═══════════ */}
      {step === "recipients" && (
        <>
          {/* Group checkboxes */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: B.text, marginBottom: 12 }}>Recipient Groups</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {RECIPIENT_GROUPS.map((g) => {
                const active = selectedGroups.includes(g.key);
                return (
                  <button
                    key={g.key}
                    onClick={() =>
                      setSelectedGroups((prev) =>
                        active ? prev.filter((k) => k !== g.key) : [...prev, g.key]
                      )
                    }
                    style={pill(active)}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: 4,
                      border: `2px solid ${active ? B.accent : B.border}`,
                      background: active ? B.accent : "transparent",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, color: "#fff", fontWeight: 700,
                    }}>
                      {active ? "✓" : ""}
                    </span>
                    {g.label}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Manual picker */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: B.text, marginBottom: 12 }}>Add Individual Members</div>
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search by name or email..."
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            {searchResults.length > 0 && (
              <div style={{ border: `1px solid ${B.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
                {searchResults.map((m) => {
                  const selected = manualIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() =>
                        setManualIds((prev) =>
                          selected ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                        )
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "8px 14px",
                        background: selected ? `${B.accent}10` : "transparent",
                        border: "none",
                        borderBottom: `1px solid ${B.border}`,
                        color: B.text,
                        fontSize: 13,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background .12s",
                      }}
                    >
                      <span style={{
                        width: 16, height: 16, borderRadius: 4,
                        border: `2px solid ${selected ? B.accent : B.border}`,
                        background: selected ? B.accent : "transparent",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: "#fff", fontWeight: 700, flexShrink: 0,
                      }}>
                        {selected ? "✓" : ""}
                      </span>
                      <span style={{ fontWeight: 500 }}>{m.firstName} {m.lastName}</span>
                      <span style={{ color: B.muted, fontSize: 12 }}>{m.email}</span>
                      <span style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: m.membershipStatus === "active" ? `${B.accent}18` : `${B.orange}18`,
                        color: m.membershipStatus === "active" ? B.accent : B.orange,
                      }}>
                        {m.membershipStatus}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected manual members */}
            {manualIds.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {manualIds.map((id) => {
                  const m = members.find((x) => x.id === id);
                  if (!m) return null;
                  return (
                    <span
                      key={id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        borderRadius: 16,
                        background: `${B.accent}15`,
                        color: B.accent,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {m.firstName} {m.lastName}
                      <button
                        onClick={() => setManualIds((prev) => prev.filter((x) => x !== id))}
                        style={{
                          background: "none",
                          border: "none",
                          color: B.accent,
                          cursor: "pointer",
                          fontSize: 14,
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Summary */}
          <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 28, fontWeight: 700, color: B.accent }}>{resolvedRecipients.length}</span>
              <span style={{ fontSize: 14, color: B.muted, marginLeft: 8 }}>
                {resolvedRecipients.length === 1 ? "recipient" : "recipients"} selected
              </span>
            </div>
            {resolvedRecipients.length === 0 && (
              <span style={{ fontSize: 12, color: B.orange, fontWeight: 500 }}>Select at least one recipient to continue</span>
            )}
          </Card>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setStep("compose")} style={btnSecondary}>← Back</button>
            <button
              onClick={() => setStep("preview")}
              disabled={resolvedRecipients.length === 0}
              style={{ ...btnPrimary, opacity: resolvedRecipients.length === 0 ? 0.4 : 1 }}
            >
              Next: Preview →
            </button>
          </div>
        </>
      )}

      {/* ═══════════ PREVIEW ═══════════ */}
      {step === "preview" && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: B.text, marginBottom: 4 }}>Email Preview</div>
            <p style={{ fontSize: 12, color: B.muted, margin: "0 0 16px" }}>
              Showing with sample data from: {sampleMember.firstName} {sampleMember.lastName}
            </p>

            {/* Simulated email */}
            <div
              style={{
                border: `1px solid ${B.border}`,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {/* Email header */}
              <div style={{ padding: "14px 20px", background: `${B.accent}08`, borderBottom: `1px solid ${B.border}` }}>
                <div style={{ fontSize: 11, color: B.muted, marginBottom: 4 }}>Subject</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: B.text }}>
                  {mergeTags(subject, sampleMember, gymName)}
                </div>
                <div style={{ fontSize: 12, color: B.muted, marginTop: 8 }}>
                  To: {resolvedRecipients.length} recipient{resolvedRecipients.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Email body */}
              <div
                style={{
                  padding: 24,
                  background: B.card,
                  color: B.text,
                  fontSize: 14,
                  lineHeight: 1.7,
                }}
                dangerouslySetInnerHTML={{
                  __html: mergeTags(body, sampleMember, gymName),
                }}
              />
            </div>
          </Card>

          {/* Recipient list preview */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: B.text, marginBottom: 12 }}>
              Recipients ({resolvedRecipients.length})
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {resolvedRecipients.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 0",
                    borderBottom: `1px solid ${B.border}22`,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 500, color: B.text }}>{m.firstName} {m.lastName}</span>
                  <span style={{ color: B.muted, fontSize: 12 }}>{m.email}</span>
                </div>
              ))}
            </div>
          </Card>

          {sendResult && !sendResult.ok && (
            <div style={{ padding: "10px 16px", background: `${B.red}15`, border: `1px solid ${B.red}30`, borderRadius: 8, marginBottom: 16, color: B.red, fontSize: 13 }}>
              Error: {sendResult.error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setStep("recipients")} style={btnSecondary}>← Back</button>
            <button onClick={handleSend} disabled={sending} style={{ ...btnPrimary, opacity: sending ? 0.6 : 1 }}>
              {sending ? "Sending..." : `Send to ${resolvedRecipients.length} Recipient${resolvedRecipients.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </>
      )}

      {/* ═══════════ SENT ═══════════ */}
      {step === "sent" && sendResult?.ok && (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: B.text }}>Campaign Sent!</h2>
          <p style={{ color: B.muted, fontSize: 14, margin: "8px 0 24px" }}>
            Successfully sent to {sendResult.count} recipient{sendResult.count !== 1 ? "s" : ""}.
          </p>
          <button
            onClick={() => {
              setStep("compose");
              setSendResult(null);
              applyTemplate("custom");
              setSelectedGroups([]);
              setManualIds([]);
            }}
            style={btnPrimary}
          >
            Create Another Campaign
          </button>
        </Card>
      )}
    </div>
  );
}
