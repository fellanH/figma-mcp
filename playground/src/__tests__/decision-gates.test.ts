import { describe, it, expect } from "vitest";
import { scanDecisionPoints, getDecision } from "../lib/decision-gates";
import type { FigmaNode } from "../types/figma";

function makeNode(
  overrides: Partial<FigmaNode> & { id: string; name: string; type: string },
): FigmaNode {
  return overrides as FigmaNode;
}

describe("scanDecisionPoints", () => {
  it("detects diamond gradient", () => {
    const node = makeNode({
      id: "1:0",
      name: "Bg",
      type: "FRAME",
      fills: [{ type: "GRADIENT_DIAMOND", blendMode: "NORMAL" }],
    });
    const points = scanDecisionPoints(node);
    expect(points).toHaveLength(1);
    expect(points[0].type).toBe("diamond-gradient");
  });

  it("detects unsupported node types", () => {
    const node = makeNode({
      id: "1:0",
      name: "Widget",
      type: "WIDGET",
    });
    const points = scanDecisionPoints(node);
    expect(points.some((p) => p.type === "unsupported-node")).toBe(true);
  });

  it("detects image fills with summary decision", () => {
    const node = makeNode({
      id: "0:0",
      name: "Root",
      type: "FRAME",
      children: [
        makeNode({
          id: "1:0",
          name: "Img1",
          type: "RECTANGLE",
          fills: [{ type: "IMAGE", blendMode: "NORMAL", imageRef: "ref1" }],
        }),
        makeNode({
          id: "2:0",
          name: "Img2",
          type: "RECTANGLE",
          fills: [{ type: "IMAGE", blendMode: "NORMAL", imageRef: "ref2" }],
        }),
      ],
    });
    const points = scanDecisionPoints(node);
    const imagePt = points.find((p) => p.type === "image-fill");
    expect(imagePt).toBeDefined();
    expect(imagePt!.key).toBe("__all__::image-fill");
  });

  it("detects unknown fonts", () => {
    const node = makeNode({
      id: "1:0",
      name: "Title",
      type: "TEXT",
      style: {
        fontFamily: "CustomBrandFont",
        fontWeight: 400,
        fontSize: 16,
        letterSpacing: 0,
      },
    });
    const points = scanDecisionPoints(node);
    expect(points.some((p) => p.type === "unknown-font")).toBe(true);
  });

  it("does not flag known Google Fonts", () => {
    const node = makeNode({
      id: "1:0",
      name: "Title",
      type: "TEXT",
      style: {
        fontFamily: "Inter",
        fontWeight: 400,
        fontSize: 16,
        letterSpacing: 0,
      },
    });
    const points = scanDecisionPoints(node);
    expect(points.some((p) => p.type === "unknown-font")).toBe(false);
  });

  it("auto-resolves scale constraints inside auto-layout", () => {
    const parent = makeNode({
      id: "0:0",
      name: "Container",
      type: "FRAME",
      layoutMode: "HORIZONTAL",
      children: [
        makeNode({
          id: "1:0",
          name: "Child",
          type: "FRAME",
          constraints: { horizontal: "SCALE", vertical: "MIN" },
        }),
      ],
    });
    const points = scanDecisionPoints(parent);
    expect(points.some((p) => p.type === "scale-constraint")).toBe(false);
  });

  it("detects component instances with variant props", () => {
    const node = makeNode({
      id: "1:0",
      name: "Button",
      type: "INSTANCE",
      componentId: "comp:1",
      componentProperties: {
        Variant: { value: "primary", type: "VARIANT" },
      },
    });
    // "Button" matches shadcn mapping, so it should surface
    const points = scanDecisionPoints(node);
    expect(points.some((p) => p.type === "component-instance")).toBe(true);
  });

  it("skips invisible nodes", () => {
    const node = makeNode({
      id: "0:0",
      name: "Root",
      type: "FRAME",
      children: [
        makeNode({
          id: "1:0",
          name: "Hidden",
          type: "WIDGET",
          visible: false,
        }),
      ],
    });
    const points = scanDecisionPoints(node);
    expect(points.some((p) => p.type === "unsupported-node")).toBe(false);
  });
});

describe("getDecision", () => {
  it("returns chosen option when set", () => {
    const decisions = new Map([["1:0::diamond-gradient", "skip"]]);
    expect(getDecision(decisions, "1:0", "diamond-gradient")).toBe("skip");
  });

  it("returns default when not set", () => {
    const decisions = new Map<string, string>();
    expect(getDecision(decisions, "1:0", "diamond-gradient")).toBe(
      "radial-approx",
    );
  });
});
