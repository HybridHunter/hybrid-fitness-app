import { createContext, useContext } from "react";
export const DARK = { green:"#8fbf3b", blue:"#063461", dark:"#0d1117", darker:"#080c12", card:"#161b22", border:"#21262d", text:"#e6edf3", muted:"#8b949e", dim:"#484f58", white:"#fff", red:"#ef4444", orange:"#f59e0b", purple:"#a855f7", accent:"#8fbf3b" };
export const LIGHT = { green:"#6a9a2d", blue:"#063461", dark:"#f6f8fa", darker:"#ffffff", card:"#ffffff", border:"#d0d7de", text:"#1f2328", muted:"#656d76", dim:"#8b949e", white:"#fff", red:"#cf222e", orange:"#d4820c", purple:"#8250df", accent:"#6a9a2d" };
export const ThemeCtx = createContext(DARK);
export const useTheme = ()=>useContext(ThemeCtx);
