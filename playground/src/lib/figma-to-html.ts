import type { FigmaNode, FigmaTypeStyle } from "../types/figma";
import { figmaToCSS, cssToString, cssToTailwind } from "./figma-to-css";

function inferElement(node: FigmaNode, isRoot = false): string {
  // Root frame (page-level) maps to <body>
  if (
    isRoot &&
    (node.type === "FRAME" ||
      node.type === "COMPONENT" ||
      node.type === "INSTANCE")
  ) {
    return "body";
  }

  const name = node.name.toLowerCase();

  if (node.type === "TEXT") {
    const fontSize = node.style?.fontSize ?? 16;
    if (fontSize >= 48) return "h1";
    if (fontSize >= 32) return "h2";
    if (fontSize >= 24) return "h3";
    if (fontSize >= 20) return "h4";
    if (/link/i.test(node.name)) return "a";
    if (/button|cta/i.test(node.name)) return "button";
    return "p";
  }

  if (node.type === "RECTANGLE") {
    const height = node.absoluteBoundingBox?.height ?? 0;
    if (height <= 2) return "hr";
    const hasImageFill = node.fills?.some((f) => f.type === "IMAGE");
    if (hasImageFill) return "img";
    return "div";
  }

  if (node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION") {
    return "svg";
  }

  // Frame-based semantic inference from name
  if (/^header$/i.test(name) || (/header/i.test(name) && isRoot))
    return "header";
  if (/^footer$/i.test(name) || (/footer/i.test(name) && isRoot))
    return "footer";
  if (/^nav$|^navigation$|^links$/i.test(name)) return "nav";
  if (/hero|section/i.test(name)) return "section";
  if (/^button$|^cta$/i.test(name)) return "button";
  if (/^link$/i.test(name)) return "a";
  if (/^img$|^image$/i.test(name)) {
    const hasImageFill = node.fills?.some((f) => f.type === "IMAGE");
    if (hasImageFill) return "img";
  }
  if (/^ul$|^list$/i.test(name)) return "ul";
  if (/^li$|^list.?item$/i.test(name)) return "li";

  return "div";
}

