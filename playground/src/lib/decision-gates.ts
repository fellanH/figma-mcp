import type { FigmaNode } from "../types/figma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DecisionType =
  | "diamond-gradient"
  | "complex-transform"
  | "scale-constraint"
  | "unknown-font"
  | "image-fill"
  | "unsupported-node"
  | "component-instance";

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
}

export interface DecisionPoint {
  /** Unique key: `${nodeId}::${type}` */
  key: string;
  nodeId: string;
  nodeName: string;
  type: DecisionType;
  message: string;
  options: DecisionOption[];
  defaultOptionId: string;
}

export interface DecisionRecord {
  key: string;
  chosenOptionId: string;
}

// ---------------------------------------------------------------------------
// Option definitions per decision type
// ---------------------------------------------------------------------------

const DECISION_OPTIONS: Record<DecisionType, DecisionOption[]> = {
  "diamond-gradient": [
    {
      id: "radial-approx",
      label: "Radial approximation",
      description: "Use a radial gradient as the closest CSS equivalent",
    },
    {
      id: "skip",
      label: "Skip",
      description: "Omit the gradient entirely",
    },
  ],
  "complex-transform": [
    {
      id: "css-matrix",
      label: "CSS matrix()",
      description: "Emit the full affine transform as a CSS matrix",
    },
    {
      id: "decompose",
      label: "Decompose",
      description: "Extract rotation and scale separately (may lose skew)",
    },
    {
      id: "skip",
      label: "Skip",
      description: "Omit the transform",
    },
  ],
  "scale-constraint": [
    {
      id: "percentage",
      label: "Percentage-based",
      description: "Use % values for responsive scaling",
    },
    {
      id: "fixed",
      label: "Fixed pixels",
      description: "Use exact pixel values from the design",
    },
  ],
  "unknown-font": [
    {
      id: "system-fallback",
      label: "System fallback",
      description: "Use the closest system font family",
    },
    {
      id: "keep-name",
      label: "Keep font name",
      description: "Keep the original font name (user provides the file)",
    },
  ],
  "image-fill": [
    {
      id: "placeholder",
      label: "Placeholder",
      description: "Use a sized placeholder image with dimensions label",
    },
    {
      id: "skip",
      label: "Skip",
      description: "Omit the image background",
    },
  ],
  "unsupported-node": [
    {
      id: "div-fallback",
      label: "Render as div",
      description: "Best-effort rendering as a generic div",
    },
    {
      id: "svg-export",
      label: "SVG placeholder",
      description: "Render as an SVG placeholder element",
    },
    {
      id: "skip",
      label: "Skip with comment",
      description: "Omit the node and leave an HTML comment",
    },
  ],
  "component-instance": [
    {
      id: "flatten",
      label: "Flatten to static",
      description:
        "Render as static HTML (default — preserves visual fidelity)",
    },
    {
      id: "component-props",
      label: "Generate props",
      description:
        "Create a React component with props from variant properties",
    },
  ],
};

const DECISION_DEFAULTS: Record<DecisionType, string> = {
  "diamond-gradient": "radial-approx",
  "complex-transform": "css-matrix",
  "scale-constraint": "percentage",
  "unknown-font": "keep-name",
  "image-fill": "placeholder",
  "unsupported-node": "div-fallback",
  "component-instance": "flatten",
};

// ---------------------------------------------------------------------------
// Known Google Fonts (common subset for detection)
// ---------------------------------------------------------------------------

const GOOGLE_FONT_SET = new Set([
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Nunito",
  "Playfair Display",
  "Source Sans Pro",
  "Source Code Pro",
  "Merriweather",
  "Ubuntu",
  "Rubik",
  "Work Sans",
  "DM Sans",
  "DM Serif Display",
  "Space Grotesk",
  "Space Mono",
  "Manrope",
  "Outfit",
  "Plus Jakarta Sans",
  "Geist",
  "Geist Mono",
  "JetBrains Mono",
  "Fira Code",
  "IBM Plex Sans",
  "IBM Plex Mono",
  "Noto Sans",
  "Noto Serif",
  "PT Sans",
  "PT Serif",
  "Barlow",
  "Mulish",
  "Quicksand",
  "Cabin",
  "Karla",
  "Josefin Sans",
  "Archivo",
  "Red Hat Display",
  "Sora",
  "General Sans",
  "Satoshi",
  "Clash Display",
  "Cabinet Grotesk",
]);

const SYSTEM_FONTS = new Set([
  "system-ui",
  "sans-serif",
  "serif",
  "monospace",
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
  "Tahoma",
  "SF Pro",
  "SF Pro Display",
  "SF Pro Text",
  "SF Mono",
  "Segoe UI",
  ".AppleSystemUIFont",
]);

// ---------------------------------------------------------------------------
// Scanner: walk a node tree and collect decision points
// ---------------------------------------------------------------------------

