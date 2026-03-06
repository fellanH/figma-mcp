"""Figma MCP Server — design-to-code bridge for Claude Code."""

from fastmcp import FastMCP

from figma_api import FigmaClient

mcp = FastMCP("figma")
client = FigmaClient()


# -- Helpers ------------------------------------------------------------------

def _rgba_to_hex(color: dict) -> str:
    """Convert Figma RGBA (0-1 floats) to hex string."""
    r = int(color.get("r", 0) * 255)
    g = int(color.get("g", 0) * 255)
    b = int(color.get("b", 0) * 255)
    a = color.get("a", 1)
    if a < 1:
        return f"rgba({r}, {g}, {b}, {a:.2f})"
    return f"#{r:02x}{g:02x}{b:02x}"


def _simplify_node(node: dict, max_depth: int = 2, depth: int = 0) -> dict:
    """Reduce a Figma node tree to essential info."""
    result = {
        "id": node.get("id"),
        "name": node.get("name"),
        "type": node.get("type"),
    }
    if depth < max_depth and "children" in node:
        result["children"] = [
            _simplify_node(c, max_depth, depth + 1) for c in node["children"]
        ]
    elif "children" in node:
        result["childCount"] = len(node["children"])
    return result


def _extract_auto_layout(node: dict) -> dict | None:
    """Extract auto-layout (flexbox) properties from a frame."""
    if node.get("layoutMode") is None:
        return None
    return {
        "direction": node.get("layoutMode"),  # HORIZONTAL / VERTICAL
        "gap": node.get("itemSpacing"),
        "paddingTop": node.get("paddingTop"),
        "paddingRight": node.get("paddingRight"),
        "paddingBottom": node.get("paddingBottom"),
        "paddingLeft": node.get("paddingLeft"),
        "primaryAxisAlign": node.get("primaryAxisAlignItems"),
        "counterAxisAlign": node.get("counterAxisAlignItems"),
        "wrap": node.get("layoutWrap"),
    }


def _extract_node_detail(node: dict) -> dict:
    """Extract design-relevant details from a single node."""
    detail = {
        "id": node.get("id"),
        "name": node.get("name"),
        "type": node.get("type"),
        "visible": node.get("visible", True),
    }
    bbox = node.get("absoluteBoundingBox")
    if bbox:
        detail["bounds"] = bbox
        detail["size"] = {"width": bbox.get("width"), "height": bbox.get("height")}

    if node.get("fills"):
        detail["fills"] = [
            {
                "type": f.get("type"),
                "color": _rgba_to_hex(f["color"]) if "color" in f else None,
                "opacity": f.get("opacity"),
            }
            for f in node["fills"]
            if f.get("visible", True)
        ]

    if node.get("strokes"):
        detail["strokes"] = [
            {
                "type": s.get("type"),
                "color": _rgba_to_hex(s["color"]) if "color" in s else None,
                "weight": node.get("strokeWeight"),
            }
            for s in node["strokes"]
            if s.get("visible", True)
        ]

    if node.get("effects"):
        detail["effects"] = [
            {
                "type": e.get("type"),
                "radius": e.get("radius"),
                "color": _rgba_to_hex(e["color"]) if "color" in e else None,
                "offset": e.get("offset"),
            }
            for e in node["effects"]
            if e.get("visible", True)
        ]

    if node.get("cornerRadius") is not None:
        detail["cornerRadius"] = node.get("cornerRadius")

    auto_layout = _extract_auto_layout(node)
    if auto_layout:
        detail["autoLayout"] = auto_layout

    if node.get("style"):
        detail["textStyle"] = {
            "fontFamily": node["style"].get("fontFamily"),
            "fontSize": node["style"].get("fontSize"),
            "fontWeight": node["style"].get("fontWeight"),
            "lineHeightPx": node["style"].get("lineHeightPx"),
            "letterSpacing": node["style"].get("letterSpacing"),
            "textAlignHorizontal": node["style"].get("textAlignHorizontal"),
        }

    if node.get("characters"):
        detail["text"] = node["characters"]

    if node.get("children"):
        detail["children"] = [
            {
                "id": c.get("id"),
                "name": c.get("name"),
                "type": c.get("type"),
            }
            for c in node["children"]
        ]

    return detail


