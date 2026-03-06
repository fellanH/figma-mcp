import type { FigmaNode } from "../types/figma";
import { findComponentMapping } from "./component-map";

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
  /** Optional metadata for code generation (e.g., font family name). */
  metadata?: Record<string, string>;
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
      id: "keep-name",
      label: "Keep font name",
      description:
        "Keep the original font name — add @font-face or CDN link manually",
    },
    {
      id: "generate-font-face",
      label: "Generate @font-face",
      description:
        "Generate a @font-face template with hosting guidance comments",
    },
    {
      id: "system-fallback",
      label: "System fallback",
      description: "Replace with system font stack (system-ui, sans-serif)",
    },
  ],
  "image-fill": [
    {
      id: "placeholder",
      label: "Placeholder",
      description:
        "Use a sized placeholder (use MCP export_assets tool to get real images)",
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
      id: "design-system",
      label: "Map to design system",
      description: "Map to shadcn/ui component with matching props and imports",
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
  "Lexend",
  "Figtree",
  "Instrument Sans",
  "Instrument Serif",
  "Be Vietnam Pro",
  "Bricolage Grotesque",
  "Gabarito",
  "Onest",
  "Wix Madefor Display",
  "Wix Madefor Text",
  "Urbanist",
  "Epilogue",
  "Overpass",
  "Public Sans",
  "Atkinson Hyperlegible",
  "Commissioner",
  "Fraunces",
  "Libre Franklin",
  "Inconsolata",
  "Victor Mono",
  "Bitter",
  "Crimson Text",
  "Crimson Pro",
  "Cormorant",
  "Cormorant Garamond",
  "Libre Baskerville",
  "Lora",
  "Spectral",
  "EB Garamond",
  "DM Serif Text",
  "Bodoni Moda",
  // Additional commonly used Google Fonts
  "Oswald",
  "Source Serif Pro",
  "Nunito Sans",
  "Exo 2",
  "Titillium Web",
  "Heebo",
  "Oxygen",
  "Dosis",
  "Hind",
  "Arimo",
  "Nanum Gothic",
  "Libre Caslon Text",
  "Bebas Neue",
  "Abel",
  "Anton",
  "Pacifico",
  "Shadows Into Light",
  "Indie Flower",
  "Dancing Script",
  "Permanent Marker",
  "Amatic SC",
  "Caveat",
  "Comfortaa",
  "Righteous",
  "Russo One",
  "Signika",
  "Encode Sans",
  "Hanken Grotesk",
  "Albert Sans",
  "Golos Text",
  "Noto Sans JP",
  "Noto Sans KR",
  "Noto Sans SC",
  "Noto Sans TC",
  "Noto Sans Arabic",
  "Noto Sans Hebrew",
  "Noto Sans Thai",
  "Noto Sans Devanagari",
  "Jost",
  "Chakra Petch",
  "Zen Kaku Gothic New",
  "Tenor Sans",
  "Schibsted Grotesk",
  "Geologica",
  "Gantari",
  "Switzer",
  "Mona Sans",
  "Hubot Sans",
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
// Auto-resolution rules
// ---------------------------------------------------------------------------

// Node types that are SVG internals — constraints on these are meaningless
// for code gen since they render as <svg> placeholders.
const SVG_INTERNAL_TYPES = new Set([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "LINE",
  "STAR",
  "REGULAR_POLYGON",
  "ELLIPSE",
]);

// Node types where scale constraints are just Figma's default and carry no
// useful responsive intent (groups inherit parent behaviour).
const PASSIVE_CONSTRAINT_TYPES = new Set(["GROUP", ...SVG_INTERNAL_TYPES]);

/** Return true if the node's parent uses auto-layout — constraints are
 *  irrelevant inside flex containers because flex sizing takes over. */
function parentIsAutoLayout(parent?: FigmaNode): boolean {
  return !!parent?.layoutMode && parent.layoutMode !== "NONE";
}

/** Return true if a SCALE constraint on this node can be auto-resolved
 *  without user input. */
function canAutoResolveScale(n: FigmaNode, parent?: FigmaNode): boolean {
  // SVG internals, groups: always auto-resolve
  if (PASSIVE_CONSTRAINT_TYPES.has(n.type)) return true;
  // Inside auto-layout: flex handles sizing
  if (parentIsAutoLayout(parent)) return true;
  // TEXT nodes: scale constraint is unusual, auto-resolve to percentage
  if (n.type === "TEXT") return true;
  // RECTANGLE that is purely decorative (no children, tiny)
  if (n.type === "RECTANGLE" && (!n.children || n.children.length === 0)) {
    return true;
  }
  return false;
}

/** Return true if a component instance can be auto-resolved to "flatten"
 *  without user input.  Only surface the decision when the instance has
 *  meaningful variant properties the user might want as React props,
 *  or when the name matches a known design system component. */
function shouldSurfaceComponentInstance(n: FigmaNode): boolean {
  // Check if it matches a known design system component
  if (findComponentMapping(n.name)) return true;

  // Original logic: surface if has non-boolean variant props
  if (!n.componentProperties) return false;
  const entries = Object.entries(n.componentProperties);
  if (entries.length === 0) return false;
  // Filter out boolean-only toggles (e.g. "Scrolled: False") — these are
  // rarely useful as React props.
  const meaningful = entries.filter(([, val]) => {
    const v = val as { value?: string; type?: string };
    if (v.type !== "VARIANT") return false;
    // Boolean-like values are auto-resolvable
    const str = String(v.value ?? "").toLowerCase();
    if (str === "true" || str === "false" || str === "on" || str === "off")
      return false;
    return true;
  });
  return meaningful.length > 0;
}

// ---------------------------------------------------------------------------
// Scanner: walk a node tree and collect decision points
// ---------------------------------------------------------------------------

export function scanDecisionPoints(
  node: FigmaNode,
  imageUrlMap?: Record<string, string>,
): DecisionPoint[] {
  const points: DecisionPoint[] = [];
  const seenFonts = new Set<string>();
  /** Track image fills by imageRef to avoid duplicate decisions for the
   *  same image used on multiple nodes. */
  const seenImageRefs = new Set<string>();
  const imageNodes: { id: string; name: string }[] = [];

  function makeKey(nodeId: string, type: DecisionType): string {
    return `${nodeId}::${type}`;
  }

  function walk(n: FigmaNode, parent?: FigmaNode) {
    if (n.visible === false) return;

    // ── Diamond gradient ──────────────────────────────────────────────
    // Always surface — no good CSS equivalent.
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

    // ── Complex transform ─────────────────────────────────────────────
    // Only surface on FRAME/COMPONENT/INSTANCE — inner vectors are SVG
    // internals where the matrix is expected.
    if (
      n.relativeTransform &&
      !SVG_INTERNAL_TYPES.has(n.type) &&
      n.type !== "GROUP"
    ) {
      const [[a, b], [c, d]] = n.relativeTransform;
      const scale = Math.sqrt(a * a + c * c);
      const isPureRotation =
        Math.abs(scale - 1) < 0.001 &&
        Math.abs(a - d) < 0.001 &&
        Math.abs(b + c) < 0.001;
      // Also ignore identity transforms (scale≈1, no skew, no rotation)
      const isIdentity =
        Math.abs(a - 1) < 0.001 &&
        Math.abs(d - 1) < 0.001 &&
        Math.abs(b) < 0.001 &&
        Math.abs(c) < 0.001;

      if (!isPureRotation && !isIdentity) {
        points.push({
          key: makeKey(n.id, "complex-transform"),
          nodeId: n.id,
          nodeName: n.name,
          type: "complex-transform",
          message: `Complex transform on "${n.name}" (skew or non-uniform scale)`,
          options: DECISION_OPTIONS["complex-transform"],
          defaultOptionId: DECISION_DEFAULTS["complex-transform"],
        });
      }
    }

    // ── Scale constraint ──────────────────────────────────────────────
    // Auto-resolve for SVG internals, groups, auto-layout children, and
    // decorative nodes.  Only surface for top-level layout frames where
    // the choice between percentage and fixed actually matters.
    if (n.constraints) {
      const hasScale =
        n.constraints.horizontal === "SCALE" ||
        n.constraints.vertical === "SCALE";
      if (hasScale && !canAutoResolveScale(n, parent)) {
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

    // ── Unknown font ──────────────────────────────────────────────────
    // Deduplicated per font family — one decision per font, not per node.
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
            message: `Font "${font}" is not in the standard font catalog — you may need to self-host or use a CDN (Adobe Fonts, Fontsource)`,
            options: DECISION_OPTIONS["unknown-font"],
            defaultOptionId: DECISION_DEFAULTS["unknown-font"],
            metadata: { fontFamily: font },
          });
        }
      }
    }

    // ── Image fill ────────────────────────────────────────────────────
    // Collect but don't add individually — we'll create one summary
    // decision after the walk if there are image fills.
    const imageFills = (n.fills ?? []).filter(
      (f) => f.type === "IMAGE" && f.visible !== false,
    );
    if (imageFills.length > 0) {
      const ref = imageFills[0].imageRef;
      const dedupKey = ref ?? n.id;
      if (!seenImageRefs.has(dedupKey)) {
        seenImageRefs.add(dedupKey);
        imageNodes.push({ id: n.id, name: n.name });
      }
    }

    // ── Component instance ────────────────────────────────────────────
    // Auto-resolve to "flatten" unless the instance has meaningful
    // variant props worth surfacing as React component props.
    if (n.type === "INSTANCE" && n.componentId) {
      if (shouldSurfaceComponentInstance(n)) {
        points.push({
          key: makeKey(n.id, "component-instance"),
          nodeId: n.id,
          nodeName: n.name,
          type: "component-instance",
          message: `"${n.name}" — component with variant props`,
          options: DECISION_OPTIONS["component-instance"],
          defaultOptionId: DECISION_DEFAULTS["component-instance"],
        });
      }
    }

    // ── Unsupported node types ────────────────────────────────────────
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
      walk(child, n);
    }
  }

  walk(node);

  // ── Post-walk: create summary decision for image fills ────────────
  // One decision covers all images — they all use the same strategy.
  if (imageNodes.length > 0) {
    const first = imageNodes[0];
    points.push({
      key: `__all__::image-fill`,
      nodeId: first.id,
      nodeName:
        imageNodes.length === 1 ? first.name : `${imageNodes.length} images`,
      type: "image-fill",
      message:
        imageNodes.length === 1
          ? `"${first.name}" has an image fill — using placeholder`
          : `${imageNodes.length} image fills — all using placeholders`,
      options: DECISION_OPTIONS["image-fill"],
      defaultOptionId: DECISION_DEFAULTS["image-fill"],
    });
  }

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
