import type {
  FigmaNode,
  FigmaColor,
  FigmaFill,
  FigmaEffect,
} from "../types/figma";

function colorToRgba(c: FigmaColor): string {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  if (c.a === 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${c.a.toFixed(2)})`;
}

function colorToHex(c: FigmaColor): string {
  const r = Math.round(c.r * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round(c.g * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round(c.b * 255)
    .toString(16)
    .padStart(2, "0");
  if (c.a < 1) {
    const a = Math.round(c.a * 255)
      .toString(16)
      .padStart(2, "0");
    return `#${r}${g}${b}${a}`;
  }
  return `#${r}${g}${b}`;
}

function mapJustifyContent(align?: string): string | undefined {
  switch (align) {
    case "MIN":
      return "flex-start";
    case "CENTER":
      return "center";
    case "MAX":
      return "flex-end";
    case "SPACE_BETWEEN":
      return "space-between";
    default:
      return undefined;
  }
}

function mapAlignItems(align?: string): string | undefined {
  switch (align) {
    case "MIN":
      return "flex-start";
    case "CENTER":
      return "center";
    case "MAX":
      return "flex-end";
    case "BASELINE":
      return "baseline";
    default:
      return undefined;
  }
}

function mapBlendMode(mode?: string): string {
  const map: Record<string, string> = {
    MULTIPLY: "multiply",
    SCREEN: "screen",
    OVERLAY: "overlay",
    DARKEN: "darken",
    LIGHTEN: "lighten",
    COLOR_DODGE: "color-dodge",
    COLOR_BURN: "color-burn",
    HARD_LIGHT: "hard-light",
    SOFT_LIGHT: "soft-light",
    DIFFERENCE: "difference",
    EXCLUSION: "exclusion",
    HUE: "hue",
    SATURATION: "saturation",
    COLOR: "color",
    LUMINOSITY: "luminosity",
  };
  return (mode && map[mode]) ?? "normal";
}

/** Convert a single fill to a CSS background layer string. */
function fillToBgLayer(fill: FigmaFill, node?: FigmaNode): string | undefined {
  if (fill.visible === false) return undefined;
  const fillOpacity = fill.opacity ?? 1;

  if (fill.type === "SOLID" && fill.color) {
    const color = { ...fill.color, a: fill.color.a * fillOpacity };
    return colorToRgba(color);
  }

  if (fill.type === "GRADIENT_LINEAR" && fill.gradientStops) {
    const stops = fill.gradientStops
      .map((s) => {
        const c = { ...s.color, a: s.color.a * fillOpacity };
        return `${colorToRgba(c)} ${Math.round(s.position * 100)}%`;
      })
      .join(", ");
    let angle = "180deg";
    if (
      fill.gradientHandlePositions &&
      fill.gradientHandlePositions.length >= 2
    ) {
      const [start, end] = fill.gradientHandlePositions;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const rad = Math.atan2(dy, dx);
      const deg = Math.round((rad * 180) / Math.PI + 90);
      angle = `${((deg % 360) + 360) % 360}deg`;
    }
    return `linear-gradient(${angle}, ${stops})`;
  }

  if (fill.type === "IMAGE") {
    const w = Math.round(node?.absoluteBoundingBox?.width ?? 100);
    const h = Math.round(node?.absoluteBoundingBox?.height ?? 100);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='%23e4e4e7'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23a1a1aa' font-family='sans-serif' font-size='12'>${w}×${h}</text></svg>`;
    return `url("data:image/svg+xml,${svg.replace(/#/g, "%23")}")`;
  }

  return undefined;
}

function shadowToCSS(effect: FigmaEffect): string | undefined {
  if (!effect.visible || !effect.color) return undefined;
  const x = effect.offset?.x ?? 0;
  const y = effect.offset?.y ?? 0;
  const blur = effect.radius;
  const spread = effect.spread ?? 0;
  const color = colorToRgba(effect.color);
  const inset = effect.type === "INNER_SHADOW" ? "inset " : "";
  return `${inset}${x}px ${y}px ${blur}px ${spread}px ${color}`;
}

export interface CSSProperties {
  [key: string]: string;
}

