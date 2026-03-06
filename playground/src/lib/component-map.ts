/**
 * Component mapping configuration for design system integration.
 * Maps Figma component name patterns to React (shadcn/ui) imports and usage.
 */

export interface ComponentMapping {
  /** Pattern to match against Figma component name (case-insensitive) */
  pattern: RegExp;
  /** React import path */
  importPath: string;
  /** React component name */
  componentName: string;
  /** Map Figma variant props to React props */
  propMap?: Record<string, string>;
  /** Default props to always include */
  defaultProps?: Record<string, string>;
  /** Whether this is a self-closing component */
  selfClosing?: boolean;
}

/** Built-in shadcn/ui component mappings. */
export const SHADCN_MAPPINGS: ComponentMapping[] = [
  {
    pattern: /^button$/i,
    importPath: "@/components/ui/button",
    componentName: "Button",
    propMap: {
      Type: "variant",
      Style: "variant",
      Variant: "variant",
      Size: "size",
      State: "disabled",
    },
  },
  {
    pattern: /^(text\s*)?input$/i,
    importPath: "@/components/ui/input",
    componentName: "Input",
    propMap: {
      Type: "type",
      Placeholder: "placeholder",
      State: "disabled",
    },
    selfClosing: true,
  },
  {
    pattern: /^textarea$/i,
    importPath: "@/components/ui/textarea",
    componentName: "Textarea",
    propMap: {
      Placeholder: "placeholder",
    },
    selfClosing: true,
  },
  {
    pattern: /^card$/i,
    importPath: "@/components/ui/card",
    componentName: "Card",
  },
  {
    pattern: /^badge$/i,
    importPath: "@/components/ui/badge",
    componentName: "Badge",
    propMap: {
      Variant: "variant",
      Type: "variant",
    },
  },
  {
    pattern: /^avatar$/i,
    importPath: "@/components/ui/avatar",
    componentName: "Avatar",
    selfClosing: false,
  },
  {
    pattern: /^(toggle|switch)$/i,
    importPath: "@/components/ui/switch",
    componentName: "Switch",
    propMap: {
      State: "checked",
    },
    selfClosing: true,
  },
  {
    pattern: /^checkbox$/i,
    importPath: "@/components/ui/checkbox",
    componentName: "Checkbox",
    propMap: {
      State: "checked",
    },
    selfClosing: true,
  },
  {
    pattern: /^(radio|radio\s*button)$/i,
    importPath: "@/components/ui/radio-group",
    componentName: "RadioGroupItem",
    selfClosing: true,
  },
  {
    pattern: /^select$/i,
    importPath: "@/components/ui/select",
    componentName: "Select",
  },
  {
    pattern: /^(dialog|modal)$/i,
    importPath: "@/components/ui/dialog",
    componentName: "Dialog",
  },
  {
    pattern: /^(dropdown|dropdown\s*menu|menu)$/i,
    importPath: "@/components/ui/dropdown-menu",
    componentName: "DropdownMenu",
  },
  {
    pattern: /^tabs?$/i,
    importPath: "@/components/ui/tabs",
    componentName: "Tabs",
  },
  {
    pattern: /^tooltip$/i,
    importPath: "@/components/ui/tooltip",
    componentName: "Tooltip",
  },
  {
    pattern: /^(separator|divider)$/i,
    importPath: "@/components/ui/separator",
    componentName: "Separator",
    selfClosing: true,
  },
  {
    pattern: /^skeleton$/i,
    importPath: "@/components/ui/skeleton",
    componentName: "Skeleton",
    selfClosing: true,
  },
  {
    pattern: /^(progress|progress\s*bar)$/i,
    importPath: "@/components/ui/progress",
    componentName: "Progress",
    propMap: {
      Value: "value",
    },
    selfClosing: true,
  },
  {
    pattern: /^slider$/i,
    importPath: "@/components/ui/slider",
    componentName: "Slider",
    selfClosing: true,
  },
  {
    pattern: /^(alert|callout)$/i,
    importPath: "@/components/ui/alert",
    componentName: "Alert",
  },
  {
    pattern: /^(accordion)$/i,
    importPath: "@/components/ui/accordion",
    componentName: "Accordion",
  },
  {
    pattern: /^(breadcrumb)$/i,
    importPath: "@/components/ui/breadcrumb",
    componentName: "Breadcrumb",
  },
  {
    pattern: /^(label)$/i,
    importPath: "@/components/ui/label",
    componentName: "Label",
  },
];

