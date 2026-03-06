"""Thin async client for the Figma REST API v1."""

import asyncio
import time
from pathlib import Path

import httpx

TOKEN_PATH = Path.home() / ".agent-tools" / "figma" / "token"
BASE_URL = "https://api.figma.com/v1"
MAX_RETRIES = 3


def _load_token() -> str:
    if not TOKEN_PATH.exists():
        raise FileNotFoundError(
            f"Figma token not found at {TOKEN_PATH}. "
            "Create it with: mkdir -p ~/.agent-tools/figma && echo 'YOUR_TOKEN' > ~/.agent-tools/figma/token"
        )
    return TOKEN_PATH.read_text().strip()


class FigmaClient:
    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            token = _load_token()
            self._client = httpx.AsyncClient(
                base_url=BASE_URL,
                headers={"X-Figma-Token": token},
                timeout=30.0,
            )
        return self._client

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        client = self._ensure_client()
        for attempt in range(MAX_RETRIES):
            resp = await client.request(method, path, **kwargs)
            if resp.status_code == 429:
                wait = float(resp.headers.get("Retry-After", 2 ** attempt))
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()
        resp.raise_for_status()
        return resp.json()

    async def get_file(self, file_key: str, depth: int | None = None) -> dict:
        params = {}
        if depth is not None:
            params["depth"] = depth
        return await self._request("GET", f"/files/{file_key}", params=params)

    async def get_file_nodes(self, file_key: str, node_ids: list[str]) -> dict:
        return await self._request(
            "GET",
            f"/files/{file_key}/nodes",
            params={"ids": ",".join(node_ids)},
        )

    async def get_file_styles(self, file_key: str) -> dict:
        return await self._request("GET", f"/files/{file_key}/styles")

    async def get_file_components(self, file_key: str) -> dict:
        return await self._request("GET", f"/files/{file_key}/components")

    async def get_local_variables(self, file_key: str) -> dict:
        return await self._request("GET", f"/files/{file_key}/variables/local")

    async def get_images(
        self, file_key: str, node_ids: list[str], format: str = "svg", scale: float = 1.0
    ) -> dict:
        return await self._request(
            "GET",
            f"/images/{file_key}",
            params={
                "ids": ",".join(node_ids),
                "format": format,
                "scale": scale,
            },
        )

    async def get_file_node_details(self, file_key: str, node_ids: list[str]) -> dict:
        """Get full node details including geometry and plugin data."""
        return await self._request(
            "GET",
            f"/files/{file_key}/nodes",
            params={"ids": ",".join(node_ids), "plugin_data": "shared"},
        )
