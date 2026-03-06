export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaGradientStop {
  color: FigmaColor;
  position: number;
}

export interface FigmaFill {
  type:
    | "SOLID"
    | "GRADIENT_LINEAR"
    | "GRADIENT_RADIAL"
    | "GRADIENT_ANGULAR"
    | "GRADIENT_DIAMOND"
    | "IMAGE";
  blendMode: string;
  color?: FigmaColor;
  opacity?: number;
  gradientStops?: FigmaGradientStop[];
  gradientHandlePositions?: { x: number; y: number }[];
  scaleMode?: string;
  imageRef?: string;
  visible?: boolean;
}

export interface FigmaStroke {
  type: string;
  color?: FigmaColor;
  blendMode?: string;
  opacity?: number;
}

export interface FigmaEffect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  visible: boolean;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  radius: number;
  spread?: number;
  blendMode?: string;
}

export interface FigmaTypeStyle {
  fontFamily: string;
  fontPostScriptName?: string;
  fontWeight: number;
  fontSize: number;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
  letterSpacing: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  lineHeightPercentFontSize?: number;
  lineHeightUnit?: string;
  textCase?: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
  textDecoration?: string;
  italic?: boolean;
  // Text truncation
  textTruncation?: "DISABLED" | "ENDING";
  maxLines?: number;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];

  // Dimensions
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  absoluteRenderBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Auto layout
  layoutMode?: "HORIZONTAL" | "VERTICAL" | "NONE";
  layoutWrap?: "NO_WRAP" | "WRAP";
  itemSpacing?: number;
  counterAxisSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
  primaryAxisSizingMode?: "FIXED" | "AUTO";
  counterAxisSizingMode?: "FIXED" | "AUTO";

  // Sizing
  layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
  layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
  layoutGrow?: number;
  layoutAlign?: "INHERIT" | "STRETCH" | "MIN" | "CENTER" | "MAX";
  layoutPositioning?: "AUTO" | "ABSOLUTE";
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;

  // Visual
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  individualStrokeWeights?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  strokeAlign?: "INSIDE" | "OUTSIDE" | "CENTER";
  effects?: FigmaEffect[];
  opacity?: number;
  clipsContent?: boolean;

  // Corner radius
  cornerRadius?: number;
  rectangleCornerRadii?: [number, number, number, number];

  // Typography
  characters?: string;
  style?: FigmaTypeStyle;
  characterStyleOverrides?: number[];
  styleOverrideTable?: Record<string, Partial<FigmaTypeStyle>>;
  // Text auto-resize mode (TEXT nodes)
  textAutoResize?: "NONE" | "HEIGHT" | "WIDTH_AND_HEIGHT" | "TRUNCATE";

  // Constraints
  constraints?: {
    vertical: string;
    horizontal: string;
  };

  // Transform
  rotation?: number; // degrees, counter-clockwise (Figma convention)
  relativeTransform?: [[number, number, number], [number, number, number]]; // 2x3 affine matrix

  // Blend
  blendMode?: string;

  // Scroll
  scrollBehavior?: string;

  // Component
  componentId?: string;
  componentProperties?: Record<string, unknown>;
}

export interface FigmaFileResponse {
  name: string;
  lastModified: string;
  thumbnailUrl?: string;
  version?: string;
  nodes: Record<string, { document: FigmaNode }>;
}

export interface SampleFile {
  name: string;
  path: string;
}
