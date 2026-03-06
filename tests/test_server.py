"""Tests for server.py helper functions."""

import pytest
import sys
from unittest.mock import MagicMock

# Mock FigmaClient before importing server
mock_figma_api = MagicMock()
sys.modules["figma_api"] = mock_figma_api


from server import _rgba_to_hex, _simplify_node, _extract_auto_layout, _extract_node_detail


class TestRgbaToHex:
    def test_opaque_red(self):
        assert _rgba_to_hex({"r": 1, "g": 0, "b": 0, "a": 1}) == "#ff0000"

    def test_opaque_white(self):
        assert _rgba_to_hex({"r": 1, "g": 1, "b": 1, "a": 1}) == "#ffffff"

    def test_semi_transparent(self):
        result = _rgba_to_hex({"r": 0, "g": 0, "b": 0, "a": 0.5})
        assert result == "rgba(0, 0, 0, 0.50)"

    def test_missing_alpha_defaults_opaque(self):
        result = _rgba_to_hex({"r": 0, "g": 0.5, "b": 1})
        assert result.startswith("#")


class TestSimplifyNode:
    def test_basic_node(self):
        node = {"id": "1:0", "name": "Frame", "type": "FRAME"}
        result = _simplify_node(node)
        assert result["id"] == "1:0"
        assert result["name"] == "Frame"
        assert result["type"] == "FRAME"

    def test_includes_children_within_depth(self):
        node = {
            "id": "0:0",
            "name": "Page",
            "type": "CANVAS",
            "children": [
                {"id": "1:0", "name": "Child", "type": "FRAME"},
            ],
        }
        result = _simplify_node(node, max_depth=2)
        assert "children" in result
        assert len(result["children"]) == 1

    def test_shows_child_count_beyond_depth(self):
        node = {
            "id": "0:0",
            "name": "Page",
            "type": "CANVAS",
            "children": [
                {"id": "1:0", "name": "Child", "type": "FRAME"},
                {"id": "2:0", "name": "Child2", "type": "FRAME"},
            ],
        }
        result = _simplify_node(node, max_depth=0)
        assert result.get("childCount") == 2
        assert "children" not in result


class TestExtractAutoLayout:
    def test_returns_none_without_layout_mode(self):
        node = {"id": "1:0", "name": "Box", "type": "FRAME"}
        assert _extract_auto_layout(node) is None

    def test_extracts_horizontal_layout(self):
        node = {
            "id": "1:0",
            "name": "Row",
            "type": "FRAME",
            "layoutMode": "HORIZONTAL",
            "itemSpacing": 8,
            "paddingTop": 16,
            "paddingRight": 16,
            "paddingBottom": 16,
            "paddingLeft": 16,
            "primaryAxisAlignItems": "CENTER",
            "counterAxisAlignItems": "MIN",
        }
        result = _extract_auto_layout(node)
        assert result is not None
        assert result["direction"] == "HORIZONTAL"
        assert result["gap"] == 8
        assert result["paddingTop"] == 16
        assert result["primaryAxisAlign"] == "CENTER"


class TestExtractNodeDetail:
    def test_basic_fields(self):
        node = {"id": "1:0", "name": "Frame", "type": "FRAME", "visible": True}
        result = _extract_node_detail(node)
        assert result["id"] == "1:0"
        assert result["name"] == "Frame"
        assert result["type"] == "FRAME"
        assert result["visible"] is True

    def test_extracts_bounds(self):
        node = {
            "id": "1:0",
            "name": "Box",
            "type": "FRAME",
            "absoluteBoundingBox": {"x": 0, "y": 0, "width": 100, "height": 50},
        }
        result = _extract_node_detail(node)
        assert result["size"]["width"] == 100
        assert result["size"]["height"] == 50

    def test_extracts_fills(self):
        node = {
            "id": "1:0",
            "name": "Box",
            "type": "FRAME",
            "fills": [
                {"type": "SOLID", "color": {"r": 1, "g": 0, "b": 0, "a": 1}, "visible": True},
            ],
        }
        result = _extract_node_detail(node)
        assert len(result["fills"]) == 1
        assert result["fills"][0]["color"] == "#ff0000"

    def test_extracts_text_style(self):
        node = {
            "id": "1:0",
            "name": "Title",
            "type": "TEXT",
            "characters": "Hello",
            "style": {
                "fontFamily": "Inter",
                "fontSize": 24,
                "fontWeight": 700,
                "letterSpacing": 0,
            },
        }
        result = _extract_node_detail(node)
        assert result["text"] == "Hello"
        assert result["textStyle"]["fontFamily"] == "Inter"
        assert result["textStyle"]["fontSize"] == 24
