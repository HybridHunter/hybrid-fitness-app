import { useState, useEffect, useCallback } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { useTheme } from "../../context/ThemeContext";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < breakpoint
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

export default function Shell({ theme, onToggleTheme, children, style }) {
  const B = useTheme();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // Close sidebar when switching to mobile
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: B.darker,
        ...style,
        color: B.text,
      }}
    >
      <Header
        theme={theme}
        onToggleTheme={onToggleTheme}
        onToggleSidebar={toggleSidebar}
        isMobile={isMobile}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Mobile backdrop */}
        {isMobile && sidebarOpen && (
          <div
            onClick={closeSidebar}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 998,
            }}
          />
        )}

        {/* Sidebar: inline on desktop, overlay on mobile */}
        {(sidebarOpen || !isMobile) && (
          <Sidebar
            collapsed={!sidebarOpen && !isMobile}
            mobile={isMobile}
            open={sidebarOpen}
            onToggle={toggleSidebar}
            onClose={closeSidebar}
          />
        )}

        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? 12 : 24,
            width: isMobile ? "100%" : undefined,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
