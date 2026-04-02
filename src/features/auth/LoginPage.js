import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ACCENT = "#4ADE80";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const result = login(username.trim(), password);
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#1e293b",
          borderRadius: 16,
          padding: "40px 32px 32px",
          boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
          border: "1px solid #334155",
          animation: shake ? "shake 0.5s ease" : undefined,
        }}
      >
        {/* Logo / Branding */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{fontWeight:900,fontSize:32,letterSpacing:-1,marginBottom:16}}>
            <span style={{color:"#8fbf3b"}}>Gym</span><span style={{color:"#f1f5f9"}}>Kit</span>
          </div>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
            Sign in to your account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Username / Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username or email"
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: 14,
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 8,
                color: "#f1f5f9",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = ACCENT)}
              onBlur={(e) => (e.target.style.borderColor = "#334155")}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Password / PIN
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password or PIN"
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: 14,
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 8,
                color: "#f1f5f9",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = ACCENT)}
              onBlur={(e) => (e.target.style.borderColor = "#334155")}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#7f1d1d",
                color: "#fca5a5",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px 0",
              fontSize: 15,
              fontWeight: 700,
              background: ACCENT,
              color: "#0f172a",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.target.style.opacity = "1")}
          >
            Sign In
          </button>
        </form>

        {/* Demo accounts */}
        <div
          style={{
            marginTop: 28,
            padding: "16px 0 0",
            borderTop: "1px solid #334155",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            Demo Accounts
          </p>
          {[
            { role: "Super Admin", creds: "superadmin / gymkit2026", color: "#ef4444", note: "All locations" },
            { role: "Gym Admin", creds: "hunter / hybrid123", color: "#f59e0b", note: "Hybrid Fitness" },
            { role: "Coach", creds: "coach / coach123", color: "#3b82f6", note: "Hybrid Fitness" },
            { role: "Client", creds: "sarah@example.com / 1234", color: ACCENT, note: "Client portal" },
          ].map((d) => (
            <div
              key={d.role}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 0",
                fontSize: 12,
                color: "#94a3b8",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  background: d.color + "22",
                  color: d.color,
                  minWidth: 48,
                  textAlign: "center",
                }}
              >
                {d.role}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 11, flex: 1 }}>
                {d.creds}
              </span>
              {d.note && <span style={{ fontSize: 10, color: "#475569" }}>{d.note}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
