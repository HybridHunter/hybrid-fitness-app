import { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useMembers } from "../../hooks/useMembers";
import ProfileAvatar from "../../components/shared/ProfileAvatar";

export default function EditProfileModal({ isOpen, onClose }) {
  const B = useTheme();
  const { currentUser, isClient, updateUser } = useAuth();
  const { getMember, updateMember } = useMembers();

  const member = isClient && currentUser?.memberId ? getMember(currentUser.memberId) : null;

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(currentUser?.displayName || "");
    setEmail(currentUser?.email || "");
    setPhone(currentUser?.phone || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    if (member) {
      setPhone(member.phone || "");
      setEmail(member.email || "");
      setPin(member.pin || "");
      setStreet(member.address?.street || "");
      setCity(member.address?.city || "");
      setState(member.address?.state || "");
      setZip(member.address?.zip || "");
      setNotes(member.notes || "");
    }
    setToast(null);
  }, [isOpen, currentUser, member]);

  if (!isOpen || !currentUser) return null;

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleSave = () => {
    setSaving(true);

    // Validate password change if attempted
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        showToast(isClient ? "Enter your current PIN" : "Enter your current password", "error");
        setSaving(false);
        return;
      }
      // P3: client sessions have no `password` — their credential is the member's PIN
      const currentSecret = isClient ? (member?.pin || "") : currentUser.password;
      if (currentPassword !== currentSecret) {
        showToast(isClient ? "Current PIN is incorrect" : "Current password is incorrect", "error");
        setSaving(false);
        return;
      }
      if (isClient && !/^\d{4}$/.test(newPassword)) {
        showToast("New PIN must be exactly 4 digits", "error");
        setSaving(false);
        return;
      }
      if (!isClient && newPassword.length < 4) {
        showToast("New password must be at least 4 characters", "error");
        setSaving(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast(isClient ? "New PINs do not match" : "New passwords do not match", "error");
        setSaving(false);
        return;
      }
    }

    // Validate PIN for clients
    if (isClient && pin && !/^\d{4}$/.test(pin)) {
      showToast("PIN must be exactly 4 digits", "error");
      setSaving(false);
      return;
    }

    // Update staff user record
    const userUpdates = {};
    if (displayName && displayName !== currentUser.displayName) userUpdates.displayName = displayName;
    if (!isClient && email !== (currentUser.email || "")) userUpdates.email = email;
    if (!isClient && phone !== (currentUser.phone || "")) userUpdates.phone = phone;
    // P3: client credentials live on the member record (pin), not in hf_users
    if (newPassword && !isClient) userUpdates.password = newPassword;
    if (Object.keys(userUpdates).length > 0) {
      updateUser(currentUser.id, userUpdates);
    }

    // Update client member record
    if (isClient && member) {
      const memberUpdates = {};
      if (phone !== (member.phone || "")) memberUpdates.phone = phone;
      if (email !== (member.email || "")) memberUpdates.email = email;
      if (pin !== (member.pin || "")) memberUpdates.pin = pin;
      if (newPassword) memberUpdates.pin = newPassword; // P3: PIN change via the password fields
      if (notes !== (member.notes || "")) memberUpdates.notes = notes;
      if (displayName && displayName !== `${member.firstName} ${member.lastName}`) {
        const parts = displayName.trim().split(/\s+/);
        memberUpdates.firstName = parts[0] || member.firstName;
        memberUpdates.lastName = parts.slice(1).join(" ") || member.lastName;
      }
      const addr = member.address || {};
      if (street !== (addr.street || "") || city !== (addr.city || "") || state !== (addr.state || "") || zip !== (addr.zip || "")) {
        memberUpdates.address = { ...addr, street, city, state, zip };
      }
      if (Object.keys(memberUpdates).length > 0) {
        updateMember(member.id, memberUpdates);
      }
    }

    setSaving(false);
    showToast("Profile updated!");
    setTimeout(() => onClose(), 1200);
  };

  // Styles
  const overlay = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.55)", display: "flex",
    alignItems: "center", justifyContent: "center",
    padding: 16,
  };
  const modal = {
    background: B.card, borderRadius: 16, width: "100%", maxWidth: 480,
    maxHeight: "85vh", overflowY: "auto", padding: "24px 20px",
    border: `1px solid ${B.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    position: "relative",
  };
  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: `1px solid ${B.border}`, background: B.darker || B.dark,
    color: B.text, fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: B.muted, textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: 4, display: "block",
  };
  const fieldWrap = { marginBottom: 14 };
  const readOnlyField = {
    ...inputStyle, opacity: 0.6, cursor: "default",
  };
  const sectionLabel = {
    fontSize: 14, fontWeight: 700, color: B.text, margin: "18px 0 10px",
    paddingBottom: 6, borderBottom: `1px solid ${B.border}`,
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: B.text }}>Edit Profile</h2>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: B.muted, fontSize: 22,
              cursor: "pointer", padding: "4px 8px", lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Profile Photo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
          <ProfileAvatar
            photo={isClient && member ? member.photo : currentUser.photo}
            name={displayName || currentUser.displayName}
            size={64}
            editable
            onPhotoChange={(url) => {
              if (isClient && member) {
                updateMember(member.id, { photo: url });
              } else {
                updateUser(currentUser.id, { photo: url });
              }
            }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: B.text }}>Profile Photo</div>
            <div style={{ fontSize: 12, color: B.dim }}>Click the avatar to change</div>
          </div>
        </div>

        {/* Username + Role (read-only for admin/coach) */}
        {!isClient && (
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Username</label>
              <input style={readOnlyField} value={currentUser.username || ""} readOnly />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Role</label>
              <input style={readOnlyField} value={currentUser.role || ""} readOnly />
            </div>
          </div>
        )}

        {/* Display Name */}
        <div style={fieldWrap}>
          <label style={labelStyle}>Display Name</label>
          <input style={inputStyle} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
        </div>

        {/* Staff email + phone */}
        {!isClient && (
          <>
            <div style={fieldWrap}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="555-0100" />
            </div>
          </>
        )}

        {/* Client-specific fields */}
        {isClient && member && (
          <>
            <div style={sectionLabel}>Contact Info</div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="555-0100" />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>PIN (4-digit)</label>
              <input
                style={inputStyle}
                value={pin}
                onChange={e => { if (/^\d{0,4}$/.test(e.target.value)) setPin(e.target.value); }}
                placeholder="1234"
                maxLength={4}
                inputMode="numeric"
              />
            </div>

            <div style={sectionLabel}>Address</div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Street</label>
              <input style={inputStyle} value={street} onChange={e => setStreet(e.target.value)} placeholder="123 Main St" />
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>City</label>
                <input style={inputStyle} value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>State</label>
                <input style={inputStyle} value={state} onChange={e => setState(e.target.value)} placeholder="ST" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>ZIP</label>
                <input style={inputStyle} value={zip} onChange={e => setZip(e.target.value)} placeholder="00000" />
              </div>
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Notes</label>
              <textarea
                style={{ ...inputStyle, minHeight: 64, resize: "vertical", fontFamily: "inherit" }}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any notes about your goals, injuries, etc."
              />
            </div>
          </>
        )}

        {/* Password / PIN Change */}
        <div style={sectionLabel}>{isClient ? "Change PIN" : "Change Password"}</div>
        <div style={fieldWrap}>
          <label style={labelStyle}>{isClient ? "Current PIN" : "Current Password"}</label>
          <input style={inputStyle} type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder={isClient ? "Enter current PIN" : "Enter current password"} />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle}>{isClient ? "New PIN (4-digit)" : "New Password"}</label>
          <input style={inputStyle} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={isClient ? "Enter new 4-digit PIN" : "Enter new password"} />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle}>{isClient ? "Confirm New PIN" : "Confirm New Password"}</label>
          <input style={inputStyle} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={isClient ? "Confirm new PIN" : "Confirm new password"} />
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            padding: "10px 16px", borderRadius: 10, marginBottom: 12, fontSize: 13, fontWeight: 600,
            background: toast.type === "error" ? `${B.red}20` : `${B.accent}20`,
            color: toast.type === "error" ? B.red : B.accent,
            border: `1px solid ${toast.type === "error" ? B.red + "40" : B.accent + "40"}`,
          }}>
            {toast.msg}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 10, border: `1px solid ${B.border}`,
              background: "transparent", color: B.muted, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 10, border: "none",
              background: B.accent, color: B.darker || "#111", fontSize: 14,
              fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
