import { useFigmaStore } from "../store/figmaStore";
import { figmaToCSS, cssToString, cssToTailwind } from "../lib/figma-to-css";
import { nodeToHTML, nodeToHTMLWithCSS } from "../lib/figma-to-html";
import { Copy, Check } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import type { PreviewTab } from "../store/figmaStore";

const TABS: { id: PreviewTab; label: string }[] = [
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "tailwind", label: "Tailwind" },
  { id: "live", label: "Live" },
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
  // Simple syntax highlighting
  const highlighted = useMemo(() => {
    if (language === "html") {
      return code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(
          /(&lt;\/?)([\w-]+)/g,
          '$1<span class="text-tag-frame">$2</span>',
        )
        .replace(/([\w-]+)(=)/g, '<span class="text-tag-hug">$1</span>$2')
        .replace(/(".*?")/g, '<span class="text-tag-rect">$1</span>');
    }
    if (language === "css") {
      return code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/([\w-]+)(:)/g, '<span class="text-tag-frame">$1</span>$2')
        .replace(/: (.+?);/g, ': <span class="text-tag-rect">$1</span>;');
    }
    return code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }, [code, language]);

  return (
    <pre className="text-xs leading-relaxed overflow-auto whitespace-pre">
      <code dangerouslySetInnerHTML={{ __html: highlighted }} />
    </pre>
  );
}

export function HtmlPreview() {
  const { selectedNode, rootNode, previewTab, setPreviewTab } = useFigmaStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isRoot = selectedNode?.id === rootNode?.id;

  const html = useMemo(() => {
    if (!selectedNode) return "";
    return nodeToHTML(selectedNode);
  }, [selectedNode]);

  const cssProps = useMemo(() => {
    if (!selectedNode) return {};
    return figmaToCSS(selectedNode, undefined, isRoot);
  }, [selectedNode, isRoot]);

  const cssText = useMemo(() => cssToString(cssProps), [cssProps]);

  const tailwindClasses = useMemo(() => {
    if (!selectedNode) return [];
    return cssToTailwind(cssProps);
  }, [selectedNode, cssProps]);

  const liveHtml = useMemo(() => {
    if (!selectedNode) return "";
    return nodeToHTMLWithCSS(selectedNode);
  }, [selectedNode]);

  // Update iframe content
  useEffect(() => {
    if (previewTab === "live" && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { margin: 16px; font-family: system-ui, sans-serif; background: #1e1e2e; color: #cdd6f4; }
              * { box-sizing: border-box; }
            </style>
          </head>
          <body>${liveHtml}</body>
          </html>
        `);
        doc.close();
      }
    }
  }, [previewTab, liveHtml]);

  if (!selectedNode) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-sm">
        Select a node to preview
      </div>
    );
  }

  let content: string;
  let language: string;
  switch (previewTab) {
    case "html":
      content = html;
      language = "html";
      break;
    case "css":
      content = cssText;
      language = "css";
      break;
    case "tailwind":
      content =
        tailwindClasses.length > 0
          ? `class="${tailwindClasses.join(" ")}"\n\n/* Individual classes: */\n${tailwindClasses.map((c) => `  ${c}`).join("\n")}`
          : "/* No Tailwind mappings */";
      language = "text";
      break;
    default:
      content = "";
      language = "html";
  }

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
          <CopyButton text={previewTab === "live" ? liveHtml : content} />
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {previewTab === "live" ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border border-border rounded bg-surface"
            title="Live Preview"
            sandbox="allow-same-origin"
          />
        ) : (
          <SyntaxHighlight code={content} language={language} />
        )}
      </div>
    </div>
  );
}
