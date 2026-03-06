import { useFigmaStore } from "../store/figmaStore";
import {
  figmaToCSS,
  cssToTailwind,
  collectFonts,
  googleFontsImport,
  generateFontFaceDeclarations,
} from "../lib/figma-to-css";
import {
  nodeToHTML,
  nodeToReact,
  nodeToStylesheet,
  nodeToHTMLWithStyleBlock,
} from "../lib/figma-to-html";
import { scanDecisionPoints } from "../lib/decision-gates";
import { DecisionPanel } from "./DecisionPanel";
import { Copy, Check, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import type { PreviewTab, ViewportPreset, BgMode } from "../store/figmaStore";

const TABS: { id: PreviewTab; label: string }[] = [
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "tailwind", label: "Tailwind" },
  { id: "react", label: "React" },
  { id: "live", label: "Live" },
];

const VIEWPORT_PRESETS: {
  id: ViewportPreset;
  label: string;
  width: number | null;
}[] = [
  { id: "mobile", label: "375", width: 375 },
  { id: "tablet", label: "768", width: 768 },
  { id: "desktop", label: "1280", width: 1280 },
  { id: "full", label: "Full", width: null },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-text-dim hover:text-text transition-colors"
      title="Copy"
    >
      {copied ? (
        <Check size={14} className="text-green-400" />
      ) : (
        <Copy size={14} />
      )}
    </button>
  );
}

