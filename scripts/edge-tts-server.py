"""Local Edge TTS bridge for RemNote Smart TTS.

This small server lets the RemNote plugin use Microsoft Edge's free online
neural voices (the same voices Edge exposes as "Microsoft Xiaoxiao Online
(Natural)" and friends) from any browser, including Chrome.

Run it with:
    python scripts/edge-tts-server.py

The server binds to 127.0.0.1 only, so it is never reachable from the LAN.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from typing import Any

import edge_tts
from aiohttp import web

HOST = "127.0.0.1"
PORT = 8765
MAX_TEXT_LENGTH = 5000

# Chrome's Private Network Access requires these headers when an HTTPS page
# (app.remnote.com) talks to a localhost server. Without them the fetch is
# blocked even though the server is running.
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "86400",
}

# list_voices() is a network call; cache it for one hour so every synthesis
# request does not need to re-download the whole catalog.
_VOICE_CACHE: dict[str, Any] = {"at": 0.0, "voices": None}


def rate_percent(rate: Any) -> str:
    """Convert the plugin's 0.5-2.0 rate to edge-tts percent syntax."""
    if not isinstance(rate, (int, float)) or rate <= 0:
        return "+0%"
    delta = int(round((rate - 1) * 100))
    return f"{'+' if delta >= 0 else ''}{delta}%"


async def known_voices() -> list[dict[str, Any]]:
    """Return the cached Microsoft voice catalog, refreshing it hourly."""
    if _VOICE_CACHE["voices"] is None or time.monotonic() - _VOICE_CACHE["at"] > 3600:
        _VOICE_CACHE["voices"] = await edge_tts.list_voices()
        _VOICE_CACHE["at"] = time.monotonic()
    return _VOICE_CACHE["voices"]


@web.middleware
async def cors_middleware(
    request: web.Request, handler: Any
) -> web.StreamResponse:
    """Answer CORS preflights and attach CORS headers to every response."""
    if request.method == "OPTIONS":
        return web.Response(status=204, headers=CORS_HEADERS)
    response = await handler(request)
    for key, value in CORS_HEADERS.items():
        response.headers[key] = value
    return response


def json_error(status: int, message: str) -> web.Response:
    return web.json_response({"ok": False, "error": message}, status=status)


async def handle_health(request: web.Request) -> web.Response:
    try:
        voices = await known_voices()
    except Exception as exc:
        print(f"[edge-tts] health check could not load voices: {exc}", file=sys.stderr)
        voices = []
    return web.json_response(
        {"ok": True, "service": "edge-tts", "voiceCount": len(voices)}
    )


async def handle_voices(request: web.Request) -> web.Response:
    locale = request.query.get("locale", "").strip().lower()
    try:
        voices = await known_voices()
    except Exception as exc:
        return json_error(502, f"Could not load the voice catalog: {exc}")
    if locale:
        voices = [
            voice
            for voice in voices
            if str(voice.get("Locale", "")).lower().startswith(locale)
        ]
    return web.json_response(
        [
            {
                "name": voice.get("ShortName", ""),
                "locale": voice.get("Locale", ""),
                "gender": voice.get("Gender", ""),
                "friendlyName": voice.get("FriendlyName", ""),
            }
            for voice in voices
        ]
    )


async def handle_tts(request: web.Request) -> web.StreamResponse:
    try:
        body = await request.json()
    except Exception:
        return json_error(400, "Request body must be JSON.")

    text = str(body.get("text", "")).strip()
    voice = str(body.get("voice", "")).strip()
    rate = rate_percent(body.get("rate", 1.0))

    if not text:
        return json_error(400, "text is required.")
    if len(text) > MAX_TEXT_LENGTH:
        return json_error(400, f"text is too long (max {MAX_TEXT_LENGTH} characters).")
    if not voice:
        return json_error(400, "voice is required.")

    try:
        voice_names = {item.get("ShortName", "") for item in await known_voices()}
    except Exception as exc:
        print(f"[edge-tts] could not load the voice catalog: {exc}", file=sys.stderr)
        voice_names = set()
    if voice_names and voice not in voice_names:
        return json_error(
            400,
            f"Voice '{voice}' is not in the Microsoft catalog. "
            "Run GET /voices to see the available voices.",
        )

    print(
        f"[edge-tts] synthesizing {len(text)} chars with {voice} at {rate} "
        f"({request.remote})"
    )
    # NOTE: Communicate.stream() is an async generator, not an async context
    # manager. Wrapping it in "async with" fails silently and returns an empty
    # audio stream, so iterate it directly.
    try:
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        response = web.StreamResponse(
            headers={"Content-Type": "audio/mpeg", **CORS_HEADERS}
        )
        await response.prepare(request)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                await response.write(chunk["data"])
        await response.write_eof()
        return response
    except Exception as exc:
        # Headers are already sent at this point, so a JSON error is no longer
        # possible. Log it and close the stream; the plugin shows its own
        # playback error message when the MP3 ends early.
        print(f"[edge-tts] synthesis failed: {exc}", file=sys.stderr)
        try:
            await response.write_eof()
        except Exception:
            pass
        return response


async def handle_root(request: web.Request) -> web.Response:
    return web.Response(
        text=(
            "Edge TTS bridge for RemNote Smart TTS.\n"
            "Endpoints: GET /health, GET /voices, POST /tts\n"
        ),
        content_type="text/plain",
    )


async def main() -> None:
    parser = argparse.ArgumentParser(description="Local Edge TTS bridge")
    parser.add_argument("--host", default=HOST)
    parser.add_argument("--port", type=int, default=PORT)
    args = parser.parse_args()

    app = web.Application(middlewares=[cors_middleware])
    app.add_routes(
        [
            web.get("/", handle_root),
            web.get("/health", handle_health),
            web.get("/voices", handle_voices),
            web.post("/tts", handle_tts),
        ]
    )
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, args.host, args.port)
    await site.start()
    print(f"[edge-tts] server ready at http://{args.host}:{args.port}")
    print("[edge-tts] keep this window running while you review cards.")
    try:
        while True:
            await asyncio.sleep(3600)
    finally:
        await runner.cleanup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[edge-tts] stopped.")
