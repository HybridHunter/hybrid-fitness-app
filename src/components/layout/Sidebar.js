import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useUnreadCount } from "../../features/messaging/MessagingView";
import EditProfileModal from "../../features/auth/EditProfileModal";

const NAV_GROUPS = [
  {
    label: "Coaching",
    icon: "\uD83C\uDFCB\uFE0F",
    adminOnly: false,
    items: [
      { label: "Coaching Dashboard", path: "/coaching", icon: "\uD83D\uDCCA" },
      { label: "Build", path: "/build", icon: "\uD83D\uDD28" },
      { label: "Workouts", path: "/workouts", icon: "\uD83D\uDCCB" },
      { label: "Programs", path: "/programs", icon: "\uD83D\uDCC1" },
      { label: "Library", path: "/library", icon: "\uD83D\uDCDA" },
      { label: "Progression Engine", path: "/matrix", icon: "\u2699\uFE0F" },
      { label: "Session View", path: "/command", icon: "\uD83D\uDCFA" },
      { label: "Stations", path: "/stations", icon: "\uD83D\uDCF1" },
    ],
  },
  {
    label: "Community",
    icon: "\uD83D\uDC65",
    adminOnly: false,
    items: [
      { label: "Feed", path: "/community", icon: "\uD83D\uDCAC" },
      { label: "Classroom", path: "/classroom", icon: "\uD83C\uDF93" },
      { label: "Events", path: "/events", icon: "\uD83C\uDF89" },
      { label: "Resources", path: "/resources", icon: "\uD83D\uDCC2" },
    ],
  },
  {
    label: "Clients",
    icon: "\uD83D\uDC64",
    adminOnly: false,
    items: [
      { label: "Clients", path: "/members", icon: "\uD83D\uDC65" },
      { label: "Assessments", path: "/assessments", icon: "\uD83D\uDCCB" },
      { label: "Gamification", path: "/gamification", icon: "\uD83C\uDFC6" },
    ],
  },
  {
    label: "Operations",
    icon: "\u2699\uFE0F",
    adminOnly: false,
    items: [
      { label: "Schedule", path: "/schedule", icon: "\uD83D\uDCC5" },
      { label: "Check-in", path: "/checkin", icon: "\u2705" },
      { label: "Waivers", path: "/waivers", icon: "\uD83D\uDCDD" },
    ],
  },
  {
    label: "Communication",
    icon: "\uD83D\uDCE8",
    adminOnly: false,
    items: [
      { label: "Messages", path: "/messages", icon: "\uD83D\uDCE9" },
    ],
  },
  {
    label: "Business",
    icon: "\uD83D\uDCB0",
    adminOnly: true,
    items: [
      { label: "Business Dashboard", path: "/business", icon: "\uD83D\uDCC8" },
      { label: "Billing", path: "/billing", icon: "\uD83D\uDCB3" },
      { label: "Analytics", path: "/analytics", icon: "\uD83D\uDCC9" },
    ],
  },
  {
    label: "Admin",
    icon: "\uD83D\uDD12",
    adminOnly: true,
    items: [
      { label: "Settings", path: "/settings", icon: "\u2699\uFE0F" },
      { label: "Automations", path: "/automations", icon: "\u26A1" },
      { label: "Integrations", path: "/integrations", icon: "\uD83D\uDD17" },
      { label: "Data Migration", path: "/migration", icon: "\uD83D\uDCE5" },
      { label: "Super Admin", path: "/super-admin", icon: "\uD83D\uDC51" },
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
  // All groups start collapsed
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    const initial = {};
    NAV_GROUPS.forEach(g => { initial[g.label] = true; });
    return initial;
  });
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  if (isClient) return null;

  const visibleGroups = NAV_GROUPS.filter((group) => {
    if (group.adminOnly && !isAdmin) return false;
    return true;
  });

  const showFull = mobile || !collapsed;
  const width = mobile ? 260 : collapsed ? 56 : 220;

  const toggleGroup = (label) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

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

  // Check if any item in a group is active
  const isGroupActive = (group) => group.items.some(item => location.pathname === item.path);

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
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px", minHeight: 48 }}>
        {!mobile && (
          <button onClick={onToggle} style={{ background: "none", border: "none", color: B.muted, fontSize: 18, cursor: "pointer", padding: "12px 8px" }} aria-label="Toggle sidebar">
            {collapsed ? "\u25B6" : "\u25C0"}
          </button>
        )}
        {mobile && (
          <>
            <div style={{ padding: "12px 8px", fontSize: 14, fontWeight: 700, color: B.text, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#8fbf3b" }}>Gym</span>Kit
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: B.muted, fontSize: 20, cursor: "pointer", padding: "12px 8px", lineHeight: 1 }} aria-label="Close sidebar">
              ✕
            </button>
          </>
        )}
      </div>

      {/* Nav groups */}
      <div style={{ flex: 1, padding: "4px 0" }}>
        {visibleGroups.map((group) => {
          const isCollapsed = collapsedGroups[group.label];
          const groupActive = isGroupActive(group);

          return (
            <div key={group.label} style={{ marginBottom: 2 }}>
              {/* Group header — clickable to collapse */}
              <button
                onClick={() => { if (showFull) toggleGroup(group.label); else handleNavClick(group.items[0].path); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: showFull ? "8px 12px" : "8px",
                  background: groupActive && isCollapsed ? `${B.accent}08` : "transparent",
                  border: "none",
                  cursor: "pointer",
                  gap: 8,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${B.border}44`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = groupActive && isCollapsed ? `${B.accent}08` : "transparent"; }}
              >
                <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: "center" }}>{group.icon}</span>
                {showFull && (
                  <>
                    <span style={{
                      flex: 1,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      color: groupActive ? B.accent : B.muted,
                      textAlign: "left",
                    }}>
                      {group.label}
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: B.dim,
                      transition: "transform 0.2s",
                      transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                    }}>
                      ▾
                    </span>
                  </>
                )}
              </button>

              {/* Group items — collapsible */}
              {showFull && !isCollapsed && (
                <div style={{
                  overflow: "hidden",
                  transition: "max-height 0.2s ease",
                }}>
                  {group.items.map((item) => {
                    const active = location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNavClick(item.path)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          width: "100%",
                          textAlign: "left",
                          background: active ? `${B.accent}15` : "transparent",
                          color: active ? B.accent : B.text,
                          border: "none",
                          borderLeft: active ? `3px solid ${B.accent}` : "3px solid transparent",
                          padding: "7px 12px 7px 20px",
                          fontSize: 13,
                          fontWeight: active ? 600 : 400,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          transition: "all 0.15s",
                          borderRadius: "0 6px 6px 0",
                          marginRight: 6,
                        }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = `${B.border}55`; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                      >
                        <span style={{ fontSize: 13, flexShrink: 0, width: 18, textAlign: "center", opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.path === "/messages" && unreadCount > 0 && (
                          <span style={{
                            minWidth: 18, height: 18, borderRadius: 9,
                            background: B.accent, color: "#fff",
                            fontSize: 10, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: "0 5px",
                          }}>
                            {unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Collapsed sidebar — nothing here, group icon button above is enough */}
            </div>
          );
        })}
      </div>

      {/* Help & Feedback standalone link */}
      {showFull && (
        <div style={{ padding: "4px 6px 4px 0" }}>
          <button
            onClick={() => handleNavClick("/feedback")}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              background: location.pathname === "/feedback" ? `${B.accent}15` : "transparent",
              color: location.pathname === "/feedback" ? B.accent : B.muted,
              border: "none",
              borderLeft: location.pathname === "/feedback" ? `3px solid ${B.accent}` : "3px solid transparent",
              padding: "8px 12px 8px 12px", fontSize: 13,
              fontWeight: location.pathname === "/feedback" ? 600 : 400,
              cursor: "pointer", borderRadius: "0 6px 6px 0", transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (location.pathname !== "/feedback") e.currentTarget.style.background = `${B.border}55`; }}
            onMouseLeave={e => { if (location.pathname !== "/feedback") e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ fontSize: 13, flexShrink: 0, width: 18, textAlign: "center", opacity: location.pathname === "/feedback" ? 1 : 0.6 }}>{"\u2753"}</span>
            <span>Help & Feedback</span>
          </button>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: B.border, margin: "0 12px" }} />

      {/* User info at bottom */}
      {currentUser && (
        <div style={{
          padding: showFull ? "14px 12px" : "14px 4px",
          display: "flex",
          alignItems: showFull ? "center" : "center",
          flexDirection: showFull ? "row" : "column",
          gap: showFull ? 10 : 6,
        }}>
          <div
            onClick={() => setEditProfileOpen(true)}
            title="Edit Profile"
            style={{
              display: "flex", alignItems: showFull ? "center" : "center",
              flexDirection: showFull ? "row" : "column",
              gap: showFull ? 10 : 4, cursor: "pointer",
              flex: showFull ? 1 : undefined, minWidth: 0,
              borderRadius: 8, padding: showFull ? "4px 6px" : "4px",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${B.border}44`; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `${roleColor}22`, color: roleColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              border: `1.5px solid ${roleColor}44`,
            }}>
              {initials}
            </div>
            {showFull && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: B.text,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {currentUser.displayName}
                </div>
                <div style={{
                  display: "inline-block",
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 0.5, color: roleColor,
                  background: `${roleColor}15`, padding: "1px 6px",
                  borderRadius: 4, marginTop: 2,
                }}>
                  {currentUser.role}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            style={{
              background: `${B.red}15`,
              border: `1px solid ${B.red}30`,
              color: B.red,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              padding: showFull ? "5px 10px" : "5px 8px",
              borderRadius: 6,
              flexShrink: 0,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = B.red; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${B.red}15`; e.currentTarget.style.color = B.red; }}
          >
            {showFull ? "Sign Out" : "\u23FB"}
          </button>
        </div>
      )}

      <EditProfileModal isOpen={editProfileOpen} onClose={() => setEditProfileOpen(false)} />
    </nav>
  );
}