/**
 * Find a matching design system component for a Figma node.
 * Matches against the node name (component name from Figma).
 * Strips common Figma naming patterns like "Component / Variant" before matching.
 */
export function findComponentMapping(
  nodeName: string,
): ComponentMapping | null {
  // Strip Figma naming conventions: "Button / Primary / Large" → "Button"
  // Also handles "Component=Button, Size=Large" variant naming
  const baseName = nodeName.split(/[/,=]/)[0].trim();

  for (const mapping of SHADCN_MAPPINGS) {
    if (mapping.pattern.test(baseName)) {
      return mapping;
    }
  }
  return null;
}

/**
 * Map Figma variant properties to React component props using the mapping config.
 */
export function mapVariantProps(
  node: {
    componentProperties?: Record<string, { type?: string; value?: unknown }>;
  },
  mapping: ComponentMapping,
): Record<string, string> {
  const props: Record<string, string> = {};

  // Add default props
  if (mapping.defaultProps) {
    Object.assign(props, mapping.defaultProps);
  }

  // Map variant properties
  if (node.componentProperties && mapping.propMap) {
    for (const [figmaKey, val] of Object.entries(node.componentProperties)) {
      const v = val as { value?: string; type?: string };
      if (v.type !== "VARIANT") continue;

      // Try to match the Figma property name to a React prop
      const cleanKey = figmaKey.split("#")[0].trim(); // Remove Figma's #id suffix
      const reactProp = mapping.propMap[cleanKey];
      if (reactProp && v.value) {
        const value = String(v.value).toLowerCase();
        // Skip "default" values — let React defaults handle them
        if (value === "default" || value === "none") continue;
        // Handle boolean-like values
        if (value === "true" || value === "on") {
          props[reactProp] = "true";
        } else if (value === "false" || value === "off") {
          props[reactProp] = "false";
        } else {
          props[reactProp] = `"${String(v.value).toLowerCase()}"`;
        }
      }
    }
  }

  return props;
}

/**
 * Generate the JSX for a mapped design system component.
 */
export function generateMappedComponent(
  node: {
    name: string;
    componentProperties?: Record<string, { type?: string; value?: unknown }>;
    children?: Array<{
      type: string;
      characters?: string;
      visible?: boolean;
      name: string;
      children?: any[];
    }>;
  },
  mapping: ComponentMapping,
  depth: number,
): { jsx: string; importStatement: string } {
  const ind = "  ".repeat(depth);
  const props = mapVariantProps(node, mapping);

  const propsStr = Object.entries(props)
    .map(([key, val]) => {
      if (val === "true") return key; // boolean shorthand
      return `${key}=${val}`;
    })
    .join(" ");

  const propsAttr = propsStr ? ` ${propsStr}` : "";

  // Find text content from children
  const textContent = findTextContent(node.children);

  const importStatement = `import { ${mapping.componentName} } from "${mapping.importPath}"`;

  if (mapping.selfClosing || !textContent) {
    return {
      jsx: `${ind}<${mapping.componentName}${propsAttr} />`,
      importStatement,
    };
  }

  return {
    jsx: `${ind}<${mapping.componentName}${propsAttr}>${textContent}</${mapping.componentName}>`,
    importStatement,
  };
}

/** Find the primary text content from a node's children recursively. */
function findTextContent(
  children?: Array<{
    type: string;
    characters?: string;
    visible?: boolean;
    name: string;
    children?: any[];
  }>,
): string {
  if (!children) return "";

  for (const child of children) {
    if (child.visible === false) continue;
    if (child.type === "TEXT" && child.characters) {
      return child.characters;
    }
    // Recurse into child containers
    const found = findTextContent(child.children);
    if (found) return found;
  }

  return "";
}
