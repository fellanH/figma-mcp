import type { FigmaNode, FigmaFileResponse } from "../types/figma";

export interface FlatNode {
  node: FigmaNode;
  depth: number;
  path: string[];
}

export function extractRootNode(data: FigmaFileResponse): FigmaNode | null {
  // Node-specific endpoint: { nodes: { "id": { document: ... } } }
  if (data.nodes) {
    const nodeKeys = Object.keys(data.nodes);
    if (nodeKeys.length === 0) return null;
    return data.nodes[nodeKeys[0]].document;
  }
  // Full-file endpoint: { document: { children: [...] } }
  if ((data as any).document) {
    return (data as any).document;
  }
  return null;
}

export function flattenTree(
  node: FigmaNode,
  depth = 0,
  path: string[] = [],
): FlatNode[] {
  const currentPath = [...path, node.name];
  const result: FlatNode[] = [{ node, depth, path: currentPath }];

  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenTree(child, depth + 1, currentPath));
    }
  }

  return result;
}

export function searchNodes(node: FigmaNode, query: string): Set<string> {
  const matches = new Set<string>();
  const q = query.toLowerCase();

  function walk(n: FigmaNode) {
    if (
      n.name.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q) ||
      n.id.includes(q)
    ) {
      matches.add(n.id);
    }
    n.children?.forEach(walk);
  }

  walk(node);
  return matches;
}

export function getAncestorIds(
  root: FigmaNode,
  targetIds: Set<string>,
): Set<string> {
  const ancestors = new Set<string>();

  function walk(node: FigmaNode, parentIds: string[]): boolean {
    let hasMatch = targetIds.has(node.id);

    if (node.children) {
      for (const child of node.children) {
        if (walk(child, [...parentIds, node.id])) {
          hasMatch = true;
        }
      }
    }

    if (hasMatch) {
      for (const id of parentIds) {
        ancestors.add(id);
      }
      ancestors.add(node.id);
    }

    return hasMatch;
  }

  walk(root, []);
  return ancestors;
}

export function findNodeById(root: FigmaNode, id: string): FigmaNode | null {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

export function countNodes(node: FigmaNode): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

export function getNodeTypeIcon(type: string): string {
  switch (type) {
    case "TEXT":
      return "\u2605";
    case "RECTANGLE":
      return "\u25A0";
    case "ELLIPSE":
      return "\u25CF";
    case "VECTOR":
      return "\u25C6";
    case "BOOLEAN_OPERATION":
      return "\u25C8";
    case "GROUP":
      return "\u25A1";
    case "COMPONENT":
      return "\u25C7";
    case "INSTANCE":
      return "\u25C8";
    default:
      return "\u25B8";
  }
}

export function getSizingBadge(node: FigmaNode): { h?: string; v?: string } {
  return {
    h: node.layoutSizingHorizontal,
    v: node.layoutSizingVertical,
  };
}
