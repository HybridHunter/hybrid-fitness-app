import Logo from "../shared/Logo";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { NotificationBell } from "../../features/notifications/NotificationCenter";

const ROLE_COLORS = {
  admin: "#f59e0b",
  coach: "#3b82f6",
  client: "#4ADE80",
};

export default function Header({ theme, onToggleTheme, onToggleSidebar, isMobile }) {
  const B = useTheme();
  const { currentUser, logout } = useAuth();

  const roleColor = ROLE_COLORS[currentUser?.role] || B.muted;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 52,
        padding: "0 16px",
        background: B.dark,
        borderBottom: `1px solid ${B.border}`,
        flexShrink: 0,
        position: "relative",
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, minWidth: 0 }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: "none",
            border: "none",
            color: B.text,
            fontSize: 20,
            cursor: "pointer",
            padding: 4,
            flexShrink: 0,
          }}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <Logo s={isMobile ? 90 : 120} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14 }}>
        {/* User info */}
        {currentUser && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isMobile && (
              <span style={{ fontSize: 13, fontWeight: 500, color: B.text }}>
                {currentUser.displayName}
              </span>
            )}
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                background: roleColor + "22",
                color: roleColor,
              }}
            >
              {currentUser.role}
            </span>
            <button
              onClick={logout}
              style={{
                background: "none",
                border: "none",
                color: B.muted,
                fontSize: 12,
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: 4,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = B.muted)}
            >
              Sign Out
            </button>
          </div>
        )}

        <NotificationBell />

        <button
          onClick={onToggleTheme}
          style={{
            background: "none",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            padding: 4,
            flexShrink: 0,
          }}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </header>
  );
}
