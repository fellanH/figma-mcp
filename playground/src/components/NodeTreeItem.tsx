import type { FigmaNode } from "../types/figma";
import { useFigmaStore } from "../store/figmaStore";
import { getNodeTypeIcon } from "../lib/tree-utils";
import { ChevronRight, ChevronDown } from "lucide-react";

interface Props {
  node: FigmaNode;
  depth: number;
  matchingIds?: Set<string>;
  visibleIds?: Set<string>;
}

const TYPE_COLORS: Record<string, string> = {
  FRAME: "text-tag-frame",
  TEXT: "text-tag-text",
  RECTANGLE: "text-tag-rect",
  ELLIPSE: "text-tag-rect",
  VECTOR: "text-tag-vector",
  BOOLEAN_OPERATION: "text-tag-vector",
  GROUP: "text-tag-group",
  COMPONENT: "text-tag-vector",
  INSTANCE: "text-tag-vector",
};

const SIZING_COLORS: Record<string, string> = {
  FILL: "bg-tag-fill/20 text-tag-fill",
  HUG: "bg-tag-hug/20 text-tag-hug",
  FIXED: "bg-tag-fixed/20 text-tag-fixed",
};

export function NodeTreeItem({ node, depth, matchingIds, visibleIds }: Props) {
  const { selectedNodeId, expandedNodes, selectNode, toggleNode } =
    useFigmaStore();
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const isHidden = node.visible === false;

  if (visibleIds && !visibleIds.has(node.id)) return null;

  const isMatch = matchingIds?.has(node.id);
  const icon = getNodeTypeIcon(node.type);
  const typeColor = TYPE_COLORS[node.type] ?? "text-text-dim";
  const hSizing = node.layoutSizingHorizontal;
  const vSizing = node.layoutSizingVertical;

  return (
    <>
      <div
        className={`flex items-center gap-1 pr-2 py-0.5 cursor-pointer text-xs group hover:bg-panel-hover transition-colors ${
          isSelected ? "bg-accent/15 text-accent" : ""
        } ${isHidden ? "opacity-40" : ""} ${isMatch ? "bg-accent/5" : ""}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => selectNode(node.id, node)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleNode(node.id);
            }}
            className="flex-none w-4 h-4 flex items-center justify-center text-text-dim hover:text-text"
          >
            {isExpanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </button>
        ) : (
          <span className="flex-none w-4" />
        )}
        <span className={`flex-none ${typeColor}`}>{icon}</span>
        <span className="truncate flex-1 min-w-0">{node.name}</span>
        {hSizing && hSizing !== "FIXED" && (
          <span
            className={`flex-none text-[9px] px-1 rounded ${SIZING_COLORS[hSizing] ?? ""}`}
          >
            {hSizing[0]}
          </span>
        )}
        {vSizing && vSizing !== "FIXED" && (
          <span
            className={`flex-none text-[9px] px-1 rounded ${SIZING_COLORS[vSizing] ?? ""}`}
          >
            {vSizing[0]}
          </span>
        )}
      </div>
      {hasChildren &&
        isExpanded &&
        node.children!.map((child) => (
          <NodeTreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            matchingIds={matchingIds}
            visibleIds={visibleIds}
          />
        ))}
    </>
  );
}