function indent(depth: number): string {
  return "  ".repeat(depth);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Build inline style for a style override diff against the base style. */
function overrideToInlineStyle(
  base: FigmaTypeStyle,
  override: Partial<FigmaTypeStyle>,
): string {
  const parts: string[] = [];
  if (override.fontFamily && override.fontFamily !== base.fontFamily) {
    parts.push(`font-family:"${override.fontFamily}",sans-serif`);
  }
  if (
    override.fontWeight !== undefined &&
    override.fontWeight !== base.fontWeight
  ) {
    parts.push(`font-weight:${override.fontWeight}`);
  }
  if (override.fontSize !== undefined && override.fontSize !== base.fontSize) {
    parts.push(`font-size:${override.fontSize}px`);
  }
  if (override.italic !== undefined && override.italic !== base.italic) {
    parts.push(`font-style:${override.italic ? "italic" : "normal"}`);
  }
  if (
    override.textDecoration &&
    override.textDecoration !== base.textDecoration
  ) {
    if (override.textDecoration === "UNDERLINE")
      parts.push("text-decoration:underline");
    else if (override.textDecoration === "STRIKETHROUGH")
      parts.push("text-decoration:line-through");
  }
  if (
    override.letterSpacing !== undefined &&
    override.letterSpacing !== base.letterSpacing
  ) {
    parts.push(`letter-spacing:${override.letterSpacing}px`);
  }
  return parts.join("; ");
}

/** Build a CSSProperties dict for a style override diff against the base style. */
function overrideToCSS(
  base: FigmaTypeStyle,
  override: Partial<FigmaTypeStyle>,
): import("./figma-to-css").CSSProperties {
  const css: import("./figma-to-css").CSSProperties = {};
  if (override.fontFamily && override.fontFamily !== base.fontFamily) {
    css["font-family"] = `"${override.fontFamily}", sans-serif`;
  }
  if (
    override.fontWeight !== undefined &&
    override.fontWeight !== base.fontWeight
  ) {
    css["font-weight"] = String(override.fontWeight);
  }
  if (override.fontSize !== undefined && override.fontSize !== base.fontSize) {
    css["font-size"] = `${override.fontSize}px`;
  }
  if (override.italic !== undefined && override.italic !== base.italic) {
    css["font-style"] = override.italic ? "italic" : "normal";
  }
  if (
    override.textDecoration &&
    override.textDecoration !== base.textDecoration
  ) {
    if (override.textDecoration === "UNDERLINE")
      css["text-decoration"] = "underline";
    else if (override.textDecoration === "STRIKETHROUGH")
      css["text-decoration"] = "line-through";
  }
  if (
    override.letterSpacing !== undefined &&
    override.letterSpacing !== base.letterSpacing
  ) {
    css["letter-spacing"] = `${override.letterSpacing}px`;
  }
  return css;
}

/** Render text content with characterStyleOverrides as JSX <span> elements.
 *  Each run's override diff is converted to Tailwind className strings. */
function renderTextContentJSX(node: FigmaNode): string {
  const text = node.characters ?? node.name;
  const overrides = node.characterStyleOverrides;
  const table = node.styleOverrideTable;
  const base = node.style;

  if (!overrides?.length || !table || !base) {
    return escapeHtml(text);
  }

  // Group consecutive characters by their style override ID
  const segments: { styleId: number; text: string }[] = [];
  for (let i = 0; i < text.length; i++) {
    const styleId = i < overrides.length ? overrides[i] : 0;
    if (
      segments.length > 0 &&
      segments[segments.length - 1].styleId === styleId
    ) {
      segments[segments.length - 1].text += text[i];
    } else {
      segments.push({ styleId, text: text[i] });
    }
  }

  return segments
    .map((seg) => {
      const escaped = escapeHtml(seg.text);
      if (seg.styleId === 0) return escaped;
      const override = table[String(seg.styleId)];
      if (!override) return escaped;
      const css = overrideToCSS(base, override);
      const classes = cssToTailwind(css);
      if (classes.length === 0) return escaped;
      return `<span className="${classes.join(" ")}">${escaped}</span>`;
    })
    .join("");
}

/** Render text content with characterStyleOverrides as <span> elements (#34). */
function renderTextContent(node: FigmaNode): string {
  const text = node.characters ?? node.name;
  const overrides = node.characterStyleOverrides;
  const table = node.styleOverrideTable;
  const base = node.style;

  if (!overrides?.length || !table || !base) {
    return escapeHtml(text);
  }

  // Group consecutive characters by their style override ID
  const segments: { styleId: number; text: string }[] = [];
  for (let i = 0; i < text.length; i++) {
    const styleId = i < overrides.length ? overrides[i] : 0;
    if (
      segments.length > 0 &&
      segments[segments.length - 1].styleId === styleId
    ) {
      segments[segments.length - 1].text += text[i];
    } else {
      segments.push({ styleId, text: text[i] });
    }
  }

  return segments
    .map((seg) => {
      const escaped = escapeHtml(seg.text);
      if (seg.styleId === 0) return escaped;
      const override = table[String(seg.styleId)];
      if (!override) return escaped;
      const style = overrideToInlineStyle(base, override);
      if (!style) return escaped;
      return `<span style="${style}">${escaped}</span>`;
    })
    .join("");
}

export function nodeToHTML(node: FigmaNode, depth = 0, isRoot = true): string {
  if (node.visible === false) return "";

  const tag = inferElement(node, isRoot);
  const lines: string[] = [];

  if (node.type === "TEXT") {
    const content = renderTextContent(node);
    if (tag === "a") {
      lines.push(`${indent(depth)}<${tag} href="#">${content}</${tag}>`);
    } else {
      lines.push(`${indent(depth)}<${tag}>${content}</${tag}>`);
    }
    return lines.join("\n");
  }

  if (tag === "img") {
    const w = Math.round(node.absoluteBoundingBox?.width ?? 100);
    const h = Math.round(node.absoluteBoundingBox?.height ?? 100);
    lines.push(
      `${indent(depth)}<${tag} src="https://placehold.co/${w}x${h}/e4e4e7/a1a1aa?text=${w}%C3%97${h}" alt="${escapeHtml(node.name)}" width="${w}" height="${h}" />`,
    );
    return lines.join("\n");
  }

  if (tag === "hr") {
    lines.push(`${indent(depth)}<${tag} />`);
    return lines.join("\n");
  }

  if (tag === "svg") {
    lines.push(
      `${indent(depth)}<${tag}><!-- ${escapeHtml(node.name)} --></${tag}>`,
    );
    return lines.join("\n");
  }

  // Container element
  const children = (node.children ?? [])
    .filter((c) => c.visible !== false)
    .map((c) => nodeToHTML(c, depth + 1, false))
    .filter(Boolean);

  if (children.length === 0) {
    lines.push(`${indent(depth)}<${tag}></${tag}>`);
  } else {
    lines.push(`${indent(depth)}<${tag}>`);
    lines.push(...children);
    lines.push(`${indent(depth)}</${tag}>`);
  }

  return lines.join("\n");
}

export function nodeToHTMLWithCSS(
  node: FigmaNode,
  depth = 0,
  isRoot = true,
  parentNode?: FigmaNode,
): string {
  if (node.visible === false) return "";

  const tag = inferElement(node, isRoot);
  const css = figmaToCSS(node, parentNode, isRoot);
  const styleAttr =
    Object.keys(css).length > 0
      ? ` style="${Object.entries(css)
          .map(([k, v]) => `${k}:${v}`)
          .join("; ")}"`
      : "";

  if (node.type === "TEXT") {
    const content = renderTextContent(node);
    return `${indent(depth)}<${tag}${styleAttr}>${content}</${tag}>`;
  }

  if (tag === "img") {
    const w = Math.round(node.absoluteBoundingBox?.width ?? 100);
    const h = Math.round(node.absoluteBoundingBox?.height ?? 100);
    return `${indent(depth)}<${tag}${styleAttr} src="https://placehold.co/${w}x${h}/e4e4e7/a1a1aa?text=${w}%C3%97${h}" alt="${escapeHtml(node.name)}" width="${w}" height="${h}" />`;
  }

  if (tag === "hr" || tag === "svg") {
    return `${indent(depth)}<${tag}${styleAttr} />`;
  }

  const children = (node.children ?? [])
    .filter((c) => c.visible !== false)
    .map((c) => nodeToHTMLWithCSS(c, depth + 1, false, node))
    .filter(Boolean);

  if (children.length === 0) {
    return `${indent(depth)}<${tag}${styleAttr}></${tag}>`;
  }

  return [
    `${indent(depth)}<${tag}${styleAttr}>`,
    ...children,
    `${indent(depth)}</${tag}>`,
  ].join("\n");
}

function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function nodeToReactInner(
  node: FigmaNode,
  depth = 0,
  isRoot = true,
  parentNode?: FigmaNode,
): string {
  if (node.visible === false) return "";

  let tag = inferElement(node, isRoot);
  // Map body → div for React components
  if (tag === "body") tag = "div";

  const css = figmaToCSS(node, parentNode, isRoot);
  const tw = cssToTailwind(css);
  const classAttr = tw.length > 0 ? ` className="${tw.join(" ")}"` : "";

  if (node.type === "TEXT") {
    const content = renderTextContentJSX(node);
    if (tag === "a") {
      return `${indent(depth)}<${tag} href="#"${classAttr}>${content}</${tag}>`;
    }
    return `${indent(depth)}<${tag}${classAttr}>${content}</${tag}>`;
  }

  if (tag === "img") {
    const w = Math.round(node.absoluteBoundingBox?.width ?? 100);
    const h = Math.round(node.absoluteBoundingBox?.height ?? 100);
    return `${indent(depth)}<${tag}${classAttr} src="https://placehold.co/${w}x${h}" alt="${escapeHtml(node.name)}" width={${w}} height={${h}} />`;
  }

  if (tag === "hr" || tag === "svg") {
    return `${indent(depth)}<${tag}${classAttr} />`;
  }

  const children = (node.children ?? [])
    .filter((c) => c.visible !== false)
    .map((c) => nodeToReactInner(c, depth + 1, false, node))
    .filter(Boolean);

  if (children.length === 0) {
    return `${indent(depth)}<${tag}${classAttr} />`;
  }

  return [
    `${indent(depth)}<${tag}${classAttr}>`,
    ...children,
    `${indent(depth)}</${tag}>`,
  ].join("\n");
}

export function nodeToReact(node: FigmaNode): string {
  const componentName = toPascalCase(node.name) || "Component";
  const jsx = nodeToReactInner(node, 2, true);

  return `export default function ${componentName}() {\n  return (\n${jsx}\n  );\n}`;
}

export { inferElement };
