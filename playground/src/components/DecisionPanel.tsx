import { useFigmaStore } from "../store/figmaStore";
import {
  DECISION_ICONS,
  DECISION_SEVERITY,
  type DecisionPoint,
} from "../lib/decision-gates";
import { AlertTriangle, Info, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

const SEVERITY_COLORS = {
  warning: "text-amber-400",
  info: "text-blue-400",
  neutral: "text-text-dim",
};

const SEVERITY_BG = {
  warning: "bg-amber-400/10 border-amber-400/20",
  info: "bg-blue-400/10 border-blue-400/20",
  neutral: "bg-surface-alt/50 border-border",
};

function DecisionItem({ point }: { point: DecisionPoint }) {
  const { decisions, setDecision, selectNode, rootNode } = useFigmaStore();
  const [expanded, setExpanded] = useState(false);
  const currentChoice = decisions.get(point.key) ?? point.defaultOptionId;
  const severity = DECISION_SEVERITY[point.type];
  const icon = DECISION_ICONS[point.type];

  function findNodeById(
    node: import("../types/figma").FigmaNode | null,
    id: string,
  ): import("../types/figma").FigmaNode | null {
    if (!node) return null;
    if (node.id === id) return node;
    for (const child of node.children ?? []) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
    return null;
  }

  function handleNavigate() {
    const node = findNodeById(rootNode, point.nodeId);
    if (node) selectNode(point.nodeId, node);
  }

  return (
    <div className={`border rounded-md ${SEVERITY_BG[severity]}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className={`font-mono text-[10px] ${SEVERITY_COLORS[severity]}`}>
          {icon}
        </span>
        <span className="flex-1 truncate">{point.message}</span>
        {severity === "warning" ? (
          <AlertTriangle size={12} className={SEVERITY_COLORS[severity]} />
        ) : (
          <Info size={12} className={SEVERITY_COLORS[severity]} />
        )}
      </button>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1.5">
          <button
            onClick={handleNavigate}
            className="text-[10px] text-accent hover:underline"
          >
            Go to node
          </button>
          <div className="space-y-1">
            {point.options.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                  currentChoice === opt.id
                    ? "bg-accent/15 ring-1 ring-accent/30"
                    : "hover:bg-surface-alt"
                }`}
              >
                <input
                  type="radio"
                  name={point.key}
                  checked={currentChoice === opt.id}
                  onChange={() => setDecision(point.key, opt.id)}
                  className="mt-0.5 accent-accent"
                />
                <div>
                  <div className="text-xs font-medium">
                    {opt.label}
                    {opt.id === point.defaultOptionId && (
                      <span className="ml-1 text-[10px] text-text-dim">
                        (default)
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-text-dim">
                    {opt.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DecisionPanel() {
  const { decisionPoints, showDecisionPanel, toggleDecisionPanel } =
    useFigmaStore();

  if (decisionPoints.length === 0) return null;

  const warnings = decisionPoints.filter(
    (p) => DECISION_SEVERITY[p.type] === "warning",
  ).length;
  const infos = decisionPoints.filter(
    (p) => DECISION_SEVERITY[p.type] === "info",
  ).length;

  return (
    <div className="border-b border-border">
      <button
        onClick={toggleDecisionPanel}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-alt transition-colors"
      >
        <AlertTriangle size={12} className="text-amber-400" />
        <span className="font-medium">
          {decisionPoints.length} decision
          {decisionPoints.length !== 1 ? "s" : ""}
        </span>
        {warnings > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 text-[10px]">
            {warnings} warning{warnings !== 1 ? "s" : ""}
          </span>
        )}
        {infos > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-blue-400/15 text-blue-400 text-[10px]">
            {infos} info
          </span>
        )}
        <span className="ml-auto text-text-dim">
          {showDecisionPanel ? (
            <ChevronDown size={12} />
          ) : (
            <ChevronRight size={12} />
          )}
        </span>
      </button>

      {showDecisionPanel && (
        <div className="px-3 pb-3 space-y-1.5 max-h-[300px] overflow-y-auto">
          {decisionPoints.map((point) => (
            <DecisionItem key={point.key} point={point} />
          ))}
        </div>
      )}
    </div>
  );
}
