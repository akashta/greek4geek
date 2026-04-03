from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from google.api_core.exceptions import (
    DeadlineExceeded,
    GoogleAPICallError,
    PermissionDenied,
    ResourceExhausted,
    ServiceUnavailable,
    TooManyRequests,
    Unauthenticated,
)
from google.cloud import texttospeech


DEFAULT_WORDS_CSV = Path("words.csv")
DEFAULT_OUTPUT_DIR = Path("audio") / "charon"
DEFAULT_MANIFEST_PATH = DEFAULT_OUTPUT_DIR / "manifest.json"
DEFAULT_LANGUAGE_CODE = "el-GR"
DEFAULT_VOICE_NAME = "el-GR-Chirp3-HD-Charon"
DEFAULT_SPEAKING_RATE = 0.95
DEFAULT_REQUEST_INTERVAL = 1.0
DEFAULT_MAX_RETRIES = 6
DEFAULT_RETRY_BASE_DELAY = 5.0
DEFAULT_AUDIO_ENCODING = texttospeech.AudioEncoding.MP3

VOICE_PREFERENCE_ORDER = (
    "Chirp3-HD",
    "Studio",
    "Neural2",
    "Wavenet",
    "Standard",
)


@dataclass(frozen=True)
class AudioWord:
    id: str
    greek: str


def build_audio_file_name(word: AudioWord) -> str:
    return f"{word.id}.mp3"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Greek MP3 files from words.csv using Google Cloud TTS.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_WORDS_CSV)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST_PATH)
    parser.add_argument("--voice-name", type=str)
    parser.add_argument("--language-code", type=str, default=DEFAULT_LANGUAGE_CODE)
    parser.add_argument("--speaking-rate", type=float, default=DEFAULT_SPEAKING_RATE)
    parser.add_argument("--request-interval", type=float, default=DEFAULT_REQUEST_INTERVAL)
    parser.add_argument("--max-retries", type=int, default=DEFAULT_MAX_RETRIES)
    parser.add_argument("--retry-base-delay", type=float, default=DEFAULT_RETRY_BASE_DELAY)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--text", type=str, help="Generate audio only for a single Greek text.")
    return parser.parse_args()


def load_unique_words(csv_path: Path) -> list[AudioWord]:
    seen: set[str] = set()
    words: list[AudioWord] = []

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or "id" not in reader.fieldnames or "greek" not in reader.fieldnames:
            raise ValueError("words.csv must contain 'id' and 'greek' columns.")

        for row in reader:
            word_id = (row.get("id") or "").strip()
            greek = (row.get("greek") or "").strip()
            if not word_id or not greek or greek in seen:
                continue

            seen.add(greek)
            words.append(AudioWord(id=word_id, greek=greek))

    return words


def choose_voice(client: texttospeech.TextToSpeechClient, language_code: str, requested_voice: str | None) -> str:
    if requested_voice:
        return requested_voice

    response = client.list_voices(language_code=language_code)
    voice_names = [voice.name for voice in response.voices if voice.name.startswith(language_code)]

    if DEFAULT_VOICE_NAME in voice_names:
        return DEFAULT_VOICE_NAME

    for voice_type in VOICE_PREFERENCE_ORDER:
        for name in voice_names:
            if voice_type in name:
                return name

    if voice_names:
        return voice_names[0]

    raise RuntimeError(f"No Google Cloud TTS voices found for language '{language_code}'.")


def synthesize_word(
    client: texttospeech.TextToSpeechClient,
    word: str,
    voice_name: str,
    language_code: str,
    speaking_rate: float,
) -> bytes:
    request = texttospeech.SynthesizeSpeechRequest(
        input=texttospeech.SynthesisInput(text=word),
        voice=texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=voice_name,
        ),
        audio_config=texttospeech.AudioConfig(
            audio_encoding=DEFAULT_AUDIO_ENCODING,
            speaking_rate=speaking_rate,
        ),
    )
    response = client.synthesize_speech(request=request)
    return response.audio_content


def is_retryable_error(error: Exception) -> bool:
    return isinstance(error, (TooManyRequests, ResourceExhausted, ServiceUnavailable, DeadlineExceeded))


def build_manifest(words: list[AudioWord], output_dir: Path) -> dict[str, object]:
    by_id: dict[str, str] = {}
    by_greek: dict[str, str] = {}
    for word in words:
        relative_path = str((output_dir / build_audio_file_name(word)).as_posix())
        by_id[word.id] = relative_path
        by_greek[word.greek] = relative_path

    return {
        "byId": by_id,
        "byGreek": by_greek,
    }


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    args = parse_args()

    if args.text:
        words = [AudioWord(id="manual", greek=args.text.strip())]
    else:
        words = load_unique_words(args.csv)

    if args.limit:
        words = words[: args.limit]

    if not words:
        print("No Greek words found.", file=sys.stderr)
        return 1

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    pending_words = []
    for word in words:
        output_path = output_dir / build_audio_file_name(word)
        if output_path.exists() and not args.force:
            continue
        pending_words.append(word)

    try:
        client = texttospeech.TextToSpeechClient()
        voice_name = choose_voice(client, args.language_code, args.voice_name)
    except Unauthenticated as error:
        print("Google ADC is not configured. Run 'gcloud auth application-default login' first.", file=sys.stderr)
        print(str(error), file=sys.stderr)
        return 2
    except PermissionDenied as error:
        print("Google Cloud access was denied. Check that Text-to-Speech API is enabled and your account has access.", file=sys.stderr)
        print(str(error), file=sys.stderr)
        return 3
    except GoogleAPICallError as error:
        print("Google Cloud TTS initialization failed.", file=sys.stderr)
        print(str(error), file=sys.stderr)
        return 4

    print(f"Using Google voice: {voice_name}")
    print(
        f"Request pacing: {args.request_interval:.2f}s between requests, "
        f"up to {args.max_retries} retries with base delay {args.retry_base_delay:.1f}s"
    )

    generated_count = 0
    for index, word in enumerate(pending_words, start=1):
        output_path = output_dir / build_audio_file_name(word)
        audio_content: bytes | None = None

        for attempt in range(args.max_retries + 1):
            try:
                audio_content = synthesize_word(
                    client=client,
                    word=word.greek,
                    voice_name=voice_name,
                    language_code=args.language_code,
                    speaking_rate=args.speaking_rate,
                )
                break
            except (Unauthenticated, PermissionDenied) as error:
                print(f"[{index}/{len(pending_words)}] failed {word.greek}: {error}", file=sys.stderr)
                break
            except GoogleAPICallError as error:
                if not is_retryable_error(error) or attempt >= args.max_retries:
                    print(f"[{index}/{len(pending_words)}] failed {word.greek}: {error}", file=sys.stderr)
                    break

                delay = args.retry_base_delay * (2**attempt)
                print(
                    f"[{index}/{len(pending_words)}] retrying {word.greek} after {delay:.1f}s "
                    f"because of {error.__class__.__name__}",
                    file=sys.stderr,
                )
                time.sleep(delay)

        if audio_content is None:
            time.sleep(args.request_interval)
            continue

        output_path.write_bytes(audio_content)
        generated_count += 1
        print(f"[{index}/{len(pending_words)}] saved {output_path.name} <- {word.greek}")
        time.sleep(args.request_interval)

    manifest = build_manifest(words, output_dir)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Generated {generated_count} MP3 files into {output_dir}.")
    print(f"Manifest written to {args.manifest}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
