import { useFigmaStore } from "../store/figmaStore";
import { figmaToCSS } from "../lib/figma-to-css";
import { colorToHex, colorToRgba } from "../lib/figma-to-css";
import type { FigmaNode, FigmaFill } from "../types/figma";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-semibold text-text-dim hover:text-text hover:bg-panel-hover transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="px-3 py-3">{children}</div>}
    </div>
  );
}

function PropRow({
  label,
  value,
  css,
}: {
  label: string;
  value: string;
  css?: string;
}) {
  return (
    <div className="flex items-start gap-2 text-xs py-0.5">
      <span className="text-text-dim w-20 flex-none truncate">{label}</span>
      <span className="flex-1 min-w-12 break-all">{value}</span>
      {css && (
        <span className="text-accent text-[10px] flex-none max-w-[45%] truncate">
          → {css}
        </span>
      )}
    </div>
  );
}

function ColorSwatch({ fill }: { fill: FigmaFill }) {
  if (fill.type === "SOLID" && fill.color) {
    const hex = colorToHex(fill.color);
    const rgba = colorToRgba(fill.color);
    return (
      <div className="flex items-center gap-2 text-xs py-0.5">
        <span
          className="w-4 h-4 rounded border border-border flex-none"
          style={{ background: rgba }}
        />
        <span className="text-text-dim">{fill.type}</span>
        <span>{hex}</span>
        <span className="text-accent text-[10px]">
          → background-color: {rgba}
        </span>
      </div>
    );
  }
  if (fill.type === "IMAGE") {
    return (
      <div className="flex items-center gap-2 text-xs py-0.5">
        <span className="w-4 h-4 rounded border border-border flex-none bg-panel-hover flex items-center justify-center text-[8px]">
          IMG
        </span>
        <span className="text-text-dim">{fill.type}</span>
        <span className="truncate text-[10px]">
          {fill.imageRef?.slice(0, 16)}...
        </span>
      </div>
    );
  }
  if (fill.type.startsWith("GRADIENT")) {
    return (
      <div className="flex items-center gap-2 text-xs py-0.5">
        <span
          className="w-4 h-4 rounded border border-border flex-none"
          style={{ background: "linear-gradient(135deg, #89b4fa, #f5c2e7)" }}
        />
        <span className="text-text-dim">{fill.type}</span>
        <span className="text-[10px]">
          {fill.gradientStops?.length ?? 0} stops
        </span>
      </div>
    );
  }
  return null;
}

