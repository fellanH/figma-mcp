import { describe, it, expect } from "vitest";
import { inferElement, nodeToHTML, nodeToReact } from "../lib/figma-to-html";
import type { FigmaNode } from "../types/figma";

function makeNode(
  overrides: Partial<FigmaNode> & { id: string; name: string; type: string },
): FigmaNode {
  return overrides as FigmaNode;
}

describe("inferElement", () => {
  it("returns h1 for large text", () => {
    const node = makeNode({
      id: "1:0",
      name: "Title",
      type: "TEXT",
      style: {
        fontFamily: "Inter",
        fontSize: 48,
        fontWeight: 700,
        letterSpacing: 0,
      },
    });
    expect(inferElement(node, false)).toBe("h1");
  });

  it("returns h2 for medium text", () => {
    const node = makeNode({
      id: "1:0",
      name: "Subtitle",
      type: "TEXT",
      style: {
        fontFamily: "Inter",
        fontSize: 32,
        fontWeight: 600,
        letterSpacing: 0,
      },
    });
    expect(inferElement(node, false)).toBe("h2");
  });

  it("returns p for small text", () => {
    const node = makeNode({
      id: "1:0",
      name: "Body",
      type: "TEXT",
      style: {
        fontFamily: "Inter",
        fontSize: 16,
        fontWeight: 400,
        letterSpacing: 0,
      },
    });
    expect(inferElement(node, false)).toBe("p");
  });

  it("returns header for frame named Header", () => {
    const node = makeNode({ id: "1:0", name: "Header", type: "FRAME" });
    expect(inferElement(node, false)).toBe("header");
  });

  it("returns nav for frame named Navigation", () => {
    const node = makeNode({ id: "1:0", name: "Navigation", type: "FRAME" });
    expect(inferElement(node, false)).toBe("nav");
  });

  it("returns button for frame named Button", () => {
    const node = makeNode({ id: "1:0", name: "Button", type: "FRAME" });
    expect(inferElement(node, false)).toBe("button");
  });

  it("prevents nesting of non-nestable tags", () => {
    const node = makeNode({ id: "1:0", name: "Button", type: "FRAME" });
    const ancestors = new Set(["button"]);
    expect(inferElement(node, false, ancestors)).toBe("div");
  });

  it("returns div for root frame", () => {
    const node = makeNode({ id: "1:0", name: "Page", type: "FRAME" });
    expect(inferElement(node, true)).toBe("div");
  });

  it("returns svg for VECTOR type", () => {
    const node = makeNode({ id: "1:0", name: "Icon", type: "VECTOR" });
    expect(inferElement(node, false)).toBe("svg");
  });

  it("returns img for RECTANGLE with image fill", () => {
    const node = makeNode({
      id: "1:0",
      name: "Photo",
      type: "RECTANGLE",
      fills: [{ type: "IMAGE", blendMode: "NORMAL" }],
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 150 },
    });
    expect(inferElement(node, false)).toBe("img");
  });

  it("returns hr for thin rectangle", () => {
    const node = makeNode({
      id: "1:0",
      name: "Divider",
      type: "RECTANGLE",
      absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 1 },
    });
    expect(inferElement(node, false)).toBe("hr");
  });
});

describe("nodeToHTML", () => {
  it("wraps root in HTML document", () => {
    const node = makeNode({
      id: "1:0",
      name: "Page",
      type: "FRAME",
      children: [
        makeNode({
          id: "1:1",
          name: "Hello",
          type: "TEXT",
          characters: "Hello World",
          style: {
            fontFamily: "Inter",
            fontSize: 16,
            fontWeight: 400,
            letterSpacing: 0,
          },
        }),
      ],
    });
    const html = nodeToHTML(node);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("Hello World");
  });

  it("skips invisible nodes", () => {
    const node = makeNode({
      id: "1:0",
      name: "Page",
      type: "FRAME",
      children: [
        makeNode({
          id: "1:1",
          name: "Hidden",
          type: "TEXT",
          visible: false,
          characters: "Secret",
        }),
      ],
    });
    const html = nodeToHTML(node);
    expect(html).not.toContain("Secret");
  });

  it("generates class attributes", () => {
    const node = makeNode({
      id: "1:0",
      name: "Card",
      type: "FRAME",
      children: [
        makeNode({
          id: "1:1",
          name: "Title",
          type: "TEXT",
          characters: "Hi",
          style: {
            fontFamily: "Inter",
            fontSize: 16,
            fontWeight: 400,
            letterSpacing: 0,
          },
        }),
      ],
    });
    const html = nodeToHTML(node);
    expect(html).toContain('class="card"');
    expect(html).toContain('class="title"');
  });
});

describe("nodeToReact", () => {
  it("generates a React component", () => {
    const node = makeNode({
      id: "1:0",
      name: "Hero Section",
      type: "FRAME",
      children: [
        makeNode({
          id: "1:1",
          name: "Title",
          type: "TEXT",
          characters: "Welcome",
          style: {
            fontFamily: "Inter",
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: 0,
          },
        }),
      ],
    });
    const react = nodeToReact(node);
    expect(react).toContain("export default function HeroSection");
    expect(react).toContain("Welcome");
  });

  it("uses PascalCase for component name", () => {
    const node = makeNode({ id: "1:0", name: "my cool widget", type: "FRAME" });
    const react = nodeToReact(node);
    expect(react).toContain("MyCoolWidget");
  });

  it("generates self-closing tags for img", () => {
    const node = makeNode({
      id: "1:0",
      name: "Page",
      type: "FRAME",
      children: [
        makeNode({
          id: "1:1",
          name: "Photo",
          type: "RECTANGLE",
          fills: [{ type: "IMAGE", blendMode: "NORMAL" }],
          absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 150 },
        }),
      ],
    });
    const react = nodeToReact(node);
    expect(react).toContain("img");
    expect(react).toContain("/>");
  });
});
