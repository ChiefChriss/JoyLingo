import base64
import gzip
import json
import os
import re
from urllib.parse import quote, urljoin, urlsplit

from curl_cffi.requests import AsyncSession
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import Response


app = FastAPI(title="JoyLingo stream sidecar", version="1.0")

MIRURO_PIPE_URL = os.getenv(
    "MIRURO_PIPE_URL",
    "https://www.miruro.tv/api/secure/pipe",
)
MIRURO_REFERER = "https://www.miruro.tv/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/110.0.0.0 Safari/537.36"
    ),
    "Referer": MIRURO_REFERER,
    "Origin": "https://www.miruro.tv",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "sec-ch-ua": (
        '"Chromium";v="110", "Not A(Brand";v="24", '
        '"Google Chrome";v="110"'
    ),
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
}


def _encode_pipe_request(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode_pipe_response(value: str) -> dict:
    try:
        padded = value + "=" * (-len(value) % 4)
        compressed = base64.urlsafe_b64decode(padded)
        return json.loads(gzip.decompress(compressed).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Miruro returned an unreadable response",
        ) from exc


def _translate_id(value: str) -> str:
    try:
        padded = value + "=" * (-len(value) % 4)
        decoded = base64.urlsafe_b64decode(padded).decode()
        return decoded if ":" in decoded else value
    except Exception:
        return value


def _deep_translate_ids(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "id" and isinstance(child, str):
                value[key] = _translate_id(child)
            elif isinstance(child, (dict, list)):
                _deep_translate_ids(child)
    elif isinstance(value, list):
        for child in value:
            if isinstance(child, (dict, list)):
                _deep_translate_ids(child)


async def _pipe(payload: dict) -> dict:
    encoded = _encode_pipe_request(payload)
    try:
        async with AsyncSession(impersonate="chrome110") as client:
            response = await client.get(
                f"{MIRURO_PIPE_URL}?e={encoded}",
                headers=HEADERS,
                timeout=45,
            )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Miruro pipe is unreachable",
        ) from exc
    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Miruro pipe failed ({response.status_code})",
        )
    return _decode_pipe_response(response.text.strip())


async def _fetch_episodes(anilist_id: int) -> dict:
    data = await _pipe(
        {
            "path": "episodes",
            "method": "GET",
            "query": {"anilistId": anilist_id},
            "body": None,
            "version": "0.1.0",
        }
    )
    _deep_translate_ids(data)
    return data


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/episodes/{anilist_id}")
async def episodes(anilist_id: int):
    return await _fetch_episodes(anilist_id)


@app.get("/sources")
async def sources(
    episode_id: str = Query(alias="episodeId"),
    provider: str = Query(),
    anilist_id: int = Query(alias="anilistId"),
    category: str = Query("sub"),
):
    encoded_id = base64.urlsafe_b64encode(episode_id.encode()).decode().rstrip("=")
    return await _pipe(
        {
            "path": "sources",
            "method": "GET",
            "query": {
                "episodeId": encoded_id,
                "provider": provider,
                "category": category,
                "anilistId": anilist_id,
            },
            "body": None,
            "version": "0.1.0",
        }
    )


def _proxy_url(proxy_base: str, target: str, referer: str) -> str:
    return (
        f"{proxy_base.rstrip('/')}?url={quote(target, safe='')}"
        f"&referer={quote(referer, safe='')}"
    )


def _rewrite_playlist(
    body: bytes,
    source_url: str,
    proxy_base: str,
    referer: str,
) -> bytes:
    lines: list[str] = []
    for line in body.decode("utf-8", errors="replace").splitlines():
        stripped = line.strip()
        if not stripped:
            lines.append(line)
            continue
        if stripped.startswith("#"):
            def replace_uri(match: re.Match[str]) -> str:
                absolute = urljoin(source_url, match.group(1))
                return f'URI="{_proxy_url(proxy_base, absolute, referer)}"'

            lines.append(re.sub(r'URI="([^"]+)"', replace_uri, line))
            continue
        absolute = urljoin(source_url, stripped)
        lines.append(_proxy_url(proxy_base, absolute, referer))
    return ("\n".join(lines) + "\n").encode()


@app.get("/proxy")
async def proxy_media(
    url: str = Query(),
    referer: str = Query("https://kwik.cx/"),
    base: str = Query("/api/proxy"),
    range_header: str | None = Header(default=None, alias="Range"),
):
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid media URL")

    referer_parts = urlsplit(referer)
    origin = (
        f"{referer_parts.scheme}://{referer_parts.netloc}"
        if referer_parts.scheme and referer_parts.netloc
        else referer.rstrip("/")
    )
    headers = {
        "User-Agent": HEADERS["User-Agent"],
        "Referer": referer,
        "Origin": origin,
        "Accept": "*/*",
    }
    if range_header:
        headers["Range"] = range_header

    try:
        async with AsyncSession(impersonate="chrome120") as client:
            upstream = await client.get(url, headers=headers, timeout=45)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Media origin is unreachable",
        ) from exc
    if upstream.status_code >= 400:
        raise HTTPException(
            status_code=upstream.status_code,
            detail=f"Media origin failed ({upstream.status_code})",
        )

    content_type = upstream.headers.get(
        "content-type",
        "application/octet-stream",
    )
    body = upstream.content
    path = parsed.path.lower()
    is_playlist = (
        "mpegurl" in content_type
        or "m3u8" in content_type
        or path.endswith(".m3u8")
    )

    response_headers = {"Cache-Control": "no-store"}
    for key in ("content-range", "accept-ranges"):
        value = upstream.headers.get(key)
        if value:
            response_headers[key] = value

    if is_playlist:
        body = _rewrite_playlist(body, url, base, referer)
        content_type = "application/vnd.apple.mpegurl"
    elif (
        "image/" in content_type
        or path.endswith((".jpg", ".jpeg", ".png"))
    ) and not body.startswith((b"\xff\xd8", b"\x89PNG")):
        content_type = "video/mp2t"
    elif path.endswith(".key") or path.endswith("/mon.key"):
        content_type = "application/octet-stream"
    elif path.endswith(".ts"):
        content_type = "video/mp2t"

    return Response(
        content=body,
        status_code=upstream.status_code,
        media_type=content_type,
        headers=response_headers,
    )
