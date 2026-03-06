import { describe, it, expect } from "vitest";
import {
  figmaToCSS,
  cssToString,
  cssToTailwind,
  colorToHex,
  colorToRgba,
  collectFonts,
  googleFontsImport,
  generateFontFaceDeclarations,
} from "../lib/figma-to-css";
import type { FigmaNode, FigmaColor } from "../types/figma";
import type { DecisionPoint } from "../lib/decision-gates";

function makeNode(
  overrides: Partial<FigmaNode> & { id: string; name: string; type: string },
): FigmaNode {
  return overrides as FigmaNode;
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

describe("colorToHex", () => {
  it("converts opaque color", () => {
    expect(colorToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe("#ff0000");
  });

  it("converts semi-transparent color", () => {
    const hex = colorToHex({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(hex).toBe("#00000080");
  });

  it("converts white", () => {
    expect(colorToHex({ r: 1, g: 1, b: 1, a: 1 })).toBe("#ffffff");
  });
});

describe("colorToRgba", () => {
  it("converts opaque color to rgb()", () => {
    expect(colorToRgba({ r: 1, g: 0, b: 0, a: 1 })).toBe("rgb(255, 0, 0)");
  });

  it("converts transparent color to rgba()", () => {
    const result = colorToRgba({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(result).toBe("rgba(0, 0, 0, 0.50)");
  });
});

// ---------------------------------------------------------------------------
// figmaToCSS
// ---------------------------------------------------------------------------

describe("figmaToCSS", () => {
  it("generates flexbox for auto-layout", () => {
    const node = makeNode({
      id: "1:0",
      name: "Row",
      type: "FRAME",
      layoutMode: "HORIZONTAL",
      itemSpacing: 8,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 12,
      primaryAxisAlignItems: "CENTER",
      counterAxisAlignItems: "CENTER",
    });
    const css = figmaToCSS(node, undefined, true);
    expect(css["display"]).toBe("flex");
    expect(css["flex-direction"]).toBe("row");
    expect(css["gap"]).toBe("8px");
    expect(css["padding"]).toBeDefined();
    expect(css["justify-content"]).toBe("center");
    expect(css["align-items"]).toBe("center");
  });

  it("generates vertical flex for VERTICAL layout", () => {
    const node = makeNode({
      id: "1:0",
      name: "Col",
      type: "FRAME",
      layoutMode: "VERTICAL",
      itemSpacing: 16,
    });
    const css = figmaToCSS(node, undefined, true);
    expect(css["display"]).toBe("flex");
    expect(css["flex-direction"]).toBe("column");
  });

  it("generates solid background color", () => {
    const node = makeNode({
      id: "1:0",
      name: "Box",
      type: "FRAME",
      fills: [
        {
          type: "SOLID",
          blendMode: "NORMAL",
          color: { r: 1, g: 0, b: 0, a: 1 },
        },
      ],
    });
    const css = figmaToCSS(node, undefined, true);
    // Single solid fill on a non-TEXT node → background-color
    expect(css["background-color"]).toContain("rgb(255, 0, 0)");
  });

  it("generates typography styles for text nodes", () => {
    const node = makeNode({
      id: "1:0",
      name: "Title",
      type: "TEXT",
      style: {
        fontFamily: "Inter",
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: 0,
        lineHeightPx: 32,
      },
    });
    const css = figmaToCSS(node, undefined, false);
    expect(css["font-family"]).toContain("Inter");
    expect(css["font-size"]).toBe("24px");
    expect(css["font-weight"]).toBe("700");
  });

  it("generates drop shadow", () => {
    const node = makeNode({
      id: "1:0",
      name: "Card",
      type: "FRAME",
      effects: [
        {
          type: "DROP_SHADOW",
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 8,
        },
      ],
    });
    const css = figmaToCSS(node, undefined, true);
    expect(css["box-shadow"]).toBeDefined();
    expect(css["box-shadow"]).toContain("0px 4px 8px");
  });

  it("generates border-radius", () => {
    const node = makeNode({
      id: "1:0",
      name: "Pill",
      type: "FRAME",
      cornerRadius: 24,
    });
    const css = figmaToCSS(node, undefined, true);
    expect(css["border-radius"]).toBe("24px");
  });

  it("generates per-corner border-radius", () => {
    const node = makeNode({
      id: "1:0",
      name: "Card",
      type: "FRAME",
      rectangleCornerRadii: [8, 8, 0, 0],
    });
    const css = figmaToCSS(node, undefined, true);
    expect(css["border-radius"]).toBe("8px 8px 0px 0px");
  });

  it("generates opacity", () => {
    const node = makeNode({
      id: "1:0",
      name: "Faded",
      type: "FRAME",
      opacity: 0.5,
    });
    const css = figmaToCSS(node, undefined, true);
    // opacity uses toFixed(2): 0.5 → "0.50"
    expect(css["opacity"]).toBe("0.50");
  });

  it("generates overflow hidden for clipsContent", () => {
    const node = makeNode({
      id: "1:0",
      name: "Clip",
      type: "FRAME",
      clipsContent: true,
    });
    const css = figmaToCSS(node, undefined, true);
    expect(css["overflow"]).toBe("hidden");
  });

  it("generates border from strokes", () => {
    const node = makeNode({
      id: "1:0",
      name: "Bordered",
      type: "FRAME",
      strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
      strokeWeight: 1,
    });
    const css = figmaToCSS(node, undefined, true);
    expect(css["border"]).toBeDefined();
  });

  it("sets width and height for non-root frame with FIXED sizing", () => {
    const node = makeNode({
      id: "1:0",
      name: "Box",
      type: "FRAME",
      layoutSizingHorizontal: "FIXED",
      layoutSizingVertical: "FIXED",
      absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
    });
    // isRoot=false so sizing is applied
    const css = figmaToCSS(node, undefined, false);
    expect(css["width"]).toBe("1440px");
    expect(css["height"]).toBe("900px");
  });
});

// ---------------------------------------------------------------------------
// cssToString
// ---------------------------------------------------------------------------

describe("cssToString", () => {
  it("converts properties to CSS string", () => {
    const result = cssToString({ display: "flex", gap: "8px" });
    expect(result).toContain("display: flex;");
    expect(result).toContain("gap: 8px;");
  });

  it("returns empty string for empty object", () => {
    expect(cssToString({})).toBe("");
  });
});

// ---------------------------------------------------------------------------
// cssToTailwind
// ---------------------------------------------------------------------------

describe("cssToTailwind", () => {
  it("maps display flex", () => {
    const classes = cssToTailwind({ display: "flex" });
    expect(classes).toContain("flex");
  });

  it("maps flex-direction column", () => {
    const classes = cssToTailwind({ "flex-direction": "column" });
    expect(classes).toContain("flex-col");
  });

  it("maps common gap values", () => {
    const classes = cssToTailwind({ gap: "8px" });
    expect(classes).toContain("gap-2");
  });

  it("maps justify-content center", () => {
    const classes = cssToTailwind({ "justify-content": "center" });
    expect(classes).toContain("justify-center");
  });

  it("maps border-radius to rounded", () => {
    const classes = cssToTailwind({ "border-radius": "8px" });
    expect(classes.some((c) => c.startsWith("rounded"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Font utilities
// ---------------------------------------------------------------------------

describe("collectFonts", () => {
  it("collects unique font families from tree", () => {
    const node = makeNode({
      id: "0:0",
      name: "Root",
      type: "FRAME",
      children: [
        makeNode({
          id: "1:0",
          name: "T1",
          type: "TEXT",
          style: {
            fontFamily: "Inter",
            fontWeight: 400,
            fontSize: 16,
            letterSpacing: 0,
          },
        }),
        makeNode({
          id: "2:0",
          name: "T2",
          type: "TEXT",
          style: {
            fontFamily: "Inter",
            fontWeight: 700,
            fontSize: 24,
            letterSpacing: 0,
          },
        }),
        makeNode({
          id: "3:0",
          name: "T3",
          type: "TEXT",
          style: {
            fontFamily: "Roboto",
            fontWeight: 400,
            fontSize: 14,
            letterSpacing: 0,
          },
        }),
      ],
    });
    const fonts = collectFonts(node);
    expect(fonts).toEqual(["Inter", "Roboto"]);
  });
});

describe("googleFontsImport", () => {
  it("generates a Google Fonts import URL", () => {
    const url = googleFontsImport(["Inter", "Roboto"]);
    expect(url).toContain("fonts.googleapis.com");
    expect(url).toContain("Inter");
    expect(url).toContain("Roboto");
  });

  it("returns empty string for empty array", () => {
    expect(googleFontsImport([])).toBe("");
  });

  it("returns empty string for system-only fonts", () => {
    expect(googleFontsImport(["Arial", "Helvetica"])).toBe("");
  });
});

describe("generateFontFaceDeclarations", () => {
  it("generates @font-face CSS for unknown-font decision with generate-font-face choice", () => {
    const decisionPoints: DecisionPoint[] = [
      {
        key: "1:0::unknown-font",
        nodeId: "1:0",
        nodeName: "CustomFont",
        type: "unknown-font",
        message: "Font 'CustomFont' is not a known web font.",
        options: [
          {
            id: "generate-font-face",
            label: "Generate @font-face",
            description: "Generate @font-face declarations",
          },
          {
            id: "fallback",
            label: "Use fallback",
            description: "Use system font fallback",
          },
        ],
        defaultOptionId: "generate-font-face",
        metadata: { fontFamily: "CustomFont" },
      },
    ];
    const decisions = new Map<string, string>([
      ["1:0::unknown-font", "generate-font-face"],
    ]);
    const css = generateFontFaceDeclarations(decisionPoints, decisions);
    expect(css).toContain("@font-face");
    expect(css).toContain("CustomFont");
  });

  it("returns empty string when no decisions match generate-font-face", () => {
    const decisionPoints: DecisionPoint[] = [
      {
        key: "1:0::unknown-font",
        nodeId: "1:0",
        nodeName: "CustomFont",
        type: "unknown-font",
        message: "Font 'CustomFont' is not a known web font.",
        options: [
          {
            id: "generate-font-face",
            label: "Generate @font-face",
            description: "Generate @font-face declarations",
          },
          {
            id: "fallback",
            label: "Use fallback",
            description: "Use system font fallback",
          },
        ],
        defaultOptionId: "generate-font-face",
        metadata: { fontFamily: "CustomFont" },
      },
    ];
    const decisions = new Map<string, string>([
      ["1:0::unknown-font", "fallback"],
    ]);
    const css = generateFontFaceDeclarations(decisionPoints, decisions);
    expect(css).toBe("");
  });

  it("returns empty string for empty decision points", () => {
    const css = generateFontFaceDeclarations([], new Map());
    expect(css).toBe("");
  });
});
