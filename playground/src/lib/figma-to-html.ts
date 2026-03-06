import type { FigmaNode, FigmaTypeStyle } from "../types/figma";
import { figmaToCSS, cssToString, cssToTailwind } from "./figma-to-css";

/** Convert a Figma node name to a kebab-case CSS class name. */
function nodeNameToKebab(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Walk the subtree depth-first and assign unique kebab-case class names. */
function buildClassMap(node: FigmaNode): Map<string, string> {
  const map = new Map<string, string>();
  const seen = new Map<string, number>();

  function walk(n: FigmaNode) {
    if (n.visible === false) return;
    let base = nodeNameToKebab(n.name);
    if (!base) base = "node";
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const className = count === 1 ? base : `${base}-${count}`;
    map.set(n.id, className);
    for (const child of n.children ?? []) {
      walk(child);
    }
  }

  walk(node);
  return map;
}

// Tags that must not nest inside themselves (invalid HTML)
const NO_NEST_TAGS = new Set([
  "header",
  "footer",
  "nav",
  "button",
  "a",
  "main",
]);

function inferElement(
  node: FigmaNode,
  isRoot: boolean,
  ancestorTags?: Set<string>,
): string {
  const blocked = ancestorTags ?? new Set<string>();

  function pick(tag: string): string {
    return blocked.has(tag) ? "div" : tag;
  }

  // Root frame: always <div> — the document wrapper is added by the caller
  if (
    isRoot &&
    (node.type === "FRAME" ||
      node.type === "COMPONENT" ||
      node.type === "INSTANCE")
  ) {
    return "div";
  }

  const name = node.name.toLowerCase();

  if (node.type === "TEXT") {
    const fontSize = node.style?.fontSize ?? 16;
    if (fontSize >= 48) return "h1";
    if (fontSize >= 32) return "h2";
    if (fontSize >= 24) return "h3";
    if (fontSize >= 20) return "h4";
    if (/\blink\b/i.test(node.name)) return pick("a");
    if (/button|cta|btn/i.test(node.name)) return pick("button");
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

  // Frame-based semantic inference from name — substring/contains patterns
  // Guarded by ancestor check to prevent nesting violations
  if (/header/i.test(name)) return pick("header");
  if (/footer/i.test(name)) return pick("footer");
  if (/nav|navigation|menu/i.test(name)) return pick("nav");
  if (/hero|section/i.test(name)) return "section";
  if (/button|cta|btn/i.test(name)) return pick("button");
  if (/\blink\b/i.test(name)) return pick("a");
  if (/^img$|^image$/i.test(name)) {
    const hasImageFill = node.fills?.some((f) => f.type === "IMAGE");
    if (hasImageFill) return "img";
  }
  if (/\blist\b|^ul$/i.test(name)) return "ul";
  if (/list.?item|^li$/i.test(name)) return "li";

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

/** Build the next ancestor tag set — adds the current tag if it's non-nestable. */
function nextAncestors(current: Set<string>, tag: string): Set<string> {
  if (NO_NEST_TAGS.has(tag)) {
    const next = new Set(current);
    next.add(tag);
    return next;
  }
  return current;
}

// ─── HTML tab (semantic HTML with class names) ────────────────────────

export function nodeToHTML(
  node: FigmaNode,
  depth = 0,
  isRoot = true,
  classMap?: Map<string, string>,
  ancestorTags?: Set<string>,
): string {
  if (node.visible === false) return "";

  // Build class map once at root
  if (!classMap) classMap = buildClassMap(node);
  const ancestors = ancestorTags ?? new Set<string>();

  const tag = inferElement(node, isRoot, ancestors);
  const className = classMap.get(node.id);
  const classAttr = className ? ` class="${className}"` : "";

  if (node.type === "TEXT") {
    const content = renderTextContent(node);
    if (tag === "a") {
      return `${indent(depth)}<${tag} href="#"${classAttr}>${content}</${tag}>`;
    }
    return `${indent(depth)}<${tag}${classAttr}>${content}</${tag}>`;
  }

  if (tag === "img") {
    const w = Math.round(node.absoluteBoundingBox?.width ?? 100);
    const h = Math.round(node.absoluteBoundingBox?.height ?? 100);
    return `${indent(depth)}<${tag}${classAttr} src="https://placehold.co/${w}x${h}/e4e4e7/a1a1aa?text=${w}%C3%97${h}" alt="${escapeHtml(node.name)}" width="${w}" height="${h}" />`;
  }

  if (tag === "hr") {
    return `${indent(depth)}<${tag}${classAttr} />`;
  }

  if (tag === "svg") {
    return `${indent(depth)}<${tag}${classAttr}><!-- ${escapeHtml(node.name)} --></${tag}>`;
  }

  // Container element
  const childAncestors = nextAncestors(ancestors, tag);
  const children = (node.children ?? [])
    .filter((c) => c.visible !== false)
    .map((c) => nodeToHTML(c, depth + 1, false, classMap, childAncestors))
    .filter(Boolean);

  if (children.length === 0) {
    return `${indent(depth)}<${tag}${classAttr}></${tag}>`;
  }

  const body = [
    `${indent(depth)}<${tag}${classAttr}>`,
    ...children,
    `${indent(depth)}</${tag}>`,
  ].join("\n");

  // Wrap root in HTML document structure
  if (isRoot) {
    return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>${escapeHtml(node.name)}</title>\n</head>\n<body>\n${body}\n</body>\n</html>`;
  }

  return body;
}

// ─── Live tab (inline styles, no document wrapper — iframe provides it) ─

export function nodeToHTMLWithCSS(
  node: FigmaNode,
  depth = 0,
  isRoot = true,
  parentNode?: FigmaNode,
  ancestorTags?: Set<string>,
  childIndex?: number,
): string {
  if (node.visible === false) return "";

  const ancestors = ancestorTags ?? new Set<string>();
  const tag = inferElement(node, isRoot, ancestors);
  const css = figmaToCSS(node, parentNode, isRoot, childIndex);
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

  const childAncestors = nextAncestors(ancestors, tag);
  const children = (node.children ?? [])
    .filter((c) => c.visible !== false)
    .map((c, idx) =>
      nodeToHTMLWithCSS(c, depth + 1, false, node, childAncestors, idx),
    )
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

// ─── CSS tab (full subtree stylesheet) ────────────────────────────────

/** Generate a full CSS stylesheet for the entire subtree with class-based selectors. */
export function nodeToStylesheet(
  node: FigmaNode,
  classMap?: Map<string, string>,
): string {
  if (!classMap) classMap = buildClassMap(node);
  const rules: string[] = [];

  function walk(
    n: FigmaNode,
    parentNode?: FigmaNode,
    isRoot = false,
    childIndex?: number,
  ) {
    if (n.visible === false) return;
    const className = classMap!.get(n.id);
    if (!className) return;

    const css = figmaToCSS(n, parentNode, isRoot, childIndex);
    const props = cssToString(css);
    if (props) {
      rules.push(
        `.${className} {\n${props
          .split("\n")
          .map((line) => "  " + line)
          .join("\n")}\n}`,
      );
    }

    const visibleChildren = (n.children ?? []).filter(
      (c) => c.visible !== false,
    );
    visibleChildren.forEach((child, idx) => {
      walk(child, n, false, idx);
    });
  }

  walk(node, undefined, true);
  return rules.join("\n\n");
}

// ─── Live tab with <style> block ──────────────────────────────────────

/** Generate HTML with class attributes + a matching stylesheet (no inline styles). */
export function nodeToHTMLWithStyleBlock(node: FigmaNode): {
  html: string;
  css: string;
} {
  const classMap = buildClassMap(node);
  const ancestors = new Set<string>();
  const html = nodeToHTMLWithClasses(node, 0, true, classMap, ancestors);
  const css = nodeToStylesheet(node, classMap);
  return { html, css };
}

/** Internal: generate HTML with class attributes (used by nodeToHTMLWithStyleBlock). */
function nodeToHTMLWithClasses(
  node: FigmaNode,
  depth: number,
  isRoot: boolean,
  classMap: Map<string, string>,
  ancestorTags: Set<string>,
): string {
  if (node.visible === false) return "";

  const tag = inferElement(node, isRoot, ancestorTags);
  const className = classMap.get(node.id);
  const classAttr = className ? ` class="${className}"` : "";

  if (node.type === "TEXT") {
    const content = renderTextContent(node);
    if (tag === "a") {
      return `${indent(depth)}<${tag} href="#"${classAttr}>${content}</${tag}>`;
    }
    return `${indent(depth)}<${tag}${classAttr}>${content}</${tag}>`;
  }

  if (tag === "img") {
    const w = Math.round(node.absoluteBoundingBox?.width ?? 100);
    const h = Math.round(node.absoluteBoundingBox?.height ?? 100);
    return `${indent(depth)}<${tag}${classAttr} src="https://placehold.co/${w}x${h}/e4e4e7/a1a1aa?text=${w}%C3%97${h}" alt="${escapeHtml(node.name)}" width="${w}" height="${h}" />`;
  }

  if (tag === "hr") {
    return `${indent(depth)}<${tag}${classAttr} />`;
  }

  if (tag === "svg") {
    return `${indent(depth)}<${tag}${classAttr}><!-- ${escapeHtml(node.name)} --></${tag}>`;
  }

  const childAncestors = nextAncestors(ancestorTags, tag);
  const children = (node.children ?? [])
    .filter((c) => c.visible !== false)
    .map((c) =>
      nodeToHTMLWithClasses(c, depth + 1, false, classMap, childAncestors),
    )
    .filter(Boolean);

  if (children.length === 0) {
    return `${indent(depth)}<${tag}${classAttr}></${tag}>`;
  }

  return [
    `${indent(depth)}<${tag}${classAttr}>`,
    ...children,
    `${indent(depth)}</${tag}>`,
  ].join("\n");
}

// ─── React tab ────────────────────────────────────────────────────────

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
  ancestorTags?: Set<string>,
  childIndex?: number,
): string {
  if (node.visible === false) return "";

  const ancestors = ancestorTags ?? new Set<string>();
  const tag = inferElement(node, isRoot, ancestors);

  const css = figmaToCSS(node, parentNode, isRoot, childIndex);
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

  const childAncestors = nextAncestors(ancestors, tag);
  const children = (node.children ?? [])
    .filter((c) => c.visible !== false)
    .map((c, idx) =>
      nodeToReactInner(c, depth + 1, false, node, childAncestors, idx),
    )
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
