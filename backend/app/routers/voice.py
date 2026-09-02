"""Voice endpoints: Whisper STT + ElevenLabs TTS."""

import os
from pathlib import Path
from tempfile import NamedTemporaryFile

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, File, UploadFile, Query
from fastapi.responses import StreamingResponse

REPO = Path(__file__).resolve().parents[3]
load_dotenv(REPO / ".env")

OPENAI_KEY = (os.getenv("LLM_API_KEY") or os.getenv("OPEN_AI_API_KEY")
              or os.getenv("OPENAI_API_KEY"))
ELEVENLABS_KEY = os.getenv("ELEVENLABS_API_KEY")
# Rachel - clear female voice, good for education
ELEVENLABS_VOICE = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/stt")
async def speech_to_text(audio: UploadFile = File(...)):
    """Transcribe audio via OpenAI Whisper. Accepts webm/wav/mp3/m4a."""
    if not OPENAI_KEY:
        return {"error": "No OpenAI API key configured"}

    # whisper needs a file with an extension
    suffix = ".webm"
    if audio.content_type:
        ext_map = {"audio/wav": ".wav", "audio/mp3": ".mp3", "audio/mpeg": ".mp3",
                   "audio/webm": ".webm", "audio/m4a": ".m4a", "audio/mp4": ".m4a"}
        suffix = ext_map.get(audio.content_type, ".webm")

    with NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as f:
            r = requests.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {OPENAI_KEY}"},
                files={"file": (f"audio{suffix}", f, audio.content_type or "audio/webm")},
                data={"model": "whisper-1"},
                timeout=30,
            )
        r.raise_for_status()
        return {"text": r.json()["text"]}
    finally:
        os.unlink(tmp_path)


@router.post("/tts")
async def text_to_speech(
    text: str = Query(..., max_length=5000),
    voice_id: str = Query(default=None),
):
    """Convert text to speech via ElevenLabs. Returns audio/mpeg stream."""
    if not ELEVENLABS_KEY:
        return {"error": "No ElevenLabs API key configured"}

    vid = voice_id or ELEVENLABS_VOICE
    r = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{vid}",
        headers={"xi-api-key": ELEVENLABS_KEY, "Content-Type": "application/json"},
        json={
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        },
        stream=True,
        timeout=30,
    )
    r.raise_for_status()
    return StreamingResponse(r.iter_content(chunk_size=4096),
                             media_type="audio/mpeg")
