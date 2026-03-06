import { create } from "zustand";
import type { FigmaNode, FigmaFileResponse, SampleFile } from "../types/figma";
import { extractRootNode } from "../lib/tree-utils";
import type { DecisionPoint } from "../lib/decision-gates";

export type PreviewTab = "html" | "css" | "tailwind" | "react" | "live";
export type ViewportPreset = "mobile" | "tablet" | "desktop" | "full";
export type BgMode = "dark" | "light" | "checker";

interface FigmaStore {
  // Data
  fileResponse: FigmaFileResponse | null;
  rootNode: FigmaNode | null;
  fileName: string;

  // Figma file key + image URL resolution
  fileKey: string | null;
  imageUrlMap: Record<string, string>;
  imageUrlsLoading: boolean;

  // Selection
  selectedNodeId: string | null;
  selectedNode: FigmaNode | null;

  // UI State
  expandedNodes: Set<string>;
  searchQuery: string;
  previewTab: PreviewTab;
  showRawJson: boolean;
  zoom: number;
  viewportPreset: ViewportPreset;
  bgMode: BgMode;

  // Decision gates
  decisionPoints: DecisionPoint[];
  decisions: Map<string, string>;
  showDecisionPanel: boolean;

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
  setZoom: (zoom: number) => void;
  setViewportPreset: (preset: ViewportPreset) => void;
  setBgMode: (mode: BgMode) => void;
  setDecisionPoints: (points: DecisionPoint[]) => void;
  setDecision: (key: string, optionId: string) => void;
  toggleDecisionPanel: () => void;
  setFileKey: (key: string | null) => void;
  setImageUrlMap: (map: Record<string, string>) => void;
  setImageUrlsLoading: (loading: boolean) => void;
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
  fileKey: null,
  imageUrlMap: {},
  imageUrlsLoading: false,
  selectedNodeId: null,
  selectedNode: null,
  expandedNodes: new Set<string>(),
  searchQuery: "",
  previewTab: "html",
  showRawJson: false,
  zoom: 100,
  viewportPreset: "full",
  bgMode: "dark",
  decisionPoints: [],
  decisions: new Map<string, string>(),
  showDecisionPanel: false,

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
  setZoom: (zoom) => set({ zoom: Math.max(25, Math.min(200, zoom)) }),
  setViewportPreset: (preset) => set({ viewportPreset: preset }),
  setBgMode: (mode) => set({ bgMode: mode }),
  setDecisionPoints: (points) => set({ decisionPoints: points }),
  setDecision: (key, optionId) => {
    const decisions = new Map(get().decisions);
    decisions.set(key, optionId);
    set({ decisions });
  },
  toggleDecisionPanel: () =>
    set({ showDecisionPanel: !get().showDecisionPanel }),

  setFileKey: (key) => set({ fileKey: key }),
  setImageUrlMap: (map) => set({ imageUrlMap: map }),
  setImageUrlsLoading: (loading) => set({ imageUrlsLoading: loading }),

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