function SyntaxHighlight({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const highlighted = useMemo(() => {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    if (language === "html" || language === "jsx") {
      // Escape first, then highlight on the escaped string
      const escaped = esc(code);
      return escaped
        .replace(
          /(&lt;\/?)([\w-]+)/g,
          '$1<span class="text-tag-frame">$2</span>',
        )
        .replace(
          /\b([\w-]+)(=)(&quot;)(.*?)(&quot;)/g,
          '<span class="text-tag-hug">$1</span>$2<span class="text-tag-rect">$3$4$5</span>',
        );
    }
    if (language === "css") {
      // Single-pass tokenizer for CSS
      return code.replace(
        /(\.[a-zA-Z][\w-]*)|(\{|\})|(\s*)([\w-]+)(:\s)(.+?)(;)|([^.{}\n]+)/g,
        (_, sel, brace, ws, prop, colon, val, semi, text) => {
          if (sel !== undefined) {
            return `<span class="text-tag-hug">${esc(sel)}</span>`;
          }
          if (brace !== undefined) return esc(brace);
          if (prop !== undefined) {
            return `${esc(ws)}<span class="text-tag-frame">${esc(prop)}</span>${esc(colon)}<span class="text-tag-rect">${esc(val)}</span>${esc(semi)}`;
          }
          return esc(text);
        },
      );
    }
    return esc(code);
  }, [code, language]);

  return (
    <pre className="text-xs leading-relaxed overflow-auto whitespace-pre">
      <code dangerouslySetInnerHTML={{ __html: highlighted }} />
    </pre>
  );
}

function LivePreviewToolbar() {
  const {
    zoom,
    setZoom,
    viewportPreset,
    setViewportPreset,
    bgMode,
    setBgMode,
  } = useFigmaStore();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border text-xs">
      {/* Viewport presets */}
      <div className="flex items-center gap-1">
        {VIEWPORT_PRESETS.map((vp) => (
          <button
            key={vp.id}
            onClick={() => setViewportPreset(vp.id)}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              viewportPreset === vp.id
                ? "bg-accent text-surface"
                : "text-text-dim hover:text-text"
            }`}
          >
            {vp.label}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setZoom(zoom - 25)}
          className="p-0.5 text-text-dim hover:text-text transition-colors"
          title="Zoom out"
        >
          <ZoomOut size={13} />
        </button>
        <span className="text-text-dim w-8 text-center">{zoom}%</span>
        <button
          onClick={() => setZoom(zoom + 25)}
          className="p-0.5 text-text-dim hover:text-text transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={13} />
        </button>
        <button
          onClick={() => setZoom(100)}
          className="p-0.5 text-text-dim hover:text-text transition-colors"
          title="Reset zoom"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Background mode */}
      <div className="flex items-center gap-1">
        {(["dark", "light", "checker"] as BgMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setBgMode(mode)}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              bgMode === mode
                ? "bg-accent text-surface"
                : "text-text-dim hover:text-text"
            }`}
          >
            {mode === "checker"
              ? "Alpha"
              : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function HtmlPreview() {
  const {
    selectedNode,
    rootNode,
    previewTab,
    setPreviewTab,
    zoom,
    viewportPreset,
    bgMode,
    decisions,
    decisionPoints,
    setDecisionPoints,
    imageUrlMap,
  } = useFigmaStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isRoot = selectedNode?.id === rootNode?.id;

  // Scan for decision points when selected node changes (pass imageUrlMap for message context)
  useEffect(() => {
    if (selectedNode) {
      const points = scanDecisionPoints(selectedNode, imageUrlMap);
      setDecisionPoints(points);
    } else {
      setDecisionPoints([]);
    }
  }, [selectedNode, setDecisionPoints, imageUrlMap]);

  const html = useMemo(() => {
    if (!selectedNode) return "";
    return nodeToHTML(
      selectedNode,
      0,
      true,
      undefined,
      undefined,
      decisions,
      imageUrlMap,
    );
  }, [selectedNode, decisions, imageUrlMap]);

  const cssText = useMemo(() => {
    if (!selectedNode) return "";
    return nodeToStylesheet(selectedNode, undefined, decisions, imageUrlMap);
  }, [selectedNode, decisions, imageUrlMap]);

  const tailwindClasses = useMemo(() => {
    if (!selectedNode) return [];
    const cssProps = figmaToCSS(
      selectedNode,
      undefined,
      isRoot,
      undefined,
      imageUrlMap,
    );
    return cssToTailwind(cssProps);
  }, [selectedNode, isRoot, decisions, imageUrlMap]);

  const reactCode = useMemo(() => {
    if (!selectedNode) return "";
    return nodeToReact(selectedNode, decisions, imageUrlMap);
  }, [selectedNode, decisions, imageUrlMap]);

  const fontFaceCSS = useMemo(() => {
    return generateFontFaceDeclarations(decisionPoints, decisions);
  }, [decisionPoints, decisions]);

  const livePreview = useMemo(() => {
    if (!selectedNode) return { html: "", css: "", fontImport: "" };
    const result = nodeToHTMLWithStyleBlock(
      selectedNode,
      decisions,
      imageUrlMap,
    );
    const fonts = collectFonts(selectedNode);
    const fontImport = googleFontsImport(fonts);
    return { ...result, fontImport };
  }, [selectedNode, decisions, imageUrlMap]);

  const bgStyles: Record<BgMode, string> = {
    dark: "background: #1e1e2e; color: #cdd6f4;",
    light: "background: #ffffff; color: #1e1e2e;",
    checker:
      "background: repeating-conic-gradient(#808080 0% 25%, #a0a0a0 0% 50%) 0 0 / 16px 16px; color: #1e1e2e;",
  };

  // Update iframe content
  useEffect(() => {
    if (previewTab === "live" && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`<!DOCTYPE html>
<html>
<head>
  <style>${livePreview.fontImport ? `\n    ${livePreview.fontImport}\n  ` : ""}
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      ${bgStyles[bgMode]}
    }
    img { max-width: 100%; display: block; }
    h1, h2, h3, h4, h5, h6 { margin: 0; }
    p { margin: 0; }
  </style>${fontFaceCSS ? `\n  <style>\n${fontFaceCSS}\n  </style>` : ""}
  <style>
${livePreview.css}
  </style>
</head>
<body>${livePreview.html}</body>
</html>`);
        doc.close();
      }
    }
  }, [previewTab, livePreview, bgMode, fontFaceCSS]);

  if (!selectedNode) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-sm">
        Select a node to preview
      </div>
    );
  }

  const viewportWidth = VIEWPORT_PRESETS.find(
    (v) => v.id === viewportPreset,
  )?.width;

  let content: string;
  let language: string;
  switch (previewTab) {
    case "html":
      content = html;
      language = "html";
      break;
    case "css":
      content = fontFaceCSS ? fontFaceCSS + "\n\n" + cssText : cssText;
      language = "css";
      break;
    case "tailwind":
      content =
        tailwindClasses.length > 0
          ? `class="${tailwindClasses.join(" ")}"\n\n/* Individual classes: */\n${tailwindClasses.map((c) => `  ${c}`).join("\n")}`
          : "/* No Tailwind mappings */";
      language = "text";
      break;
    case "react":
      content = fontFaceCSS
        ? `/* Font declarations needed — add to your global CSS:\n${fontFaceCSS}\n*/\n\n${reactCode}`
        : reactCode;
      language = "jsx";
      break;
    default:
      content = "";
      language = "html";
  }

  const copyText =
    previewTab === "live"
      ? `<style>\n${livePreview.css}\n</style>\n${livePreview.html}`
      : previewTab === "react"
        ? reactCode
        : content;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPreviewTab(tab.id)}
            className={`px-3 py-2 text-xs transition-colors ${
              previewTab === tab.id
                ? "text-accent border-b-2 border-accent"
                : "text-text-dim hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto pr-2">
          <CopyButton text={copyText} />
        </div>
      </div>
      <DecisionPanel />
      {previewTab === "live" && <LivePreviewToolbar />}
      <div className="flex-1 overflow-auto p-3">
        {previewTab === "live" ? (
          <div
            className="mx-auto transition-all"
            style={{
              width: viewportWidth ? `${viewportWidth}px` : "100%",
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top left",
            }}
          >
            <iframe
              ref={iframeRef}
              className="w-full border border-border rounded"
              style={{ height: `${Math.max(300, 600 * (100 / zoom))}px` }}
              title="Live Preview"
              sandbox="allow-same-origin"
            />
          </div>
        ) : (
          <SyntaxHighlight code={content} language={language} />
        )}
      </div>
    </div>
  );
}
