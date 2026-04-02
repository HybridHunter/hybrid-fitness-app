import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useUnreadCount } from "../../features/messaging/MessagingView";

const NAV_GROUPS = [
  {
    label: "Coaching",
    adminOnly: false,
    items: [
      { label: "Coaching", path: "/" },
      { label: "Build", path: "/build" },
      { label: "Workouts", path: "/workouts" },
      { label: "Programs", path: "/programs" },
      { label: "Library", path: "/library" },
      { label: "Movement Matrix", path: "/matrix" },
      { label: "Command View", path: "/command" },
      { label: "Stations", path: "/stations" },
    ],
  },
  {
    label: "Community",
    adminOnly: false,
    items: [
      { label: "Feed", path: "/community" },
      { label: "Classroom", path: "/classroom" },
      { label: "Events", path: "/events" },
      { label: "Resources", path: "/resources" },
    ],
  },
  {
    label: "Members",
    adminOnly: false,
    items: [
      { label: "Members", path: "/members" },
      { label: "Assessments", path: "/assessments" },
      { label: "Gamification", path: "/gamification" },
    ],
  },
  {
    label: "Operations",
    adminOnly: false,
    items: [
      { label: "Schedule", path: "/schedule" },
      { label: "Check-in", path: "/checkin" },
      { label: "Waivers", path: "/waivers" },
    ],
  },
  {
    label: "Communication",
    adminOnly: false,
    items: [
      { label: "Messages", path: "/messages" },
    ],
  },
  {
    label: "Business",
    adminOnly: true,
    items: [
      { label: "Business Dashboard", path: "/business" },
      { label: "Billing", path: "/billing" },
      { label: "Analytics", path: "/analytics" },
      { label: "Content", path: "/content" },
      { label: "Shop", path: "/shop" },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      { label: "Settings", path: "/settings" },
      { label: "Automations", path: "/automations" },
    ],
  },
];

const ROLE_COLORS = {
  admin: "#f59e0b",
  coach: "#3b82f6",
  client: "#4ADE80",
};

export default function Sidebar({ collapsed, mobile, open, onToggle, onClose }) {
  const B = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();
  const { currentUser, isClient, isCoach, isAdmin, logout } = useAuth();

  // Clients don't see the sidebar at all
  if (isClient) return null;

  // Filter nav groups based on role
  const visibleGroups = NAV_GROUPS.filter((group) => {
    if (group.adminOnly && !isAdmin) return false;
    return true;
  });

  // On mobile: always show full labels (not abbreviated)
  const showFull = mobile || !collapsed;
  const width = mobile ? 260 : collapsed ? 56 : 200;

  const handleNavClick = (path) => {
    navigate(path);
    if (mobile) onClose();
  };

  const mobileStyles = mobile
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 999,
        height: "100vh",
        boxShadow: "4px 0 24px rgba(0,0,0,0.4)",
        transform: open ? "translateX(0)" : "translateX(-100%)",
      }
    : {};

  const initials = currentUser?.displayName
    ? currentUser.displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  const roleColor = ROLE_COLORS[currentUser?.role] || B.muted;

  return (
    <nav
      style={{
        width,
        minWidth: width,
        height: "100%",
        background: B.dark,
        borderRight: `1px solid ${B.border}`,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease, transform 0.2s ease",
        overflowY: "auto",
        overflowX: "hidden",
        ...mobileStyles,
      }}
    >
      {/* Top bar: hamburger toggle on desktop, close button on mobile */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px" }}>
        {!mobile && (
          <button
            onClick={onToggle}
            style={{
              background: "none",
              border: "none",
              color: B.text,
              fontSize: 20,
              cursor: "pointer",
              padding: "12px 8px",
              textAlign: "left",
            }}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
        )}
        {mobile && (
          <>
            <div style={{ padding: "12px 8px", fontSize: 13, fontWeight: 700, color: B.text }}>Menu</div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: B.text,
                fontSize: 22,
                cursor: "pointer",
                padding: "12px 8px",
                lineHeight: 1,
              }}
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </>
        )}
      </div>

      {/* Nav groups */}
      <div style={{ flex: 1 }}>
        {visibleGroups.map((group) => (
          <div key={group.label} style={{ marginBottom: 8 }}>
            <div
              style={{
                padding: showFull ? "8px 16px 4px" : "8px 8px 4px",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
                color: B.muted,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {showFull ? group.label : group.label.slice(0, 2)}
            </div>

            {group.items.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    textAlign: "left",
                    background: active ? `${B.accent}22` : "transparent",
                    color: active ? B.accent : B.text,
                    border: "none",
                    borderLeft: active ? `3px solid ${B.accent}` : "3px solid transparent",
                    padding: showFull ? "6px 16px" : "6px 8px",
                    fontSize: 13,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = `${B.border}`;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span>{showFull ? item.label : item.label.slice(0, 2)}</span>
                  {item.path === "/messages" && unreadCount > 0 && (
                    <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: B.accent, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", marginLeft: 6 }}>{unreadCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User info at bottom */}
      {currentUser && showFull && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${B.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: roleColor + "33",
              color: roleColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: B.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentUser.displayName}
            </div>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: roleColor,
              }}
            >
              {currentUser.role}
            </span>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            style={{
              background: "none",
              border: "none",
              color: B.muted,
              fontSize: 16,
              cursor: "pointer",
              padding: 4,
              flexShrink: 0,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
            onMouseLeave={(e) => (e.currentTarget.style.color = B.muted)}
          >
            ⏻
          </button>
        </div>
      )}
    </nav>
  );
}
