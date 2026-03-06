import type {
  FigmaNode,
  FigmaColor,
  FigmaFill,
  FigmaEffect,
} from "../types/figma";
import type { DecisionPoint } from "./decision-gates";

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
function fillToBgLayer(
  fill: FigmaFill,
  node?: FigmaNode,
  imageUrlMap?: Record<string, string>,
): string | undefined {
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

  if (fill.type === "GRADIENT_RADIAL" && fill.gradientStops) {
    const stops = fill.gradientStops
      .map((s) => {
        const c = { ...s.color, a: s.color.a * fillOpacity };
        return `${colorToRgba(c)} ${Math.round(s.position * 100)}%`;
      })
      .join(", ");

    // gradientHandlePositions[0] = center, [1] = edge along x-radius,
    // [2] = edge along y-radius (if present)
    let position = "50% 50%";
    let shape = "ellipse";
    if (
      fill.gradientHandlePositions &&
      fill.gradientHandlePositions.length >= 2
    ) {
      const [center, edgeX, edgeY] = fill.gradientHandlePositions;
      const cx = Math.round(center.x * 100);
      const cy = Math.round(center.y * 100);
      position = `${cx}% ${cy}%`;

      // Compute radii in normalised space
      const rx = Math.sqrt(
        Math.pow(edgeX.x - center.x, 2) + Math.pow(edgeX.y - center.y, 2),
      );
      if (edgeY) {
        const ry = Math.sqrt(
          Math.pow(edgeY.x - center.x, 2) + Math.pow(edgeY.y - center.y, 2),
        );
        // If radii are equal enough treat as circle
        shape =
          Math.abs(rx - ry) < 0.01
            ? "circle"
            : `ellipse ${(rx * 100).toFixed(1)}% ${(ry * 100).toFixed(1)}%`;
      } else {
        shape = `circle ${(rx * 100).toFixed(1)}%`;
      }
    }
    return `radial-gradient(${shape} at ${position}, ${stops})`;
  }

  if (fill.type === "GRADIENT_ANGULAR" && fill.gradientStops) {
    // CSS conic-gradient goes 0 → 360 deg; Figma stops are 0 → 1 mapped to 0 → 360.
    // The starting angle comes from the vector between handle[0] (center) and handle[1].
    let fromAngle = "0deg";
    let position = "50% 50%";
    if (
      fill.gradientHandlePositions &&
      fill.gradientHandlePositions.length >= 2
    ) {
      const [center, startHandle] = fill.gradientHandlePositions;
      const dx = startHandle.x - center.x;
      const dy = startHandle.y - center.y;
      // atan2 gives angle from positive-x axis; CSS conic-gradient starts at top (12 o'clock)
      const rad = Math.atan2(dy, dx);
      const deg = Math.round((rad * 180) / Math.PI + 90);
      fromAngle = `${((deg % 360) + 360) % 360}deg`;
      const cx = Math.round(center.x * 100);
      const cy = Math.round(center.y * 100);
      position = `${cx}% ${cy}%`;
    }
    const stops = fill.gradientStops
      .map((s) => {
        const c = { ...s.color, a: s.color.a * fillOpacity };
        return `${colorToRgba(c)} ${Math.round(s.position * 360)}deg`;
      })
      .join(", ");
    return `conic-gradient(from ${fromAngle} at ${position}, ${stops})`;
  }

  // GRADIENT_DIAMOND has no direct CSS equivalent — approximate with a radial gradient.
  if (fill.type === "GRADIENT_DIAMOND" && fill.gradientStops) {
    const stops = fill.gradientStops
      .map((s) => {
        const c = { ...s.color, a: s.color.a * fillOpacity };
        return `${colorToRgba(c)} ${Math.round(s.position * 100)}%`;
      })
      .join(", ");
    let position = "50% 50%";
    if (
      fill.gradientHandlePositions &&
      fill.gradientHandlePositions.length >= 1
    ) {
      const center = fill.gradientHandlePositions[0];
      const cx = Math.round(center.x * 100);
      const cy = Math.round(center.y * 100);
      position = `${cx}% ${cy}%`;
    }
    // Use an ellipse radial approximation — closest CSS equivalent for diamond shape
    return `radial-gradient(ellipse at ${position}, ${stops})`;
  }

  if (fill.type === "IMAGE") {
    // Use resolved Figma CDN URL when available
    if (fill.imageRef && imageUrlMap?.[fill.imageRef]) {
      return `url("${imageUrlMap[fill.imageRef]}")`;
    }
    // Fallback to placeholder SVG
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
  childIndex?: number,
  imageUrlMap?: Record<string, string>,
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

  // Position: relative on parent when any child uses absolute positioning (#1)
  const hasAbsoluteChild = (node.children ?? []).some(
    (c) => c.layoutPositioning === "ABSOLUTE" && c.visible !== false,
  );
  if (hasAbsoluteChild && !css["position"]) {
    css["position"] = "relative";
  }

  // Absolute positioning with offset computation (#1) + constraints (#3)
  if (node.layoutPositioning === "ABSOLUTE") {
    css["position"] = "absolute";

    const parentBbox = parentNode?.absoluteBoundingBox;
    const childBbox = node.absoluteBoundingBox;

    if (parentBbox && childBbox) {
      const constraints = node.constraints;
      const hConstraint = constraints?.horizontal ?? "MIN";
      const vConstraint = constraints?.vertical ?? "MIN";

      // Horizontal constraint
      switch (hConstraint) {
        case "MIN":
          css["left"] = `${Math.round(childBbox.x - parentBbox.x)}px`;
          break;
        case "MAX":
          css["right"] =
            `${Math.round(parentBbox.x + parentBbox.width - (childBbox.x + childBbox.width))}px`;
          break;
        case "CENTER": {
          const centerOffset = Math.round(
            childBbox.x -
              parentBbox.x -
              (parentBbox.width - childBbox.width) / 2,
          );
          if (Math.abs(centerOffset) < 1) {
            css["left"] = "50%";
            css["margin-left"] = `-${Math.round(childBbox.width / 2)}px`;
          } else {
            css["left"] = `${Math.round(childBbox.x - parentBbox.x)}px`;
          }
          break;
        }
        case "STRETCH":
          css["left"] = `${Math.round(childBbox.x - parentBbox.x)}px`;
          css["right"] =
            `${Math.round(parentBbox.x + parentBbox.width - (childBbox.x + childBbox.width))}px`;
          // Width is driven by left+right, remove explicit width
          delete css["width"];
          break;
        case "SCALE": {
          const leftPct =
            ((childBbox.x - parentBbox.x) / parentBbox.width) * 100;
          const widthPct = (childBbox.width / parentBbox.width) * 100;
          css["left"] = `${leftPct.toFixed(1)}%`;
          css["width"] = `${widthPct.toFixed(1)}%`;
          break;
        }
      }

      // Vertical constraint
      switch (vConstraint) {
        case "MIN":
          css["top"] = `${Math.round(childBbox.y - parentBbox.y)}px`;
          break;
        case "MAX":
          css["bottom"] =
            `${Math.round(parentBbox.y + parentBbox.height - (childBbox.y + childBbox.height))}px`;
          break;
        case "CENTER": {
          const centerOffset = Math.round(
            childBbox.y -
              parentBbox.y -
              (parentBbox.height - childBbox.height) / 2,
          );
          if (Math.abs(centerOffset) < 1) {
            css["top"] = "50%";
            css["margin-top"] = `-${Math.round(childBbox.height / 2)}px`;
          } else {
            css["top"] = `${Math.round(childBbox.y - parentBbox.y)}px`;
          }
          break;
        }
        case "STRETCH":
          css["top"] = `${Math.round(childBbox.y - parentBbox.y)}px`;
          css["bottom"] =
            `${Math.round(parentBbox.y + parentBbox.height - (childBbox.y + childBbox.height))}px`;
          delete css["height"];
          break;
        case "SCALE": {
          const topPct =
            ((childBbox.y - parentBbox.y) / parentBbox.height) * 100;
          const heightPct = (childBbox.height / parentBbox.height) * 100;
          css["top"] = `${topPct.toFixed(1)}%`;
          css["height"] = `${heightPct.toFixed(1)}%`;
          break;
        }
      }
    }

    // Z-index based on child order (#8) — last child = highest z-index
    if (childIndex !== undefined) {
      css["z-index"] = String(childIndex);
    }
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
      const layer = fillToBgLayer(fill, node, imageUrlMap);
      if (!layer) continue;

      // Solid colors need gradient form to participate in multi-layer backgrounds
      if (fill.type === "SOLID" && reversed.length > 1) {
        bgLayers.push(`linear-gradient(${layer}, ${layer})`);
      } else {
        bgLayers.push(layer);
      }

      blendModes.push(mapBlendMode(fill.blendMode));

      if (fill.type === "IMAGE") {
        switch (fill.scaleMode) {
          case "FILL":
            bgSize = "cover";
            break;
          case "FIT":
            bgSize = "contain";
            css["background-repeat"] = "no-repeat";
            css["background-position"] = "center";
            break;
          case "TILE":
            bgSize = undefined; // natural size, repeating
            css["background-repeat"] = "repeat";
            break;
          case "CROP":
          default:
            bgSize = "cover";
            break;
        }
      }
    }

    if (bgLayers.length === 1 && visibleFills[0]?.type === "SOLID") {
      // TEXT nodes use color, not background-color
      if (node.type === "TEXT") {
        css["color"] = fillToBgLayer(visibleFills[0], node, imageUrlMap) ?? "";
      } else {
        css["background-color"] =
          fillToBgLayer(visibleFills[0], node, imageUrlMap) ?? "";
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

  // Transform / Rotation (#5)
  // Figma rotation is counter-clockwise in degrees; CSS rotate() is clockwise — negate.
  // If a full relativeTransform matrix is present and is non-trivial (has skew/scale beyond
  // a pure rotation), emit a CSS matrix() to preserve the full affine transform.
  if (node.relativeTransform) {
    const [[a, b, tx], [c, d, ty]] = node.relativeTransform;
    // Detect pure rotation (no skew, scale ≈ 1): |a|≈|d| and b≈-c and scale≈1
    const scale = Math.sqrt(a * a + c * c);
    const isPureRotation =
      Math.abs(scale - 1) < 0.001 &&
      Math.abs(a - d) < 0.001 &&
      Math.abs(b + c) < 0.001;

    if (isPureRotation) {
      // Use simple rotate() — negate because Figma is CCW, CSS is CW
      const deg = -Math.round(Math.atan2(c, a) * (180 / Math.PI));
      if (deg !== 0) {
        css["transform"] = `rotate(${deg}deg)`;
        css["transform-origin"] = "center";
      }
    } else {
      // Complex matrix: Figma [[a,b,tx],[c,d,ty]] → CSS matrix(a,c,b,d,tx,ty)
      const fmt = (n: number) => parseFloat(n.toFixed(4));
      css["transform"] =
        `matrix(${fmt(a)},${fmt(c)},${fmt(b)},${fmt(d)},${fmt(tx)},${fmt(ty)})`;
      css["transform-origin"] = "center";
    }
  } else if (node.rotation !== undefined && node.rotation !== 0) {
    // Fallback: rotation-only property (no matrix available)
    const deg = -Math.round(node.rotation);
    css["transform"] = `rotate(${deg}deg)`;
    css["transform-origin"] = "center";
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

    // Paragraph spacing (#14) — applied as margin-bottom on the text block
    if (s.paragraphSpacing && s.paragraphSpacing > 0) {
      css["margin-bottom"] = `${s.paragraphSpacing}px`;
    }

    // Text vertical alignment (#14)
    if (s.textAlignVertical) {
      // For fixed-height text containers, vertical alignment maps to flexbox
      if (s.textAlignVertical === "CENTER") {
        css["display"] = "flex";
        css["align-items"] = "center";
      } else if (s.textAlignVertical === "BOTTOM") {
        css["display"] = "flex";
        css["align-items"] = "flex-end";
      }
      // TOP is default — no extra CSS needed
    }

    // Text truncation (#7)
    if (s.textTruncation === "ENDING") {
      const lines = s.maxLines ?? 1;
      if (lines <= 1) {
        // Single-line ellipsis
        css["overflow"] = "hidden";
        css["text-overflow"] = "ellipsis";
        css["white-space"] = "nowrap";
      } else {
        // Multi-line clamp
        css["display"] = "-webkit-box";
        css["-webkit-line-clamp"] = String(lines);
        css["-webkit-box-orient"] = "vertical";
        css["overflow"] = "hidden";
      }
    }

    // textAutoResize sizing (#7)
    if (node.textAutoResize) {
      switch (node.textAutoResize) {
        case "WIDTH_AND_HEIGHT":
          // Shrink-wrap: size is driven by content — no forced dimensions
          // (already handled by HUG sizing; ensure no clipping)
          css["white-space"] = css["white-space"] ?? "nowrap";
          break;
        case "HEIGHT":
          // Fixed width, height grows with content — allow wrapping
          css["white-space"] = css["white-space"] ?? "normal";
          css["word-break"] = "break-word";
          break;
        case "NONE":
          // Fixed box — content may clip
          css["overflow"] = css["overflow"] ?? "hidden";
          css["white-space"] = css["white-space"] ?? "normal";
          break;
        case "TRUNCATE":
          // Fixed box with single-line truncation (legacy Figma value)
          css["overflow"] = "hidden";
          css["text-overflow"] = "ellipsis";
          css["white-space"] = "nowrap";
          break;
      }
    }
  }

  return css;
}

export function cssToString(css: CSSProperties): string {
  return Object.entries(css)
    .map(([k, v]) => `${k}: ${v};`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Tailwind design-scale lookup maps
// Snap pixel/percentage values to idiomatic Tailwind tokens; fall back to
// arbitrary values only when no exact match exists.
// ---------------------------------------------------------------------------

/** Tailwind default spacing scale: px value → token (e.g. 16 → "4"). */
const TW_SPACING: Record<number, string> = {
  0: "0",
  1: "px",
  2: "0.5",
  4: "1",
  6: "1.5",
  8: "2",
  10: "2.5",
  12: "3",
  14: "3.5",
  16: "4",
  20: "5",
  24: "6",
  28: "7",
  32: "8",
  36: "9",
  40: "10",
  44: "11",
  48: "12",
  52: "13",
  56: "14",
  60: "15",
  64: "16",
  72: "18",
  80: "20",
  96: "24",
  112: "28",
  128: "32",
  144: "36",
  160: "40",
  176: "44",
  192: "48",
  208: "52",
  224: "56",
  240: "60",
  256: "64",
  288: "72",
  320: "80",
  384: "96",
};

/** Tailwind default font-size scale: px value → token (e.g. 14 → "sm"). */
const TW_FONT_SIZE: Record<number, string> = {
  12: "xs",
  14: "sm",
  16: "base",
  18: "lg",
  20: "xl",
  24: "2xl",
  30: "3xl",
  36: "4xl",
  48: "5xl",
  60: "6xl",
  72: "7xl",
  96: "8xl",
  128: "9xl",
};

/** Tailwind default border-radius scale: px value → token (e.g. 8 → "lg"). */
const TW_BORDER_RADIUS: Record<number, string> = {
  0: "none",
  2: "sm",
  4: "md",
  6: "lg",
  8: "xl",
  12: "2xl",
  16: "3xl",
};

/** Resolve a px spacing value to a Tailwind spacing token, or return undefined. */
function snapSpacing(px: number): string | undefined {
  return TW_SPACING[px];
}

/** Resolve a px font-size to a Tailwind text-size token, or return undefined. */
function snapFontSize(px: number): string | undefined {
  return TW_FONT_SIZE[px];
}

/** Resolve a px border-radius to a Tailwind rounded token, or return undefined. */
function snapBorderRadius(px: number): string | undefined {
  return TW_BORDER_RADIUS[px];
}

/**
 * Resolve a CSS padding shorthand string to Tailwind padding classes.
 * Handles: "16px", "16px 8px", "16px 8px 4px 2px".
 * Returns an array of class strings.
 */
function snapPadding(val: string): string[] {
  const parts = val.split(/\s+/).map((p) => {
    const px = parseFloat(p);
    return { px, token: isNaN(px) ? undefined : snapSpacing(px), raw: p };
  });

  if (parts.length === 1) {
    // Uniform padding: p-{token}
    const { px, token } = parts[0];
    if (token !== undefined) return [`p-${token}`];
    return [`p-[${px}px]`];
  }

  if (parts.length === 2) {
    // py px
    const [y, x] = parts;
    const yClass = y.token !== undefined ? `py-${y.token}` : `py-[${y.px}px]`;
    const xClass = x.token !== undefined ? `px-${x.token}` : `px-[${x.px}px]`;
    if (y.token !== undefined && x.token !== undefined) {
      // If both tokens are the same, just return py + px or unified p-
      if (y.token === x.token) return [`p-${y.token}`];
    }
    return [yClass, xClass];
  }

  if (parts.length === 4) {
    // top right bottom left
    const [t, r, b, l] = parts;
    const allSame =
      t.token !== undefined &&
      t.token === r.token &&
      r.token === b.token &&
      b.token === l.token;
    if (allSame) return [`p-${t.token}`];

    const yMatch = t.token !== undefined && t.token === b.token;
    const xMatch = r.token !== undefined && r.token === l.token;
    if (yMatch && xMatch) {
      const yClass = t.token !== undefined ? `py-${t.token}` : `py-[${t.px}px]`;
      const xClass = r.token !== undefined ? `px-${r.token}` : `px-[${r.px}px]`;
      return [yClass, xClass];
    }

    // Individual sides
    return [
      t.token !== undefined ? `pt-${t.token}` : `pt-[${t.px}px]`,
      r.token !== undefined ? `pr-${r.token}` : `pr-[${r.px}px]`,
      b.token !== undefined ? `pb-${b.token}` : `pb-[${b.px}px]`,
      l.token !== undefined ? `pl-${l.token}` : `pl-[${l.px}px]`,
    ];
  }

  // Fallback: arbitrary
  return [`p-[${val.replace(/ /g, "_")}]`];
}

/**
 * Resolve a CSS dimension value (e.g. "24px", "100%", "fit-content") to a
 * Tailwind sizing token for the given prefix ("w", "h", "min-w", etc.).
 */
function snapDimension(val: string, prefix: string): string {
  if (val === "100%") return `${prefix}-full`;
  if (val === "fit-content") return `${prefix}-fit`;
  if (val === "0" || val === "0px") return `${prefix}-0`;
  const px = parseFloat(val);
  if (!isNaN(px)) {
    const token = snapSpacing(px);
    if (token !== undefined) return `${prefix}-${token}`;
  }
  return `${prefix}-[${val}]`;
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
      const raw = css["gap"];
      if (!raw) return;
      const px = parseInt(raw);
      const token = !isNaN(px) ? snapSpacing(px) : undefined;
      classes.push(token !== undefined ? `gap-${token}` : `gap-[${raw}]`);
    },
    width: () => {
      const val = css["width"];
      if (val) classes.push(snapDimension(val, "w"));
    },
    height: () => {
      const val = css["height"];
      if (val) classes.push(snapDimension(val, "h"));
    },
    overflow: () => {
      if (css["overflow"] === "hidden") classes.push("overflow-hidden");
    },
    position: () => {
      if (css["position"] === "absolute") classes.push("absolute");
      if (css["position"] === "relative") classes.push("relative");
    },
    top: () => {
      const val = css["top"];
      if (val === "50%") {
        classes.push("top-1/2");
      } else if (val) {
        classes.push(snapDimension(val, "top"));
      }
    },
    left: () => {
      const val = css["left"];
      if (val === "50%") {
        classes.push("left-1/2");
      } else if (val) {
        classes.push(snapDimension(val, "left"));
      }
    },
    right: () => {
      const val = css["right"];
      if (val) classes.push(snapDimension(val, "right"));
    },
    bottom: () => {
      const val = css["bottom"];
      if (val) classes.push(snapDimension(val, "bottom"));
    },
    "z-index": () => {
      const val = css["z-index"];
      if (val) classes.push(`z-[${val}]`);
    },
    "margin-left": () => {
      const val = css["margin-left"];
      if (val) classes.push(`ml-[${val}]`);
    },
    "margin-top": () => {
      const val = css["margin-top"];
      if (val) classes.push(`mt-[${val}]`);
    },
    "margin-bottom": () => {
      const val = css["margin-bottom"];
      if (val) {
        const px = parseInt(val);
        const token = !isNaN(px) ? snapSpacing(px) : undefined;
        classes.push(token !== undefined ? `mb-${token}` : `mb-[${val}]`);
      }
    },
    "flex-grow": () => {
      if (css["flex-grow"] === "1") classes.push("grow");
    },
    "flex-shrink": () => {
      if (css["flex-shrink"] === "0") classes.push("shrink-0");
    },
    "border-radius": () => {
      const val = css["border-radius"];
      if (!val) return;
      // Single value like "8px" → snap to token
      const singlePx = val.match(/^(\d+(?:\.\d+)?)px$/);
      if (singlePx) {
        const px = parseFloat(singlePx[1]);
        if (px === 9999 || px >= 9999) {
          classes.push("rounded-full");
          return;
        }
        const token = snapBorderRadius(px);
        classes.push(
          token !== undefined ? `rounded-${token}` : `rounded-[${val}]`,
        );
        return;
      }
      // Multi-value shorthand — fall through to arbitrary
      classes.push(`rounded-[${val.replace(/ /g, "_")}]`);
    },
    opacity: () => {
      const val = parseFloat(css["opacity"]);
      if (!isNaN(val)) classes.push(`opacity-[${val}]`);
    },
    "background-color": () => {
      const val = css["background-color"];
      if (val) classes.push(`bg-[${val.replace(/ /g, "_")}]`);
    },
    "background-size": () => {
      const val = css["background-size"];
      if (val === "cover") classes.push("bg-cover");
      else if (val === "contain") classes.push("bg-contain");
      else if (val) classes.push(`bg-[size:${val.replace(/ /g, "_")}]`);
    },
    "background-repeat": () => {
      const val = css["background-repeat"];
      if (val === "no-repeat") classes.push("bg-no-repeat");
      else if (val === "repeat") classes.push("bg-repeat");
    },
    "background-position": () => {
      const val = css["background-position"];
      if (val === "center") classes.push("bg-center");
      else if (val) classes.push(`bg-[position:${val.replace(/ /g, "_")}]`);
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
      if (val) classes.push(snapDimension(val, "min-w"));
    },
    "max-width": () => {
      const val = css["max-width"];
      if (val) classes.push(snapDimension(val, "max-w"));
    },
    "min-height": () => {
      const val = css["min-height"];
      if (val) classes.push(snapDimension(val, "min-h"));
    },
    "max-height": () => {
      const val = css["max-height"];
      if (val) classes.push(snapDimension(val, "max-h"));
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
      const raw = css["row-gap"];
      if (!raw) return;
      const px = parseInt(raw);
      const token = !isNaN(px) ? snapSpacing(px) : undefined;
      classes.push(token !== undefined ? `gap-y-${token}` : `gap-y-[${raw}]`);
    },
    "column-gap": () => {
      const raw = css["column-gap"];
      if (!raw) return;
      const px = parseInt(raw);
      const token = !isNaN(px) ? snapSpacing(px) : undefined;
      classes.push(token !== undefined ? `gap-x-${token}` : `gap-x-[${raw}]`);
    },
    "mix-blend-mode": () => {
      const val = css["mix-blend-mode"];
      if (val) classes.push(`mix-blend-${val}`);
    },
    "text-overflow": () => {
      if (css["text-overflow"] === "ellipsis") {
        // Handled combinatorially in the white-space handler below
      }
    },
    "white-space": () => {
      const ws = css["white-space"];
      const isEllipsis = css["text-overflow"] === "ellipsis";
      const isHidden = css["overflow"] === "hidden";
      if (ws === "nowrap" && isEllipsis && isHidden) {
        // Single-line truncate — Tailwind `truncate` covers all three props
        classes.push("truncate");
      } else if (ws === "nowrap") {
        classes.push("whitespace-nowrap");
      } else if (ws === "normal") {
        classes.push("whitespace-normal");
      }
    },
    "word-break": () => {
      if (css["word-break"] === "break-word") classes.push("break-words");
    },
    "-webkit-line-clamp": () => {
      const n = parseInt(css["-webkit-line-clamp"] ?? "");
      if (!isNaN(n) && n > 0) classes.push(`line-clamp-${n}`);
    },
    transform: () => {
      const val = css["transform"];
      if (!val) return;
      // Pure rotate: rotate(Ndeg) → rotate-[Ndeg]
      const rotateMatch = val.match(/^rotate\((-?\d+(?:\.\d+)?deg)\)$/);
      if (rotateMatch) {
        classes.push(`rotate-[${rotateMatch[1]}]`);
      } else {
        // Complex matrix or other transform → arbitrary value
        classes.push(`[transform:${val.replace(/ /g, "_")}]`);
      }
    },
    "transform-origin": () => {
      const val = css["transform-origin"];
      if (val === "center") classes.push("origin-center");
      else if (val) classes.push(`origin-[${val.replace(/ /g, "_")}]`);
    },
  };

  for (const key of Object.keys(css)) {
    if (map[key]) map[key]();
  }

  // Padding shorthand — snap to Tailwind spacing tokens
  if (css["padding"]) {
    classes.push(...snapPadding(css["padding"]));
  }

  // Font size — snap to Tailwind text-size tokens
  if (css["font-size"]) {
    const fsPx = parseFloat(css["font-size"]);
    const fsToken = !isNaN(fsPx) ? snapFontSize(fsPx) : undefined;
    classes.push(
      fsToken !== undefined ? `text-${fsToken}` : `text-[${css["font-size"]}]`,
    );
  }
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

/** Collect all unique font families used in a node subtree (#10). */
export function collectFonts(node: FigmaNode): string[] {
  const fonts = new Set<string>();

  function walk(n: FigmaNode) {
    if (n.visible === false) return;
    if (n.type === "TEXT" && n.style?.fontFamily) {
      fonts.add(n.style.fontFamily);
    }
    // Also check style overrides for different fonts in mixed-style text
    if (n.styleOverrideTable) {
      for (const override of Object.values(n.styleOverrideTable)) {
        if (override.fontFamily) fonts.add(override.fontFamily);
      }
    }
    for (const child of n.children ?? []) {
      walk(child);
    }
  }

  walk(node);
  return [...fonts].sort();
}

/** Build a Google Fonts @import URL for the given font families. */
export function googleFontsImport(families: string[]): string {
  if (families.length === 0) return "";
  // Filter out system/generic fonts
  const systemFonts = new Set([
    "system-ui",
    "sans-serif",
    "serif",
    "monospace",
    "cursive",
    "fantasy",
    "Arial",
    "Helvetica",
    "Times New Roman",
    "Courier New",
    "Georgia",
    "Verdana",
    "Tahoma",
  ]);
  const googleFonts = families.filter((f) => !systemFonts.has(f));
  if (googleFonts.length === 0) return "";
  const params = googleFonts
    .map(
      (f) =>
        `family=${f.replace(/ /g, "+")}:wght@100;200;300;400;500;600;700;800;900`,
    )
    .join("&");
  return `@import url('https://fonts.googleapis.com/css2?${params}&display=swap');`;
}

// ---------------------------------------------------------------------------
// @font-face declaration generator
// ---------------------------------------------------------------------------

/**
 * Generate @font-face declarations for fonts with "generate-font-face" decision.
 * Returns a CSS string with @font-face blocks and hosting guidance comments.
 */
export function generateFontFaceDeclarations(
  decisionPoints: DecisionPoint[],
  decisions: Map<string, string>,
): string {
  const fontFaceBlocks: string[] = [];

  for (const point of decisionPoints) {
    if (point.type !== "unknown-font") continue;
    const choice = decisions.get(point.key) ?? point.defaultOptionId;
    if (choice !== "generate-font-face") continue;

    const fontFamily = point.metadata?.fontFamily ?? point.nodeName;
    const safeName = fontFamily.replace(/\s+/g, "");
    const slug = fontFamily.toLowerCase().replace(/\s+/g, "-");

    const weights = [
      { weight: 300, style: "normal", suffix: "Light" },
      { weight: 400, style: "normal", suffix: "Regular" },
      { weight: 500, style: "normal", suffix: "Medium" },
      { weight: 600, style: "normal", suffix: "SemiBold" },
      { weight: 700, style: "normal", suffix: "Bold" },
    ];

    fontFaceBlocks.push(
      `/* ─── ${fontFamily} ───\n` +
        ` * TODO: Add font files for "${fontFamily}"\n` +
        ` *\n` +
        ` * Sources to check:\n` +
        ` *   - Adobe Fonts: https://fonts.adobe.com/\n` +
        ` *   - Fontsource:  https://fontsource.org/fonts/${slug}\n` +
        ` *   - Google Fonts: https://fonts.google.com/?query=${encodeURIComponent(fontFamily)}\n` +
        ` *   - Commercial:  Check the font foundry for licensing\n` +
        ` *\n` +
        ` * Place .woff2 files in ./fonts/ and update the src paths below.\n` +
        ` */`,
    );

    for (const { weight, style, suffix } of weights) {
      fontFaceBlocks.push(
        `@font-face {\n` +
          `  font-family: "${fontFamily}";\n` +
          `  font-weight: ${weight};\n` +
          `  font-style: ${style};\n` +
          `  font-display: swap;\n` +
          `  src: url("./fonts/${safeName}-${suffix}.woff2") format("woff2");\n` +
          `}`,
      );
    }
  }

  return fontFaceBlocks.join("\n\n");
}

export { colorToHex, colorToRgba };