export function PropertiesPanel() {
  const { selectedNode, rootNode } = useFigmaStore();

  if (!selectedNode) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-sm">
        Select a node
      </div>
    );
  }

  const node = selectedNode;
  const isRoot = node.id === rootNode?.id;
  const css = figmaToCSS(node, undefined, isRoot);
  const bbox = node.absoluteBoundingBox;

  return (
    <div className="h-full overflow-y-auto">
      {/* Node Info */}
      <Section title="Node Info">
        <PropRow label="id" value={node.id} />
        <PropRow label="name" value={node.name} />
        <PropRow label="type" value={node.type} />
        {node.visible === false && <PropRow label="visible" value="false" />}
        {bbox && (
          <PropRow
            label="size"
            value={`${Math.round(bbox.width)} × ${Math.round(bbox.height)}`}
          />
        )}
        {bbox && (
          <PropRow
            label="position"
            value={`x: ${Math.round(bbox.x)}, y: ${Math.round(bbox.y)}`}
          />
        )}
      </Section>

      {/* Auto Layout */}
      {node.layoutMode && node.layoutMode !== "NONE" && (
        <Section title="Auto Layout">
          <PropRow
            label="direction"
            value={node.layoutMode}
            css={
              "flex-direction: " +
              (node.layoutMode === "VERTICAL" ? "column" : "row")
            }
          />
          {node.itemSpacing !== undefined && (
            <PropRow
              label="gap"
              value={String(node.itemSpacing)}
              css={"gap: " + node.itemSpacing + "px"}
            />
          )}
          {node.layoutWrap === "WRAP" && (
            <PropRow label="wrap" value="WRAP" css="flex-wrap: wrap" />
          )}
          {node.primaryAxisAlignItems && (
            <PropRow
              label="justify"
              value={node.primaryAxisAlignItems}
              css={
                css["justify-content"]
                  ? `justify-content: ${css["justify-content"]}`
                  : undefined
              }
            />
          )}
          {node.counterAxisAlignItems && (
            <PropRow
              label="align"
              value={node.counterAxisAlignItems}
              css={
                css["align-items"]
                  ? `align-items: ${css["align-items"]}`
                  : undefined
              }
            />
          )}
          {(node.paddingTop ||
            node.paddingRight ||
            node.paddingBottom ||
            node.paddingLeft) && (
            <PropRow
              label="padding"
              value={`${node.paddingTop ?? 0} ${node.paddingRight ?? 0} ${node.paddingBottom ?? 0} ${node.paddingLeft ?? 0}`}
              css={css["padding"] ? `padding: ${css["padding"]}` : undefined}
            />
          )}
        </Section>
      )}

      {/* Sizing */}
      {(node.layoutSizingHorizontal || node.layoutSizingVertical) && (
        <Section title="Sizing">
          {node.layoutSizingHorizontal && (
            <PropRow
              label="horizontal"
              value={node.layoutSizingHorizontal}
              css={css["width"] ? `width: ${css["width"]}` : undefined}
            />
          )}
          {node.layoutSizingVertical && (
            <PropRow
              label="vertical"
              value={node.layoutSizingVertical}
              css={css["height"] ? `height: ${css["height"]}` : undefined}
            />
          )}
          {node.layoutGrow === 1 && (
            <PropRow label="grow" value="1" css="flex-grow: 1" />
          )}
          {node.layoutAlign === "STRETCH" && (
            <PropRow label="align" value="STRETCH" css="align-self: stretch" />
          )}
          {node.minWidth !== undefined && (
            <PropRow
              label="min-width"
              value={`${node.minWidth}`}
              css={"min-width: " + node.minWidth + "px"}
            />
          )}
          {node.maxWidth !== undefined && (
            <PropRow
              label="max-width"
              value={`${node.maxWidth}`}
              css={"max-width: " + node.maxWidth + "px"}
            />
          )}
        </Section>
      )}

      {/* Fills */}
      {node.fills && node.fills.length > 0 && (
        <Section title="Fills">
          {node.fills
            .filter((f) => f.visible !== false)
            .map((fill, i) => (
              <ColorSwatch key={i} fill={fill} />
            ))}
        </Section>
      )}

      {/* Strokes */}
      {node.strokes && node.strokes.length > 0 && node.strokeWeight && (
        <Section title="Strokes">
          <PropRow
            label="weight"
            value={String(node.strokeWeight)}
            css={
              css["border"]
                ? `border: ${css["border"]}`
                : css["box-shadow"]
                  ? `box-shadow: ${css["box-shadow"].slice(0, 40)}...`
                  : undefined
            }
          />
          {node.strokeAlign && (
            <PropRow
              label="align"
              value={node.strokeAlign}
              css={
                node.strokeAlign === "INSIDE"
                  ? "→ inset box-shadow"
                  : node.strokeAlign === "OUTSIDE"
                    ? "→ outer box-shadow"
                    : "→ border"
              }
            />
          )}
        </Section>
      )}

      {/* Effects */}
      {node.effects && node.effects.length > 0 && (
        <Section title="Effects">
          {node.effects
            .filter((e) => e.visible)
            .map((effect, i) => (
              <PropRow
                key={i}
                label={effect.type.toLowerCase().replace(/_/g, " ")}
                value={`radius: ${effect.radius}${effect.offset ? `, offset: ${effect.offset.x}/${effect.offset.y}` : ""}`}
                css={
                  css["box-shadow"]
                    ? `box-shadow: ...`
                    : css["filter"]
                      ? `filter: ${css["filter"]}`
                      : undefined
                }
              />
            ))}
        </Section>
      )}

      {/* Typography */}
      {node.type === "TEXT" && node.style && (
        <Section title="Typography">
          <PropRow
            label="font"
            value={node.style.fontFamily}
            css={'font-family: "' + node.style.fontFamily + '"'}
          />
          <PropRow
            label="size"
            value={`${node.style.fontSize}px`}
            css={"font-size: " + node.style.fontSize + "px"}
          />
          <PropRow
            label="weight"
            value={String(node.style.fontWeight)}
            css={"font-weight: " + node.style.fontWeight}
          />
          {node.style.lineHeightPx && (
            <PropRow
              label="line-height"
              value={`${node.style.lineHeightPx}px`}
              css={"line-height: " + node.style.lineHeightPx + "px"}
            />
          )}
          {node.style.letterSpacing !== undefined &&
            node.style.letterSpacing !== 0 && (
              <PropRow
                label="letter-spacing"
                value={`${node.style.letterSpacing}px`}
                css={"letter-spacing: " + node.style.letterSpacing + "px"}
              />
            )}
          {node.style.textAlignHorizontal && (
            <PropRow
              label="text-align"
              value={node.style.textAlignHorizontal}
              css={
                "text-align: " + node.style.textAlignHorizontal.toLowerCase()
              }
            />
          )}
          {node.style.textCase && node.style.textCase !== "ORIGINAL" && (
            <PropRow
              label="text-case"
              value={node.style.textCase}
              css={
                css["text-transform"]
                  ? `text-transform: ${css["text-transform"]}`
                  : undefined
              }
            />
          )}
          {node.characters && (
            <div className="mt-2 p-2 bg-surface rounded text-xs text-text-dim break-all">
              {node.characters.slice(0, 200)}
              {(node.characters.length ?? 0) > 200 && "..."}
            </div>
          )}
          {node.characterStyleOverrides &&
            node.characterStyleOverrides.length > 0 &&
            node.styleOverrideTable && (
              <div className="mt-2">
                <div className="text-[10px] text-text-dim mb-1">
                  Style Overrides
                </div>
                {Object.entries(node.styleOverrideTable).map(
                  ([id, override]) => (
                    <div
                      key={id}
                      className="flex items-center gap-2 text-[10px] py-0.5"
                    >
                      <span className="text-accent">#{id}</span>
                      <span className="text-text-dim">
                        {[
                          override.fontWeight !== undefined &&
                            override.fontWeight !== node.style?.fontWeight &&
                            `weight: ${override.fontWeight}`,
                          override.fontFamily &&
                            override.fontFamily !== node.style?.fontFamily &&
                            `family: ${override.fontFamily}`,
                          override.fontSize !== undefined &&
                            override.fontSize !== node.style?.fontSize &&
                            `size: ${override.fontSize}`,
                          override.italic && "italic",
                          override.textDecoration &&
                            override.textDecoration !== "NONE" &&
                            override.textDecoration?.toLowerCase(),
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
        </Section>
      )}

      {/* Component Instance */}
      {node.type === "INSTANCE" && node.componentId && (
        <Section title="Component Instance">
          <PropRow label="componentId" value={node.componentId} />
          {node.componentProperties &&
            Object.entries(node.componentProperties).map(([key, val]) => (
              <PropRow
                key={key}
                label={key}
                value={`${val.value ?? ""} (${val.type ?? ""})`}
              />
            ))}
          {node.overrides && node.overrides.length > 0 && (
            <div className="mt-1">
              <div className="text-[10px] text-text-dim mb-0.5">Overrides</div>
              {node.overrides.map((o, i) => (
                <div key={i} className="text-[10px] text-text-dim py-0.5">
                  <span className="text-accent">
                    {o.id === node.id ? "self" : o.id}
                  </span>
                  {": "}
                  {o.overriddenFields.join(", ")}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Corner Radius */}
      {(node.cornerRadius || node.rectangleCornerRadii) && (
        <Section title="Corner Radius" defaultOpen={false}>
          {node.rectangleCornerRadii ? (
            <PropRow
              label="radii"
              value={node.rectangleCornerRadii.join(", ")}
              css={
                css["border-radius"]
                  ? `border-radius: ${css["border-radius"]}`
                  : undefined
              }
            />
          ) : (
            <PropRow
              label="radius"
              value={`${node.cornerRadius}px`}
              css={"border-radius: " + node.cornerRadius + "px"}
            />
          )}
        </Section>
      )}

      {/* Positioning */}
      {node.layoutPositioning === "ABSOLUTE" && (
        <Section title="Positioning" defaultOpen={false}>
          <PropRow
            label="positioning"
            value="ABSOLUTE"
            css="position: absolute"
          />
          {node.constraints && (
            <>
              <PropRow label="horizontal" value={node.constraints.horizontal} />
              <PropRow label="vertical" value={node.constraints.vertical} />
            </>
          )}
        </Section>
      )}

      {/* Extra */}
      {(node.opacity !== undefined && node.opacity < 1) ||
      node.clipsContent ||
      node.blendMode !== "PASS_THROUGH" ? (
        <Section title="Other" defaultOpen={false}>
          {node.opacity !== undefined && node.opacity < 1 && (
            <PropRow
              label="opacity"
              value={String(node.opacity)}
              css={"opacity: " + node.opacity}
            />
          )}
          {node.clipsContent && (
            <PropRow label="clips" value="true" css="overflow: hidden" />
          )}
          {node.blendMode && node.blendMode !== "PASS_THROUGH" && (
            <PropRow label="blend" value={node.blendMode} />
          )}
        </Section>
      ) : null}
    </div>
  );
}
