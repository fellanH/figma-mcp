import { useFigmaStore, SAMPLE_FILES } from "../store/figmaStore";
import { countNodes } from "../lib/tree-utils";
import { ChevronDown, Expand, Shrink, Link, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

/** Extract file key and optional node ID from a Figma URL. */
function parseFigmaUrl(
  url: string,
): { fileKey: string; nodeId?: string } | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/(?:file|design)\/([a-zA-Z0-9]+)/);
    if (!match) return null;
    const fileKey = match[1];
    const nodeParam = u.searchParams.get("node-id");
    const nodeId = nodeParam ? nodeParam.replace("-", ":") : undefined;
    return { fileKey, nodeId };
  } catch {
    return null;
  }
}

export function Toolbar() {
  const {
    fileName,
    rootNode,
    loadFile,
    expandAll,
    collapseAll,
    setFileKey,
    setImageUrlMap,
    setImageUrlsLoading,
  } = useFigmaStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (showUrlInput && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [showUrlInput]);

  async function loadSample(path: string) {
    setLoading(true);
    setOpen(false);
    setFetchError("");
    try {
      const res = await fetch(path);
      const data = await res.json();
      loadFile(data);
      setFileKey(null);
      setImageUrlMap({});
    } catch (err) {
      console.error("Failed to load sample:", err);
    }
    setLoading(false);
  }

  async function fetchFromFigma() {
    const parsed = parseFigmaUrl(urlInput.trim());
    if (!parsed) {
      setFetchError("Invalid Figma URL");
      return;
    }

    setLoading(true);
    setFetchError("");
    setShowUrlInput(false);

    try {
      // Read token from the configured location
      const tokenRes = await fetch("/api/figma-token");
      let token = "";
      if (tokenRes.ok) {
        token = (await tokenRes.text()).trim();
      }

      if (!token) {
        // Fallback: prompt user for token stored in localStorage
        token = localStorage.getItem("figma-token") ?? "";
        if (!token) {
          token = prompt("Enter your Figma Personal Access Token:") ?? "";
          if (token) localStorage.setItem("figma-token", token);
        }
      }

      if (!token) {
        setFetchError("No Figma token");
        setLoading(false);
        return;
      }

      const idsParam = parsed.nodeId ? `?ids=${parsed.nodeId}` : "";
      const endpoint = parsed.nodeId
        ? `https://api.figma.com/v1/files/${parsed.fileKey}/nodes${idsParam}`
        : `https://api.figma.com/v1/files/${parsed.fileKey}?depth=4`;

      const res = await fetch(endpoint, {
        headers: { "X-Figma-Token": token },
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Figma API ${res.status}: ${err.slice(0, 100)}`);
      }

      const data = await res.json();
      loadFile(data);
      setFileKey(parsed.fileKey);
      setUrlInput("");

      // Resolve image fill URLs in the background
      setImageUrlsLoading(true);
      try {
        const imgRes = await fetch(
          `https://api.figma.com/v1/files/${parsed.fileKey}/images`,
          {
            headers: { "X-Figma-Token": token },
          },
        );
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          setImageUrlMap(imgData.meta?.images ?? {});
        }
      } catch (e) {
        console.warn("Failed to resolve image fill URLs:", e);
      }
      setImageUrlsLoading(false);
    } catch (err: any) {
      setFetchError(err.message ?? "Fetch failed");
      console.error("Figma fetch error:", err);
    }
    setLoading(false);
  }

  // Auto-load on mount
  useEffect(() => {
    if (!rootNode) {
      loadSample(SAMPLE_FILES[0].path);
    }
  }, []);

  const nodeCount = rootNode ? countNodes(rootNode) : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-panel border-b border-border">
      <span className="text-accent font-bold text-sm tracking-wide">
        FIGMA DEV LAB
      </span>

      {/* Sample dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded text-sm hover:bg-panel-hover transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Loading...
            </>
          ) : (
            <>
              Load Sample
              <ChevronDown size={14} />
            </>
          )}
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 bg-panel border border-border rounded shadow-lg z-50 min-w-[200px]">
            {SAMPLE_FILES.map((f) => (
              <button
                key={f.path}
                onClick={() => loadSample(f.path)}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-panel-hover transition-colors first:rounded-t last:rounded-b"
              >
                {f.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Figma URL input */}
      {showUrlInput ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={urlInputRef}
            type="text"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setFetchError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchFromFigma();
              if (e.key === "Escape") {
                setShowUrlInput(false);
                setUrlInput("");
                setFetchError("");
              }
            }}
            placeholder="Paste Figma URL..."
            className="w-[340px] px-2.5 py-1.5 bg-surface border border-border rounded text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
          />
          <button
            onClick={fetchFromFigma}
            disabled={loading || !urlInput.trim()}
            className="px-3 py-1.5 bg-accent text-surface rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Fetch
          </button>
          <button
            onClick={() => {
              setShowUrlInput(false);
              setUrlInput("");
              setFetchError("");
            }}
            className="px-2 py-1.5 text-text-dim hover:text-text text-sm"
          >
            ✕
          </button>
          {fetchError && (
            <span className="text-[11px] text-red-400">{fetchError}</span>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowUrlInput(true)}
          title="Fetch from Figma URL"
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-sm text-text-dim hover:text-text hover:bg-panel-hover transition-colors"
        >
          <Link size={14} />
          Figma URL
        </button>
      )}

      {fileName && (
        <span className="text-text-dim text-xs">
          {fileName} — {nodeCount} nodes
        </span>
      )}

      <div className="ml-auto flex gap-1">
        <button
          onClick={expandAll}
          title="Expand all"
          className="p-1.5 hover:bg-panel-hover rounded transition-colors text-text-dim hover:text-text"
        >
          <Expand size={14} />
        </button>
        <button
          onClick={collapseAll}
          title="Collapse all"
          className="p-1.5 hover:bg-panel-hover rounded transition-colors text-text-dim hover:text-text"
        >
          <Shrink size={14} />
        </button>
      </div>
    </div>
  );
}