# -- Tools --------------------------------------------------------------------

@mcp.tool()
async def get_file_structure(file_key: str) -> dict:
    """Get the page and frame tree of a Figma file.

    Returns a simplified hierarchy: pages → frames → top-level components.
    Use this first to orient yourself in a Figma file before diving into details.

    Args:
        file_key: The Figma file key (from the URL: figma.com/file/<KEY>/...).
    """
    data = await client.get_file(file_key, depth=2)
    document = data.get("document", {})
    return {
        "name": data.get("name"),
        "lastModified": data.get("lastModified"),
        "pages": [_simplify_node(page, max_depth=2) for page in document.get("children", [])],
    }


@mcp.tool()
async def get_node_details(file_key: str, node_ids: list[str]) -> dict:
    """Get detailed design info for specific nodes — layout, fills, strokes, effects, auto-layout, text styles.

    Returns enough information to write CSS/Tailwind for each node.
    Use get_file_structure first to find node IDs.

    Args:
        file_key: The Figma file key.
        node_ids: List of node IDs to inspect (e.g., ["1:2", "3:45"]).
    """
    data = await client.get_file_nodes(file_key, node_ids)
    nodes = data.get("nodes", {})
    result = {}
    for node_id, node_data in nodes.items():
        doc = node_data.get("document")
        if doc:
            result[node_id] = _extract_node_detail(doc)
    return result


@mcp.tool()
async def get_styles(file_key: str) -> dict:
    """Get all published styles from a Figma file — colors, typography, effects, grids.

    Returns styles categorized by type with resolved values.

    Args:
        file_key: The Figma file key.
    """
    styles_resp = await client.get_file_styles(file_key)
    meta = styles_resp.get("meta", {})
    styles = meta.get("styles", [])

    categorized = {"colors": [], "typography": [], "effects": [], "grids": []}

    # Group style node IDs by type for batch fetching
    style_node_ids = [s["node_id"] for s in styles if "node_id" in s]
    node_details = {}
    if style_node_ids:
        nodes_resp = await client.get_file_nodes(file_key, style_node_ids)
        node_details = nodes_resp.get("nodes", {})

    for style in styles:
        style_type = style.get("style_type", "").upper()
        node_id = style.get("node_id")
        node_doc = node_details.get(node_id, {}).get("document", {})
        entry = {
            "name": style.get("name"),
            "description": style.get("description"),
            "key": style.get("key"),
        }

        if style_type == "FILL":
            fills = node_doc.get("fills", [])
            if fills and "color" in fills[0]:
                entry["value"] = _rgba_to_hex(fills[0]["color"])
            categorized["colors"].append(entry)
        elif style_type == "TEXT":
            ts = node_doc.get("style", {})
            entry["value"] = {
                "fontFamily": ts.get("fontFamily"),
                "fontSize": ts.get("fontSize"),
                "fontWeight": ts.get("fontWeight"),
                "lineHeightPx": ts.get("lineHeightPx"),
                "letterSpacing": ts.get("letterSpacing"),
            }
            categorized["typography"].append(entry)
        elif style_type == "EFFECT":
            effects = node_doc.get("effects", [])
            entry["value"] = [
                {
                    "type": e.get("type"),
                    "radius": e.get("radius"),
                    "color": _rgba_to_hex(e["color"]) if "color" in e else None,
                    "offset": e.get("offset"),
                }
                for e in effects
            ]
            categorized["effects"].append(entry)
        elif style_type == "GRID":
            grids = node_doc.get("layoutGrids", [])
            entry["value"] = grids
            categorized["grids"].append(entry)

    # Remove empty categories
    return {k: v for k, v in categorized.items() if v}


