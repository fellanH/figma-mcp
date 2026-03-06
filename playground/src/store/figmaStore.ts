import { create } from "zustand";
import type { FigmaNode, FigmaFileResponse, SampleFile } from "../types/figma";
import { extractRootNode } from "../lib/tree-utils";

export type PreviewTab = "html" | "css" | "tailwind" | "live";

interface FigmaStore {
  // Data
  fileResponse: FigmaFileResponse | null;
  rootNode: FigmaNode | null;
  fileName: string;

  // Selection
  selectedNodeId: string | null;
  selectedNode: FigmaNode | null;

  // UI State
  expandedNodes: Set<string>;
  searchQuery: string;
  previewTab: PreviewTab;
  showRawJson: boolean;

  // Actions
  loadFile: (data: FigmaFileResponse) => void;
  selectNode: (id: string, node: FigmaNode) => void;
  toggleNode: (id: string) => void;
  expandNode: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setPreviewTab: (tab: PreviewTab) => void;
  toggleRawJson: () => void;
  expandAll: () => void;
  collapseAll: () => void;
}

function collectAllIds(node: FigmaNode): string[] {
  const ids = [node.id];
  node.children?.forEach((c) => ids.push(...collectAllIds(c)));
  return ids;
}

export const useFigmaStore = create<FigmaStore>((set, get) => ({
  fileResponse: null,
  rootNode: null,
  fileName: "",
  selectedNodeId: null,
  selectedNode: null,
  expandedNodes: new Set<string>(),
  searchQuery: "",
  previewTab: "html",
  showRawJson: false,

  loadFile: (data) => {
    const root = extractRootNode(data);
    const initialExpanded = new Set<string>();
    if (root) {
      initialExpanded.add(root.id);
      root.children?.forEach((c) => initialExpanded.add(c.id));
    }
    set({
      fileResponse: data,
      rootNode: root,
      fileName: data.name,
      selectedNodeId: root?.id ?? null,
      selectedNode: root,
      expandedNodes: initialExpanded,
      searchQuery: "",
    });
  },

  selectNode: (id, node) => set({ selectedNodeId: id, selectedNode: node }),

  toggleNode: (id) => {
    const expanded = new Set(get().expandedNodes);
    if (expanded.has(id)) {
      expanded.delete(id);
    } else {
      expanded.add(id);
    }
    set({ expandedNodes: expanded });
  },

  expandNode: (id) => {
    const expanded = new Set(get().expandedNodes);
    expanded.add(id);
    set({ expandedNodes: expanded });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setPreviewTab: (tab) => set({ previewTab: tab }),
  toggleRawJson: () => set({ showRawJson: !get().showRawJson }),

  expandAll: () => {
    const root = get().rootNode;
    if (!root) return;
    set({ expandedNodes: new Set(collectAllIds(root)) });
  },

  collapseAll: () => {
    const root = get().rootNode;
    if (!root) return;
    set({ expandedNodes: new Set([root.id]) });
  },
}));

export const SAMPLE_FILES: SampleFile[] = [
  { name: "Hyperplane – Home", path: "/samples/13_hyperplane_home.json" },
  { name: "Home Frame (Full)", path: "/samples/02_home_frame_full.json" },
  { name: "File Structure", path: "/samples/01_file_structure_raw.json" },
  { name: "Content Frame", path: "/samples/03_content_frame.json" },
  { name: "Sections", path: "/samples/04_sections_all.json" },
  { name: "Styles", path: "/samples/05_styles_raw.json" },
  { name: "Components", path: "/samples/06_components_raw.json" },
];