export function scanDecisionPoints(node: FigmaNode): DecisionPoint[] {
  const points: DecisionPoint[] = [];
  const seenFonts = new Set<string>();

  function makeKey(nodeId: string, type: DecisionType): string {
    return `${nodeId}::${type}`;
  }

  function walk(n: FigmaNode) {
    if (n.visible === false) return;

    // Diamond gradient
    const hasDiamond = (n.fills ?? []).some(
      (f) => f.type === "GRADIENT_DIAMOND" && f.visible !== false,
    );
    if (hasDiamond) {
      points.push({
        key: makeKey(n.id, "diamond-gradient"),
        nodeId: n.id,
        nodeName: n.name,
        type: "diamond-gradient",
        message: `Diamond gradient on "${n.name}" — no direct CSS equivalent`,
        options: DECISION_OPTIONS["diamond-gradient"],
        defaultOptionId: DECISION_DEFAULTS["diamond-gradient"],
      });
    }

    // Complex transform (non-pure-rotation matrix)
    if (n.relativeTransform) {
      const [[a, ,], [c, d]] = n.relativeTransform;
      const scale = Math.sqrt(a * a + c * c);
      const isPureRotation =
        Math.abs(scale - 1) < 0.001 && Math.abs(a - d) < 0.001;
      if (
        !isPureRotation &&
        (Math.abs(scale - 1) > 0.001 || Math.abs(a - d) > 0.001)
      ) {
        points.push({
          key: makeKey(n.id, "complex-transform"),
          nodeId: n.id,
          nodeName: n.name,
          type: "complex-transform",
          message: `Complex transform matrix on "${n.name}" (includes skew or non-uniform scale)`,
          options: DECISION_OPTIONS["complex-transform"],
          defaultOptionId: DECISION_DEFAULTS["complex-transform"],
        });
      }
    }

    // Scale constraint
    if (n.constraints) {
      if (
        n.constraints.horizontal === "SCALE" ||
        n.constraints.vertical === "SCALE"
      ) {
        points.push({
          key: makeKey(n.id, "scale-constraint"),
          nodeId: n.id,
          nodeName: n.name,
          type: "scale-constraint",
          message: `"${n.name}" uses SCALE constraint — percentage vs fixed?`,
          options: DECISION_OPTIONS["scale-constraint"],
          defaultOptionId: DECISION_DEFAULTS["scale-constraint"],
        });
      }
    }

    // Unknown font
    if (n.type === "TEXT" && n.style?.fontFamily) {
      const font = n.style.fontFamily;
      if (!seenFonts.has(font)) {
        seenFonts.add(font);
        if (!SYSTEM_FONTS.has(font) && !GOOGLE_FONT_SET.has(font)) {
          points.push({
            key: makeKey(n.id, "unknown-font"),
            nodeId: n.id,
            nodeName: n.name,
            type: "unknown-font",
            message: `Font "${font}" may not be available in Google Fonts`,
            options: DECISION_OPTIONS["unknown-font"],
            defaultOptionId: DECISION_DEFAULTS["unknown-font"],
          });
        }
      }
    }

    // Image fill
    const hasImage = (n.fills ?? []).some(
      (f) => f.type === "IMAGE" && f.visible !== false,
    );
    if (hasImage) {
      points.push({
        key: makeKey(n.id, "image-fill"),
        nodeId: n.id,
        nodeName: n.name,
        type: "image-fill",
        message: `"${n.name}" has an image fill — using placeholder`,
        options: DECISION_OPTIONS["image-fill"],
        defaultOptionId: DECISION_DEFAULTS["image-fill"],
      });
    }

    // Component instance
    if (n.type === "INSTANCE" && n.componentId) {
      points.push({
        key: makeKey(n.id, "component-instance"),
        nodeId: n.id,
        nodeName: n.name,
        type: "component-instance",
        message: `"${n.name}" is a component instance`,
        options: DECISION_OPTIONS["component-instance"],
        defaultOptionId: DECISION_DEFAULTS["component-instance"],
      });
    }

    // Unsupported node types
    const unsupported = new Set([
      "SLICE",
      "STAMP",
      "STICKY",
      "SHAPE_WITH_TEXT",
      "CONNECTOR",
      "CODE_BLOCK",
      "WIDGET",
      "EMBED",
      "LINK_UNFURL",
      "MEDIA",
    ]);
    if (unsupported.has(n.type)) {
      points.push({
        key: makeKey(n.id, "unsupported-node"),
        nodeId: n.id,
        nodeName: n.name,
        type: "unsupported-node",
        message: `"${n.name}" is an unsupported node type (${n.type})`,
        options: DECISION_OPTIONS["unsupported-node"],
        defaultOptionId: DECISION_DEFAULTS["unsupported-node"],
      });
    }

    for (const child of n.children ?? []) {
      walk(child);
    }
  }

  walk(node);
  return points;
}

/** Get the chosen option for a decision point, falling back to default. */
export function getDecision(
  decisions: Map<string, string>,
  nodeId: string,
  type: DecisionType,
): string {
  const key = `${nodeId}::${type}`;
  return decisions.get(key) ?? DECISION_DEFAULTS[type];
}

/** Icon mapping for decision types (used in UI). */
export const DECISION_ICONS: Record<DecisionType, string> = {
  "diamond-gradient": "\u25C7", // diamond
  "complex-transform": "\u21BB", // rotation arrow
  "scale-constraint": "\u2194", // left-right arrow
  "unknown-font": "Aa",
  "image-fill": "\u25A3", // square with fill
  "unsupported-node": "?",
  "component-instance": "\u29C9", // component
};

/** Severity / color category for decision types. */
export const DECISION_SEVERITY: Record<
  DecisionType,
  "warning" | "info" | "neutral"
> = {
  "diamond-gradient": "warning",
  "complex-transform": "warning",
  "scale-constraint": "info",
  "unknown-font": "warning",
  "image-fill": "info",
  "unsupported-node": "warning",
  "component-instance": "neutral",
};