@mcp.tool()
async def get_components(file_key: str) -> dict:
    """Get all published components from a Figma file with their properties and variants.

    Useful for mapping Figma components to React components.

    Args:
        file_key: The Figma file key.
    """
    data = await client.get_file_components(file_key)
    meta = data.get("meta", {})
    components = meta.get("components", [])

    return {
        "components": [
            {
                "name": c.get("name"),
                "description": c.get("description"),
                "key": c.get("key"),
                "node_id": c.get("node_id"),
                "containing_frame": c.get("containing_frame", {}).get("name"),
                "containing_page": c.get("containing_frame", {})
                .get("containingStateGroup", {})
                .get("name")
                or c.get("containing_frame", {}).get("pageName"),
            }
            for c in components
        ]
    }


@mcp.tool()
async def get_design_tokens(file_key: str) -> dict:
    """Extract local variables as design tokens — colors, spacing, typography.

    Returns variables grouped by collection, ready to map to Tailwind config or CSS custom properties.

    Args:
        file_key: The Figma file key.
    """
    try:
        data = await client.get_local_variables(file_key)
    except Exception as e:
        if "403" in str(e):
            return {"error": "Variables API requires a Figma Enterprise plan or appropriate token scopes."}
        raise
    meta = data.get("meta", {})
    variables = meta.get("variables", {})
    collections = meta.get("variableCollections", {})

    result = {}
    for coll_id, coll in collections.items():
        coll_name = coll.get("name", coll_id)
        modes = {m["modeId"]: m["name"] for m in coll.get("modes", [])}
        tokens = []

        for var_id in coll.get("variableIds", []):
            var = variables.get(var_id)
            if not var:
                continue
            token = {
                "name": var.get("name"),
                "type": var.get("resolvedType"),
                "description": var.get("description"),
            }
            # Resolve values per mode
            values_by_mode = var.get("valuesByMode", {})
            if len(modes) == 1:
                mode_id = list(modes.keys())[0]
                raw = values_by_mode.get(mode_id)
                token["value"] = _resolve_token_value(raw, var.get("resolvedType"))
            else:
                token["values"] = {
                    modes.get(mid, mid): _resolve_token_value(v, var.get("resolvedType"))
                    for mid, v in values_by_mode.items()
                }
            tokens.append(token)

        result[coll_name] = tokens

    return result


def _resolve_token_value(raw, resolved_type: str | None):
    """Convert a Figma variable value to a usable format."""
    if isinstance(raw, dict):
        if "r" in raw and "g" in raw:
            return _rgba_to_hex(raw)
        if "type" in raw and raw["type"] == "VARIABLE_ALIAS":
            return {"alias": raw.get("id")}
    return raw


@mcp.tool()
async def export_assets(
    file_key: str,
    node_ids: list[str],
    format: str = "svg",
    scale: float = 1.0,
) -> dict:
    """Export nodes as images (SVG, PNG, JPG, or PDF) and return download URLs.

    Args:
        file_key: The Figma file key.
        node_ids: List of node IDs to export.
        format: Image format — "svg", "png", "jpg", or "pdf". Default: "svg".
        scale: Export scale (1.0 = 1x, 2.0 = 2x). Only applies to raster formats.
    """
    if format not in ("svg", "png", "jpg", "pdf"):
        return {"error": f"Unsupported format '{format}'. Use svg, png, jpg, or pdf."}

    data = await client.get_images(file_key, node_ids, format=format, scale=scale)
    images = data.get("images", {})
    return {
        "format": format,
        "scale": scale,
        "images": {node_id: url for node_id, url in images.items()},
    }


@mcp.tool()
async def get_image_fill_urls(file_key: str) -> dict:
    """Resolve image fill references to download URLs.

    Returns a mapping of image reference hashes to temporary download URLs.
    Use this to get actual image URLs for nodes that have IMAGE type fills.
    The imageRef values come from node fill data (fill.imageRef).

    Note: URLs are temporary and expire after ~14 days.

    Args:
        file_key: The Figma file key.
    """
    data = await client.get_file_images(file_key)
    images = data.get("meta", {}).get("images", {})
    return {
        "images": images,
        "note": "URLs are temporary Figma-hosted links. Download for permanent use.",
    }


def main():
    mcp.run()


if __name__ == "__main__":
    main()
