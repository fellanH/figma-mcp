import { useFigmaStore } from "../store/figmaStore";
import {
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Copy,
  Check,
} from "lucide-react";
import { useState, useMemo } from "react";

export function RawJsonView() {
  const { selectedNode, showRawJson, toggleRawJson } = useFigmaStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const jsonText = useMemo(() => {
    if (!selectedNode) return "";
    // Exclude children to keep it manageable
    const { children, ...rest } = selectedNode;
    const obj = {
      ...rest,
      _childCount: children?.length ?? 0,
    };
    return JSON.stringify(obj, null, 2);
  }, [selectedNode]);

  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return jsonText
      .split("\n")
      .map((line, i) => ({ line, num: i + 1 }))
      .filter(({ line }) => line.toLowerCase().includes(q));
  }, [jsonText, searchQuery]);

  function handleCopy() {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!selectedNode) return null;

  return (
    <div className="border-t border-border">
      <button
        onClick={toggleRawJson}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-semibold text-text-dim hover:text-text hover:bg-panel-hover transition-colors"
      >
        {showRawJson ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Raw JSON
        <span className="text-[10px] text-text-dim font-normal">
          ({jsonText.split("\n").length} lines)
        </span>
      </button>
      {showRawJson && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-1 bg-surface border border-border rounded px-2 py-1">
              <Search size={12} className="text-text-dim" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search JSON..."
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-text-dim"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-text-dim hover:text-text"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              onClick={handleCopy}
              className="p-1.5 text-text-dim hover:text-text transition-colors"
              title="Copy JSON"
            >
              {copied ? (
                <Check size={14} className="text-green-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
          <pre className="bg-surface border border-border rounded p-3 overflow-auto max-h-[400px] text-xs leading-relaxed">
            {filteredLines ? (
              filteredLines.map(({ line, num }) => (
                <div key={num}>
                  <span className="text-text-dim mr-3 select-none">
                    {String(num).padStart(3)}
                  </span>
                  {line}
                </div>
              ))
            ) : (
              <code>{jsonText}</code>
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
