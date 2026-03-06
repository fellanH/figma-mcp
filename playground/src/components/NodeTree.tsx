import { useFigmaStore } from "../store/figmaStore";
import { NodeTreeItem } from "./NodeTreeItem";
import { searchNodes, getAncestorIds } from "../lib/tree-utils";
import { Search, X } from "lucide-react";
import { useMemo } from "react";

export function NodeTree() {
  const { rootNode, searchQuery, setSearchQuery } = useFigmaStore();

  const { matchingIds, visibleIds } = useMemo(() => {
    if (!rootNode || !searchQuery.trim()) {
      return { matchingIds: undefined, visibleIds: undefined };
    }
    const matches = searchNodes(rootNode, searchQuery.trim());
    const ancestors = getAncestorIds(rootNode, matches);
    return { matchingIds: matches, visibleIds: ancestors };
  }, [rootNode, searchQuery]);

  if (!rootNode) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-sm">
        Load a sample to begin
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border">
        <Search size={12} className="text-text-dim flex-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter nodes..."
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
      <div className="flex-1 overflow-y-auto py-1">
        <NodeTreeItem
          node={rootNode}
          depth={0}
          matchingIds={matchingIds}
          visibleIds={visibleIds}
        />
      </div>
    </div>
  );
}
