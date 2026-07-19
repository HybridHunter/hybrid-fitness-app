import './styles.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Lock the app scale on mobile: iOS Safari ignores user-scalable=no, so block
// pinch (gesture events) and double-tap zoom explicitly.
["gesturestart", "gesturechange", "gestureend"].forEach(evt =>
  document.addEventListener(evt, e => e.preventDefault(), { passive: false })
);
let lastTouchEnd = 0;
document.addEventListener("touchend", (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300 && e.touches.length === 0 && !["INPUT","TEXTAREA","SELECT","BUTTON"].includes(e.target.tagName)) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