export function figmaToCSS(
  node: FigmaNode,
  parentNode?: FigmaNode,
  isRoot = false,
): CSSProperties {
  const css: CSSProperties = {};

  // Auto Layout → Flexbox
  if (node.layoutMode && node.layoutMode !== "NONE") {
    css["display"] = "flex";
    css["flex-direction"] = node.layoutMode === "VERTICAL" ? "column" : "row";

    if (node.itemSpacing !== undefined && node.itemSpacing > 0) {
      css["gap"] = `${node.itemSpacing}px`;
    }

    if (node.layoutWrap === "WRAP") {
      css["flex-wrap"] = "wrap";
      if (
        node.counterAxisSpacing !== undefined &&
        node.counterAxisSpacing > 0
      ) {
        const crossGap =
          node.layoutMode === "VERTICAL" ? "column-gap" : "row-gap";
        css[crossGap] = `${node.counterAxisSpacing}px`;
      }
    }

    const jc = mapJustifyContent(node.primaryAxisAlignItems);
    if (jc) css["justify-content"] = jc;

    const ai = mapAlignItems(node.counterAxisAlignItems);
    if (ai) css["align-items"] = ai;
  }

  // Padding
  const pt = node.paddingTop ?? 0;
  const pr = node.paddingRight ?? 0;
  const pb = node.paddingBottom ?? 0;
  const pl = node.paddingLeft ?? 0;
  if (pt || pr || pb || pl) {
    if (pt === pb && pl === pr) {
      if (pt === pl) {
        css["padding"] = `${pt}px`;
      } else {
        css["padding"] = `${pt}px ${pl}px`;
      }
    } else {
      css["padding"] = `${pt}px ${pr}px ${pb}px ${pl}px`;
    }
  }

  // Sizing (#36: parent-aware FIXED sizing)
  // Root frame (page-level node) maps to <body> — skip fixed dimensions
  const bbox = node.absoluteBoundingBox;
  const insideFlex = parentNode?.layoutMode && parentNode.layoutMode !== "NONE";

  if (!isRoot) {
    if (node.layoutSizingHorizontal === "FILL") {
      css["width"] = "100%";
    } else if (node.layoutSizingHorizontal === "HUG") {
      css["width"] = "fit-content";
    } else if (node.layoutSizingHorizontal === "FIXED" && bbox) {
      css["width"] = `${bbox.width}px`;
      if (insideFlex) css["flex-shrink"] = "0";
    }

    if (node.layoutSizingVertical === "FILL") {
      css["height"] = "100%";
    } else if (node.layoutSizingVertical === "HUG") {
      css["height"] = "fit-content";
    } else if (node.layoutSizingVertical === "FIXED" && bbox) {
      css["height"] = `${bbox.height}px`;
    }

    if (node.layoutGrow === 1) {
      css["flex-grow"] = "1";
    }

    if (node.layoutAlign === "STRETCH") {
      css["align-self"] = "stretch";
    }

    if (node.minWidth !== undefined) css["min-width"] = `${node.minWidth}px`;
    if (node.maxWidth !== undefined) css["max-width"] = `${node.maxWidth}px`;
    if (node.minHeight !== undefined) css["min-height"] = `${node.minHeight}px`;
    if (node.maxHeight !== undefined) css["max-height"] = `${node.maxHeight}px`;
  } // end !isRoot sizing guard

  // Positioning
  if (node.layoutPositioning === "ABSOLUTE") {
    css["position"] = "absolute";
  }

  // Fills (#31: composite stacking, #32: per-fill opacity + blend, #35: image placeholders)
  const visibleFills = (node.fills ?? []).filter((f) => f.visible !== false);
  if (visibleFills.length > 0) {
    // Figma renders bottom-to-top; CSS background layers are top-to-bottom
    const reversed = [...visibleFills].reverse();
    const bgLayers: string[] = [];
    const blendModes: string[] = [];
    let bgSize: string | undefined;

    for (const fill of reversed) {
      const layer = fillToBgLayer(fill, node);
      if (!layer) continue;

      // Solid colors need gradient form to participate in multi-layer backgrounds
      if (fill.type === "SOLID" && reversed.length > 1) {
        bgLayers.push(`linear-gradient(${layer}, ${layer})`);
      } else {
        bgLayers.push(layer);
      }

      blendModes.push(mapBlendMode(fill.blendMode));

      if (fill.type === "IMAGE") {
        bgSize = fill.scaleMode === "FILL" ? "cover" : "contain";
      }
    }

    if (bgLayers.length === 1 && visibleFills[0]?.type === "SOLID") {
      // TEXT nodes use color, not background-color
      if (node.type === "TEXT") {
        css["color"] = fillToBgLayer(visibleFills[0], node) ?? "";
      } else {
        css["background-color"] = fillToBgLayer(visibleFills[0], node) ?? "";
      }
    } else if (bgLayers.length > 0) {
      css["background"] = bgLayers.join(", ");
    }

    if (bgSize) css["background-size"] = bgSize;

    const hasNonNormal = blendModes.some((m) => m !== "normal");
    if (hasNonNormal) {
      css["background-blend-mode"] = blendModes.join(", ");
    }
  }

  // Strokes → border / box-shadow (#33: strokeAlign)
  const visibleStrokes = (node.strokes ?? []).filter(
    (s) => (s as any).visible !== false,
  );
  if (visibleStrokes.length > 0 && node.strokeWeight) {
    const stroke = visibleStrokes[0];
    const color = stroke.color ? colorToRgba(stroke.color) : "currentColor";
    const align = node.strokeAlign ?? "CENTER";

    if (align === "INSIDE") {
      // Inset box-shadow preserves layout dimensions
      if (node.individualStrokeWeights) {
        const w = node.individualStrokeWeights;
        const shadows: string[] = [];
        if (w.top) shadows.push(`inset 0 ${w.top}px 0 0 ${color}`);
        if (w.bottom) shadows.push(`inset 0 -${w.bottom}px 0 0 ${color}`);
        if (w.left) shadows.push(`inset ${w.left}px 0 0 0 ${color}`);
        if (w.right) shadows.push(`inset -${w.right}px 0 0 0 ${color}`);
        if (shadows.length) css["box-shadow"] = shadows.join(", ");
      } else {
        css["box-shadow"] = `inset 0 0 0 ${node.strokeWeight}px ${color}`;
      }
    } else if (align === "OUTSIDE") {
      // Outer box-shadow doesn't affect layout
      if (node.individualStrokeWeights) {
        const w = node.individualStrokeWeights;
        const shadows: string[] = [];
        if (w.top) shadows.push(`0 -${w.top}px 0 0 ${color}`);
        if (w.bottom) shadows.push(`0 ${w.bottom}px 0 0 ${color}`);
        if (w.left) shadows.push(`-${w.left}px 0 0 0 ${color}`);
        if (w.right) shadows.push(`${w.right}px 0 0 0 ${color}`);
        if (shadows.length) css["box-shadow"] = shadows.join(", ");
      } else {
        css["box-shadow"] = `0 0 0 ${node.strokeWeight}px ${color}`;
      }
    } else {
      // CENTER — standard CSS border
      if (node.individualStrokeWeights) {
        const w = node.individualStrokeWeights;
        if (w.top) css["border-top"] = `${w.top}px solid ${color}`;
        if (w.right) css["border-right"] = `${w.right}px solid ${color}`;
        if (w.bottom) css["border-bottom"] = `${w.bottom}px solid ${color}`;
        if (w.left) css["border-left"] = `${w.left}px solid ${color}`;
      } else {
        css["border"] = `${node.strokeWeight}px solid ${color}`;
      }
    }
  }

  // Corner radius
  if (node.rectangleCornerRadii) {
    const [tl, tr, br, bl] = node.rectangleCornerRadii;
    if (tl === tr && tr === br && br === bl) {
      if (tl > 0) css["border-radius"] = `${tl}px`;
    } else {
      css["border-radius"] = `${tl}px ${tr}px ${br}px ${bl}px`;
    }
  } else if (node.cornerRadius && node.cornerRadius > 0) {
    css["border-radius"] = `${node.cornerRadius}px`;
  }

  // Effects → box-shadow (merge with stroke shadows if present)
  const dropShadows = (node.effects ?? [])
    .filter(
      (e) =>
        (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") && e.visible,
    )
    .map(shadowToCSS)
    .filter(Boolean);
  if (dropShadows.length > 0) {
    const existing = css["box-shadow"];
    const combined = existing
      ? `${existing}, ${dropShadows.join(", ")}`
      : dropShadows.join(", ");
    css["box-shadow"] = combined;
  }

  // Blur
  const blur = (node.effects ?? []).find(
    (e) => e.type === "LAYER_BLUR" && e.visible,
  );
  if (blur) css["filter"] = `blur(${blur.radius}px)`;

  const bgBlur = (node.effects ?? []).find(
    (e) => e.type === "BACKGROUND_BLUR" && e.visible,
  );
  if (bgBlur) css["backdrop-filter"] = `blur(${bgBlur.radius}px)`;

  // Node-level blend mode → mix-blend-mode (#11)
  if (
    node.blendMode &&
    node.blendMode !== "PASS_THROUGH" &&
    node.blendMode !== "NORMAL"
  ) {
    const blended = mapBlendMode(node.blendMode);
    if (blended !== "normal") {
      css["mix-blend-mode"] = blended;
    }
  }

  // Opacity (node-level only — per-fill opacity is baked into fill colors)
  if (node.opacity !== undefined && node.opacity < 1) {
    css["opacity"] = node.opacity.toFixed(2);
  }

  // Overflow
  if (node.clipsContent) {
    css["overflow"] = "hidden";
  }

  // Typography
  if (node.type === "TEXT" && node.style) {
    const s = node.style;
    css["font-family"] = `"${s.fontFamily}", sans-serif`;
    css["font-size"] = `${s.fontSize}px`;
    css["font-weight"] = String(s.fontWeight);

    if (s.lineHeightPx) {
      css["line-height"] = `${s.lineHeightPx}px`;
    }
    if (s.letterSpacing) {
      css["letter-spacing"] = `${s.letterSpacing}px`;
    }
    if (s.textAlignHorizontal) {
      css["text-align"] = s.textAlignHorizontal.toLowerCase();
    }
    if (s.textCase === "UPPER") css["text-transform"] = "uppercase";
    if (s.textCase === "LOWER") css["text-transform"] = "lowercase";
    if (s.textCase === "TITLE") css["text-transform"] = "capitalize";
    if (s.italic) css["font-style"] = "italic";
    if (s.textDecoration === "UNDERLINE") css["text-decoration"] = "underline";
    if (s.textDecoration === "STRIKETHROUGH")
      css["text-decoration"] = "line-through";
  }

  return css;
}

export function cssToString(css: CSSProperties): string {
  return Object.entries(css)
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n");
}

export function cssToTailwind(css: CSSProperties): string[] {
  const classes: string[] = [];
  const map: Record<string, () => void> = {
    display: () => {
      if (css["display"] === "flex") classes.push("flex");
    },
    "flex-direction": () => {
      if (css["flex-direction"] === "column") classes.push("flex-col");
      if (css["flex-direction"] === "row") classes.push("flex-row");
    },
    "flex-wrap": () => {
      if (css["flex-wrap"] === "wrap") classes.push("flex-wrap");
    },
    "justify-content": () => {
      const m: Record<string, string> = {
        "flex-start": "justify-start",
        center: "justify-center",
        "flex-end": "justify-end",
        "space-between": "justify-between",
      };
      const val = css["justify-content"];
      if (val && m[val]) classes.push(m[val]);
    },
    "align-items": () => {
      const m: Record<string, string> = {
        "flex-start": "items-start",
        center: "items-center",
        "flex-end": "items-end",
        baseline: "items-baseline",
      };
      const val = css["align-items"];
      if (val && m[val]) classes.push(m[val]);
    },
    gap: () => {
      const val = parseInt(css["gap"]);
      if (val) classes.push(`gap-[${val}px]`);
    },
    width: () => {
      if (css["width"] === "100%") classes.push("w-full");
      else if (css["width"] === "fit-content") classes.push("w-fit");
      else classes.push(`w-[${css["width"]}]`);
    },
    height: () => {
      if (css["height"] === "100%") classes.push("h-full");
      else if (css["height"] === "fit-content") classes.push("h-fit");
      else classes.push(`h-[${css["height"]}]`);
    },
    overflow: () => {
      if (css["overflow"] === "hidden") classes.push("overflow-hidden");
    },
    position: () => {
      if (css["position"] === "absolute") classes.push("absolute");
    },
    "flex-grow": () => {
      if (css["flex-grow"] === "1") classes.push("grow");
    },
    "flex-shrink": () => {
      if (css["flex-shrink"] === "0") classes.push("shrink-0");
    },
    "border-radius": () => {
      const val = css["border-radius"];
      if (val) classes.push(`rounded-[${val}]`);
    },
    opacity: () => {
      const val = parseFloat(css["opacity"]);
      if (!isNaN(val)) classes.push(`opacity-[${val}]`);
    },
    "background-color": () => {
      const val = css["background-color"];
      if (val) classes.push(`bg-[${val.replace(/ /g, "_")}]`);
    },
    color: () => {
      const val = css["color"];
      if (val) classes.push(`text-[${val.replace(/ /g, "_")}]`);
    },
    "box-shadow": () => {
      const val = css["box-shadow"];
      if (val) classes.push(`shadow-[${val.replace(/ /g, "_")}]`);
    },
    filter: () => {
      const val = css["filter"];
      if (val) classes.push(`blur-[${val.match(/\d+/)?.[0] ?? "0"}px]`);
    },
    "backdrop-filter": () => {
      const val = css["backdrop-filter"];
      if (val)
        classes.push(`backdrop-blur-[${val.match(/\d+/)?.[0] ?? "0"}px]`);
    },
    border: () => {
      const val = css["border"];
      if (val) classes.push(`border-[${val.replace(/ /g, "_")}]`);
    },
    "border-top": () => {
      const val = css["border-top"];
      if (val) classes.push(`border-t-[${val.replace(/ /g, "_")}]`);
    },
    "border-right": () => {
      const val = css["border-right"];
      if (val) classes.push(`border-r-[${val.replace(/ /g, "_")}]`);
    },
    "border-bottom": () => {
      const val = css["border-bottom"];
      if (val) classes.push(`border-b-[${val.replace(/ /g, "_")}]`);
    },
    "border-left": () => {
      const val = css["border-left"];
      if (val) classes.push(`border-l-[${val.replace(/ /g, "_")}]`);
    },
    "line-height": () => {
      const val = css["line-height"];
      if (val) classes.push(`leading-[${val}]`);
    },
    "letter-spacing": () => {
      const val = css["letter-spacing"];
      if (val) classes.push(`tracking-[${val}]`);
    },
    "font-family": () => {
      const val = css["font-family"];
      if (val) classes.push(`font-[${val.replace(/[" ]/g, "_")}]`);
    },
    "font-style": () => {
      if (css["font-style"] === "italic") classes.push("italic");
    },
    "text-align": () => {
      const m: Record<string, string> = {
        left: "text-left",
        center: "text-center",
        right: "text-right",
        justify: "text-justify",
      };
      const val = css["text-align"];
      if (val && m[val]) classes.push(m[val]);
    },
    "text-decoration": () => {
      const m: Record<string, string> = {
        underline: "underline",
        "line-through": "line-through",
      };
      const val = css["text-decoration"];
      if (val && m[val]) classes.push(m[val]);
    },
    "text-transform": () => {
      const m: Record<string, string> = {
        uppercase: "uppercase",
        lowercase: "lowercase",
        capitalize: "capitalize",
      };
      const val = css["text-transform"];
      if (val && m[val]) classes.push(m[val]);
    },
    "min-width": () => {
      const val = css["min-width"];
      if (val) classes.push(`min-w-[${val}]`);
    },
    "max-width": () => {
      const val = css["max-width"];
      if (val) classes.push(`max-w-[${val}]`);
    },
    "min-height": () => {
      const val = css["min-height"];
      if (val) classes.push(`min-h-[${val}]`);
    },
    "max-height": () => {
      const val = css["max-height"];
      if (val) classes.push(`max-h-[${val}]`);
    },
    "align-self": () => {
      const m: Record<string, string> = {
        stretch: "self-stretch",
        "flex-start": "self-start",
        center: "self-center",
        "flex-end": "self-end",
      };
      const val = css["align-self"];
      if (val && m[val]) classes.push(m[val]);
    },
    "row-gap": () => {
      const val = parseInt(css["row-gap"]);
      if (val) classes.push(`gap-y-[${val}px]`);
    },
    "column-gap": () => {
      const val = parseInt(css["column-gap"]);
      if (val) classes.push(`gap-x-[${val}px]`);
    },
    "mix-blend-mode": () => {
      const val = css["mix-blend-mode"];
      if (val) classes.push(`mix-blend-${val}`);
    },
  };

  for (const key of Object.keys(css)) {
    if (map[key]) map[key]();
  }

  // Padding shorthand
  if (css["padding"]) {
    classes.push(`p-[${css["padding"].replace(/ /g, "_")}]`);
  }

  // Font
  if (css["font-size"]) classes.push(`text-[${css["font-size"]}]`);
  if (css["font-weight"]) {
    const w = parseInt(css["font-weight"]);
    const m: Record<number, string> = {
      300: "font-light",
      400: "font-normal",
      500: "font-medium",
      600: "font-semibold",
      700: "font-bold",
      800: "font-extrabold",
    };
    classes.push(m[w] ?? `font-[${w}]`);
  }

  return classes;
}

export { colorToHex, colorToRgba };
