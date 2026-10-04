#!/usr/bin/env python3
"""OpenAI-compatible TTS gateway for the LibreChat add-on.

Listens on 127.0.0.1:${TTS_PORT} (default 3082) and answers
POST /v1/audio/speech by synthesizing through the DashScope SDK
(Alibaba Model Studio, qwen-audio-3.1-tts generation). The requested
`model` and `voice` fields are passed through, so voices can be
switched per user in LibreChat's speech settings; unset fields fall
back to the add-on defaults from /config/.env (see the tts s6 service).

Deliberately stdlib-only besides dashscope: no FastAPI/Flask, no daemon
framework - one file, one thread per request. Long inputs are split at
sentence boundaries (engine per-call limit) and the returned MP3 chunks
are concatenated; frames from the same encoder play back seamlessly.

The service starts even without an API key so s6 does not enter a
restart loop; unconfigured requests fail with a clean 503.
"""

import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import dashscope
from dashscope.audio.tts_v2 import SpeechSynthesizer

API_KEY = os.environ.get("DASHSCOPE_API_KEY", "").strip()
WS_URL = os.environ.get("TTS_WS_URL", "").strip()
DEFAULT_MODEL = os.environ.get("TTS_MODEL", "qwen-audio-3.1-tts-flash").strip()
DEFAULT_VOICE = os.environ.get("TTS_VOICE", "Ava_v3.1").strip()
PORT = int(os.environ.get("TTS_PORT", "3082"))
MAX_CHARS = int(os.environ.get("TTS_MAX_CHARS", "1000"))
# Both optional and off by default: the v3.1 voices synthesize German
# correctly without hints (verified for Ava_v3.1); enable in .env only
# if a voice reads German text with the wrong pronunciation.
LANGUAGE_HINTS = [h.strip() for h in os.environ.get("TTS_LANGUAGE_HINTS", "").split(",") if h.strip()]
INSTRUCTION = os.environ.get("TTS_INSTRUCTION", "").strip()

# The 3.1 TTS generation is served through a per-account dedicated
# websocket gateway, not the public dashscope.aliyuncs.com endpoint
# (the shared cosyvoice engine rejects these models with error 411).
if WS_URL:
    dashscope.base_websocket_api_url = WS_URL
dashscope.api_key = API_KEY

SENTENCE_SPLIT = re.compile(r"(?<=[.!?…])\s+")

# Reasoning models deliver their thought process inline in the message text
# (e.g. <think>...</think> blocks). LibreChat parses these for display only -
# both the manual speaker click and automatic playback send the raw text,
# including the reasoning, to this gateway. Strip the blocks here so only
# the actual answer gets spoken (covers both paths at once).
THINK_BLOCK = re.compile(r"<think>.*?</think>", re.IGNORECASE | re.DOTALL)
THINK_UNCLOSED = re.compile(r"<think>.*", re.IGNORECASE | re.DOTALL)
BLANK_LINES = re.compile(r"\n{3,}")
SPACE_RUNS = re.compile(r"[ \t]{2,}")


def strip_reasoning(text: str) -> str:
    """Remove inline reasoning blocks from the text to synthesize."""
    stripped = THINK_BLOCK.sub(" ", text)
    stripped = THINK_UNCLOSED.sub(" ", stripped)  # clicked mid-generation
    stripped = BLANK_LINES.sub("\n\n", stripped)
    stripped = SPACE_RUNS.sub(" ", stripped)
    return stripped.strip()


def log(level: str, msg: str) -> None:
    print(f"tts: {level}: {msg}", file=sys.stderr, flush=True)


def split_text(text: str, max_chars: int) -> list[str]:
    """Pack sentences into chunks of at most max_chars characters."""
    sentences = [s for s in SENTENCE_SPLIT.split(text) if s.strip()]
    if not sentences:
        return []
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        # A single sentence longer than the limit (e.g. unpunctuated text)
        # is hard-split; anything else is packed greedily.
        while len(sentence) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            chunks.append(sentence[:max_chars])
            sentence = sentence[max_chars:]
        if not sentence:
            continue
        if current and len(current) + 1 + len(sentence) > max_chars:
            chunks.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        chunks.append(current)
    return chunks


def synthesize(text: str, model: str, voice: str) -> bytes:
    kwargs = {"model": model, "voice": voice}
    if LANGUAGE_HINTS:
        kwargs["language_hints"] = LANGUAGE_HINTS
    if INSTRUCTION:
        kwargs["instruction"] = INSTRUCTION
    audio = SpeechSynthesizer(**kwargs).call(text)
    if not audio:
        raise RuntimeError("engine returned no audio")
    return audio


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "LibreChatTTS/1.0"

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_audio(self, audio: bytes) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)

    def _error(self, status: int, message: str, err_type: str) -> None:
        self._send_json(status, {"error": {"message": message, "type": err_type}})

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send_json(200, {
                "status": "ok",
                "configured": bool(API_KEY and WS_URL),
                "model": DEFAULT_MODEL,
                "voice": DEFAULT_VOICE,
                "chunk_chars": MAX_CHARS,
            })
        else:
            self._error(404, "not found", "invalid_request_error")

    def do_POST(self) -> None:
        if self.path != "/v1/audio/speech":
            self._error(404, "not found", "invalid_request_error")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            request = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._error(400, "invalid JSON body", "invalid_request_error")
            return

        text = request.get("input") or ""
        if not isinstance(text, str) or not text.strip():
            self._error(400, "'input' must be a non-empty string", "invalid_request_error")
            return
        text = strip_reasoning(text)
        if not text:
            self._error(400, "input contains only reasoning content - nothing to speak", "invalid_request_error")
            return
        if not API_KEY or not WS_URL:
            self._error(503, "TTS gateway is not configured: set DASHSCOPE_API_KEY and TTS_WS_URL in the add-on .env", "not_configured")
            return

        model = (request.get("model") or DEFAULT_MODEL).strip()
        voice = (request.get("voice") or DEFAULT_VOICE).strip()

        chunks = split_text(text, MAX_CHARS)
        try:
            audio = b"".join(synthesize(chunk, model, voice) for chunk in chunks)
        except TimeoutError:
            self._error(504, "speech synthesis timed out", "timeout")
            return
        except Exception as exc:  # SDK/engine failures surface as RequestFailure
            log("error", f"synthesis failed: {exc}")
            self._error(502, f"speech synthesis failed: {exc}", "engine_error")
            return

        log("info", f"synthesized {len(text)} chars -> {len(audio)} bytes (model={model}, voice={voice}, chunks={len(chunks)})")
        self._send_audio(audio)

    def log_message(self, fmt: str, *args) -> None:
        log("debug", fmt % args)


def main() -> None:
    configured = bool(API_KEY and WS_URL)
    log("info", f"starting on 127.0.0.1:{PORT} (model={DEFAULT_MODEL}, voice={DEFAULT_VOICE}, configured={configured})")
    if not configured:
        log("warning", "DASHSCOPE_API_KEY or TTS_WS_URL missing - requests will fail with 503 until the add-on .env is completed")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
