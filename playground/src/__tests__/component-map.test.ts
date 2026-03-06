import { describe, it, expect } from "vitest";
import {
  findComponentMapping,
  mapVariantProps,
  generateMappedComponent,
} from "../lib/component-map";
import type { FigmaNode } from "../types/figma";

function makeNode(
  overrides: Partial<FigmaNode> & { id: string; name: string; type: string },
): FigmaNode {
  return overrides as FigmaNode;
}

describe("findComponentMapping", () => {
  it("matches Button", () => {
    const mapping = findComponentMapping("Button");
    expect(mapping).not.toBeNull();
    expect(mapping!.componentName).toBe("Button");
  });

  it("matches Button with Figma path prefix", () => {
    const mapping = findComponentMapping("Button / Primary / Large");
    expect(mapping).not.toBeNull();
    expect(mapping!.componentName).toBe("Button");
  });

  it("matches Input", () => {
    const mapping = findComponentMapping("Input");
    expect(mapping).not.toBeNull();
    expect(mapping!.componentName).toBe("Input");
  });

  it("matches Text Input", () => {
    const mapping = findComponentMapping("Text Input");
    expect(mapping).not.toBeNull();
    expect(mapping!.componentName).toBe("Input");
  });

  it("returns null for unknown component", () => {
    expect(findComponentMapping("MyCustomWidget")).toBeNull();
  });

  it("matches case-insensitively", () => {
    expect(findComponentMapping("BUTTON")).not.toBeNull();
    expect(findComponentMapping("button")).not.toBeNull();
  });

  it("matches Checkbox", () => {
    expect(findComponentMapping("Checkbox")?.componentName).toBe("Checkbox");
  });

  it("matches Dialog/Modal", () => {
    expect(findComponentMapping("Dialog")?.componentName).toBe("Dialog");
    expect(findComponentMapping("Modal")?.componentName).toBe("Dialog");
  });
});

describe("mapVariantProps", () => {
  it("maps variant properties to React props", () => {
    const node = makeNode({
      id: "1:0",
      name: "Button",
      type: "INSTANCE",
      componentProperties: {
        Variant: { value: "destructive", type: "VARIANT" },
        Size: { value: "lg", type: "VARIANT" },
      },
    });
    const mapping = findComponentMapping("Button")!;
    const props = mapVariantProps(node, mapping);
    expect(props.variant).toBe('"destructive"');
    expect(props.size).toBe('"lg"');
  });

  it("skips default values", () => {
    const node = makeNode({
      id: "1:0",
      name: "Button",
      type: "INSTANCE",
      componentProperties: {
        Variant: { value: "Default", type: "VARIANT" },
      },
    });
    const mapping = findComponentMapping("Button")!;
    const props = mapVariantProps(node, mapping);
    expect(props.variant).toBeUndefined();
  });

  it("handles boolean-like values", () => {
    const node = makeNode({
      id: "1:0",
      name: "Switch",
      type: "INSTANCE",
      componentProperties: {
        State: { value: "True", type: "VARIANT" },
      },
    });
    const mapping = findComponentMapping("Switch")!;
    const props = mapVariantProps(node, mapping);
    expect(props.checked).toBe("true");
  });
});

describe("generateMappedComponent", () => {
  it("generates self-closing JSX for self-closing components", () => {
    const node = makeNode({
      id: "1:0",
      name: "Input",
      type: "INSTANCE",
      componentProperties: {},
    });
    const mapping = findComponentMapping("Input")!;
    const { jsx, importStatement } = generateMappedComponent(node, mapping, 2);
    expect(jsx).toContain("<Input");
    expect(jsx).toContain("/>");
    expect(importStatement).toContain("import { Input }");
  });

  it("generates JSX with text content for Button", () => {
    const node = makeNode({
      id: "1:0",
      name: "Button",
      type: "INSTANCE",
      children: [
        makeNode({
          id: "1:1",
          name: "Label",
          type: "TEXT",
          characters: "Click me",
        }),
      ],
    });
    const mapping = findComponentMapping("Button")!;
    const { jsx, importStatement } = generateMappedComponent(node, mapping, 2);
    expect(jsx).toContain("Click me");
    expect(jsx).toContain("</Button>");
    expect(importStatement).toContain("@/components/ui/button");
  });

  it("includes variant props in JSX", () => {
    const node = makeNode({
      id: "1:0",
      name: "Button",
      type: "INSTANCE",
      componentProperties: {
        Variant: { value: "outline", type: "VARIANT" },
      },
      children: [
        makeNode({
          id: "1:1",
          name: "Label",
          type: "TEXT",
          characters: "Submit",
        }),
      ],
    });
    const mapping = findComponentMapping("Button")!;
    const { jsx } = generateMappedComponent(node, mapping, 0);
    expect(jsx).toContain('variant="outline"');
  });
});
