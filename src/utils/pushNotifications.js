/**
 * Push Notifications utility
 * Uses the browser Notification API for local notifications.
 */

export function requestPermission() {
  if (!("Notification" in window)) return Promise.resolve("unsupported");
  return Notification.requestPermission();
}

export function getPermissionStatus() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // "granted" | "denied" | "default"
}

export function sendLocalNotification(title, options = {}) {
  if (!("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  try {
    return new Notification(title, {
      icon: getBrandingIcon(),
      badge: getBrandingIcon(),
      ...options,
    });
  } catch (e) {
    // Fallback: some browsers restrict Notification constructor
    return null;
  }
}

function getBrandingIcon() {
  try {
    const b = JSON.parse(localStorage.getItem("hf_branding") || "{}");
    return b.pwaIcon || b.logo || "/icon-192.png";
  } catch {
    return "/icon-192.png";
  }
}

/**
 * Get notification preferences from localStorage.
 * Returns object with boolean flags for each event type.
 */
export function getNotificationPrefs() {
  try {
    return JSON.parse(localStorage.getItem("hf_notification_prefs") || '{"checkin":true,"payment":true,"message":true,"booking":true}');
  } catch {
    return { checkin: true, payment: true, message: true, booking: true };
  }
}

export function setNotificationPrefs(prefs) {
  localStorage.setItem("hf_notification_prefs", JSON.stringify(prefs));
}
