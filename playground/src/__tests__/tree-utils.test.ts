import { describe, it, expect } from "vitest";
import {
  extractRootNode,
  flattenTree,
  findNodeById,
  searchNodes,
  countNodes,
} from "../lib/tree-utils";
import type { FigmaNode, FigmaFileResponse } from "../types/figma";

function makeNode(
  overrides: Partial<FigmaNode> & { id: string; name: string; type: string },
): FigmaNode {
  return overrides as FigmaNode;
}

const tree: FigmaNode = makeNode({
  id: "0:0",
  name: "Page",
  type: "CANVAS",
  children: [
    makeNode({
      id: "1:0",
      name: "Header",
      type: "FRAME",
      children: [
        makeNode({ id: "1:1", name: "Logo", type: "RECTANGLE" }),
        makeNode({ id: "1:2", name: "Nav", type: "FRAME" }),
      ],
    }),
    makeNode({ id: "2:0", name: "Footer", type: "FRAME" }),
  ],
});

describe("extractRootNode", () => {
  it("extracts from node-specific response", () => {
    const resp: FigmaFileResponse = {
      name: "Test",
      lastModified: "2024-01-01",
      nodes: { "1:0": { document: tree.children![0] } },
    };
    const root = extractRootNode(resp);
    expect(root?.id).toBe("1:0");
  });

  it("extracts from full-file response", () => {
    // Full-file responses omit `nodes`; `document` holds the root tree.
    const resp = {
      name: "Test",
      lastModified: "2024-01-01",
      document: tree,
    } as any;
    const root = extractRootNode(resp);
    expect(root?.id).toBe("0:0");
  });

  it("returns null for empty nodes", () => {
    const resp: FigmaFileResponse = {
      name: "Test",
      lastModified: "2024-01-01",
      nodes: {},
    };
    expect(extractRootNode(resp)).toBeNull();
  });
});

describe("flattenTree", () => {
  it("flattens all nodes depth-first", () => {
    const flat = flattenTree(tree);
    expect(flat).toHaveLength(5);
    expect(flat.map((f) => f.node.id)).toEqual([
      "0:0",
      "1:0",
      "1:1",
      "1:2",
      "2:0",
    ]);
  });

  it("tracks depth correctly", () => {
    const flat = flattenTree(tree);
    expect(flat[0].depth).toBe(0);
    expect(flat[1].depth).toBe(1);
    expect(flat[2].depth).toBe(2);
  });
});

describe("findNodeById", () => {
  it("finds root node", () => {
    expect(findNodeById(tree, "0:0")?.name).toBe("Page");
  });

  it("finds deeply nested node", () => {
    expect(findNodeById(tree, "1:2")?.name).toBe("Nav");
  });

  it("returns null for missing id", () => {
    expect(findNodeById(tree, "99:99")).toBeNull();
  });
});

describe("searchNodes", () => {
  it("matches by name (case-insensitive)", () => {
    const matches = searchNodes(tree, "header");
    expect(matches.has("1:0")).toBe(true);
  });

  it("matches by type", () => {
    const matches = searchNodes(tree, "RECTANGLE");
    expect(matches.has("1:1")).toBe(true);
  });

  it("returns empty set for no matches", () => {
    const matches = searchNodes(tree, "nonexistent");
    expect(matches.size).toBe(0);
  });
});

describe("countNodes", () => {
  it("counts all nodes in tree", () => {
    expect(countNodes(tree)).toBe(5);
  });

  it("counts leaf node as 1", () => {
    expect(countNodes(makeNode({ id: "x", name: "x", type: "TEXT" }))).toBe(1);
  });
});
