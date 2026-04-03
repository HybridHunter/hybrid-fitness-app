import { useRef, useState, useCallback, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";

function ToolbarButton({ label, title, onClick, active, B, style }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title || label}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
        border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600,
        background: active ? `${B.accent}33` : hovered ? `${B.border}` : "transparent",
        color: active ? B.accent : B.text,
        transition: "background .12s, color .12s",
        flexShrink: 0,
        ...style,
      }}
    >
      {label}
    </button>
  );
}

function ToolbarSeparator({ B }) {
  return <div style={{ width: 1, height: 20, background: B.border, margin: "0 4px", flexShrink: 0 }} />;
}

function HeadingDropdown({ B }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const options = [
    { label: "Paragraph", tag: "p" },
    { label: "Heading 1", tag: "h1" },
    { label: "Heading 2", tag: "h2" },
    { label: "Heading 3", tag: "h3" },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <ToolbarButton label="H" title="Heading" onClick={() => setOpen(!open)} B={B} style={{ width: 36, fontSize: 13 }} />
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 10,
          background: B.card, border: `1px solid ${B.border}`, borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)", overflow: "hidden", minWidth: 130,
        }}>
          {options.map((opt) => (
            <div
              key={opt.tag}
              onMouseDown={(e) => {
                e.preventDefault();
                document.execCommand("formatBlock", false, opt.tag);
                setOpen(false);
              }}
              style={{
                padding: "8px 14px", cursor: "pointer", fontSize: 13, color: B.text,
                fontWeight: opt.tag === "p" ? 400 : 700,
                fontSize: opt.tag === "h1" ? 18 : opt.tag === "h2" ? 16 : opt.tag === "h3" ? 14 : 13,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = `${B.border}66`}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RichTextEditor({ value, onChange, placeholder }) {
  const B = useTheme();
  const editorRef = useRef(null);
  const [preview, setPreview] = useState(false);

  const exec = useCallback((cmd, val) => {
    document.execCommand(cmd, false, val || null);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handleLink = useCallback(() => {
    const url = prompt("Enter URL:");
    if (url) exec("createLink", url);
  }, [exec]);

  const handleImage = useCallback(() => {
    const url = prompt("Enter image URL:");
    if (url) exec("insertImage", url);
  }, [exec]);

  // Sync value from outside into the contentEditable
  useEffect(() => {
    if (editorRef.current && !editorRef.current.matches(":focus")) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }
  }, [value]);

  const toolbarBg = B.dark;
  const editorBg = B.card;

  return (
    <div style={{ border: `1px solid ${B.border}`, borderRadius: 10, overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ background: toolbarBg, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4, borderBottom: `1px solid ${B.border}` }}>
        {/* Row 1 */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <ToolbarButton label="B" title="Bold" onClick={() => exec("bold")} B={B} style={{ fontWeight: 800 }} />
          <ToolbarButton label="I" title="Italic" onClick={() => exec("italic")} B={B} style={{ fontStyle: "italic" }} />
          <ToolbarButton label="U" title="Underline" onClick={() => exec("underline")} B={B} style={{ textDecoration: "underline" }} />
          <ToolbarButton label="S" title="Strikethrough" onClick={() => exec("strikeThrough")} B={B} style={{ textDecoration: "line-through" }} />
          <ToolbarSeparator B={B} />
          <HeadingDropdown B={B} />
          <ToolbarSeparator B={B} />
          <ToolbarButton label={"\u2190"} title="Align left" onClick={() => exec("justifyLeft")} B={B} />
          <ToolbarButton label={"\u2194"} title="Align center" onClick={() => exec("justifyCenter")} B={B} />
          <ToolbarButton label={"\u2192"} title="Align right" onClick={() => exec("justifyRight")} B={B} />
          <ToolbarButton label={"\u2195"} title="Justify" onClick={() => exec("justifyFull")} B={B} />
          <ToolbarSeparator B={B} />
          <ToolbarButton label={"\u2022"} title="Bullet list" onClick={() => exec("insertUnorderedList")} B={B} />
          <ToolbarButton label="1." title="Numbered list" onClick={() => exec("insertOrderedList")} B={B} style={{ fontSize: 12 }} />
          <ToolbarSeparator B={B} />
          <ToolbarButton label={"\uD83D\uDD17"} title="Insert link" onClick={handleLink} B={B} />
        </div>
        {/* Row 2 */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <ToolbarButton label={"\u21A9"} title="Undo" onClick={() => exec("undo")} B={B} />
          <ToolbarButton label={"\u21AA"} title="Redo" onClick={() => exec("redo")} B={B} />
          <ToolbarSeparator B={B} />
          <ToolbarButton label={"\uD83D\uDDBC"} title="Insert image (URL)" onClick={handleImage} B={B} />
          <ToolbarButton label="<>" title="Code block" onClick={() => exec("formatBlock", "pre")} B={B} style={{ fontSize: 11, fontFamily: "monospace" }} />
          <ToolbarButton label={"\u201C"} title="Blockquote" onClick={() => exec("formatBlock", "blockquote")} B={B} />
          <ToolbarButton label={"\u2015"} title="Horizontal rule" onClick={() => exec("insertHorizontalRule")} B={B} />
          <ToolbarButton label="Tx" title="Clear formatting" onClick={() => exec("removeFormat")} B={B} style={{ fontSize: 12 }} />
          <div style={{ flex: 1 }} />
          <ToolbarButton
            label={preview ? "Edit" : "Preview"}
            title={preview ? "Switch to edit mode" : "Preview rendered HTML"}
            onClick={() => setPreview(!preview)}
            active={preview}
            B={B}
            style={{ width: "auto", padding: "0 10px", fontSize: 11, fontWeight: 600 }}
          />
        </div>
      </div>

      {/* Editor / Preview area */}
      {preview ? (
        <div
          style={{
            minHeight: 200, padding: "16px 14px", fontSize: 14, lineHeight: 1.7,
            color: B.text, background: editorBg, overflowY: "auto",
          }}
          dangerouslySetInnerHTML={{ __html: value || `<span style="color:${B.muted}">Nothing to preview</span>` }}
        />
      ) : (
        <div style={{ position: "relative" }}>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onBlur={handleInput}
            style={{
              minHeight: 200, padding: "16px 14px", fontSize: 14, lineHeight: 1.7,
              color: B.text, background: editorBg, outline: "none",
              overflowY: "auto", wordBreak: "break-word",
            }}
            data-placeholder={placeholder || "Start writing..."}
          />
          {(!value || value === "" || value === "<br>") && (
            <div
              style={{
                position: "absolute", top: 16, left: 14,
                color: B.muted, fontSize: 14, pointerEvents: "none", opacity: 0.6,
              }}
            >
              {placeholder || "Start writing..."}
            </div>
          )}
        </div>
      )}

      {/* Style tag for contentEditable content styling */}
      <style>{`
        [contenteditable] img { max-width: 100%; border-radius: 8px; margin: 8px 0; }
        [contenteditable] pre { background: ${B.dark}; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 13px; overflow-x: auto; }
        [contenteditable] blockquote { border-left: 3px solid ${B.accent}; padding-left: 12px; margin-left: 0; color: ${B.muted}; }
        [contenteditable] a { color: ${B.accent}; }
        [contenteditable] h1 { font-size: 24px; font-weight: 800; margin: 12px 0 8px; }
        [contenteditable] h2 { font-size: 20px; font-weight: 700; margin: 10px 0 6px; }
        [contenteditable] h3 { font-size: 17px; font-weight: 700; margin: 8px 0 4px; }
        [contenteditable] hr { border: none; border-top: 1px solid ${B.border}; margin: 12px 0; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 24px; }
      `}</style>
    </div>
  );
}
