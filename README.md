# figma-mcp

Design-to-code Figma MCP server for Claude Code. Extracts components, styles, layout info, and design tokens from Figma files.

## Setup

```bash
cd figma-mcp
python -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Store your Figma Personal Access Token:

```bash
mkdir -p ~/.agent-tools/figma
echo "YOUR_FIGMA_TOKEN" > ~/.agent-tools/figma/token
```

Generate a token at: https://www.figma.com/developers/api#access-tokens

## MCP Config

Add to `.mcp.json`:

```json
{
  "figma": {
    "command": "/Users/admin/omni/workspaces/agent-tools/figma-mcp/.venv/bin/python",
    "args": ["server.py"],
    "cwd": "/Users/admin/omni/workspaces/agent-tools/figma-mcp"
  }
}
```

## Tools

| Tool                 | Description                                        |
| -------------------- | -------------------------------------------------- |
| `get_file_structure` | Page/frame tree overview of a Figma file           |
| `get_node_details`   | Full node info — layout, styles, auto-layout props |
| `get_styles`         | Published color, text, effect, grid styles         |
| `get_components`     | Published components with properties & variants    |
| `get_design_tokens`  | Extract variables as design tokens                 |
| `export_assets`      | Export nodes as SVG, PNG, JPG, or PDF              |

## Typical Workflow

1. `get_file_structure(file_key)` — orient yourself in the file
2. `get_styles(file_key)` — extract the design system
3. `get_components(file_key)` — see what components exist
4. `get_node_details(file_key, node_ids)` — dive into specific frames
5. `get_design_tokens(file_key)` — extract variables for Tailwind/CSS
6. `export_assets(file_key, node_ids)` — export icons/images as SVG
