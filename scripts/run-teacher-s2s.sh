#!/usr/bin/env bash
# JoyLingo teacher voice: Hugging Face speech-to-speech realtime server.
# https://github.com/huggingface/speech-to-speech
#
# Uses Whisper STT + --language auto so English↔Japanese switching works.
# (Default Parakeet STT is EU-languages only — do not use it for JoyLingo.)
#
# First run creates .venv-s2s and installs speech-to-speech (large download).
#
# Env (reads packages/api/.env if present):
#   OPENROUTER_API_KEY   required
#   OPENROUTER_MODEL     optional (default meta-llama/llama-3.3-70b-instruct)
#   TEACHER_S2S_PORT     optional (default 8765)
#   TEACHER_S2S_MIN_SILENCE_MS
#     optional — how long to wait after you stop talking before ending the turn
#     (default 2800; raise if it still cuts you off mid-sentence)

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_ENV="$ROOT/packages/api/.env"
VENV="$ROOT/.venv-s2s"

pick_python() {
  local c
  for c in python3.12 python3.11 python3.13 python3; do
    if command -v "$c" >/dev/null 2>&1; then
      local ver
      ver="$("$c" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
      # speech-to-speech deps (e.g. misaki) are not ready for 3.14+ yet
      if "$c" -c 'import sys; raise SystemExit(0 if sys.version_info < (3, 14) else 1)'; then
        echo "$c"
        return 0
      fi
    fi
  done
  return 1
}

if [[ -f "$API_ENV" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$API_ENV"
  set +a
fi

: "${OPENROUTER_API_KEY:?Set OPENROUTER_API_KEY (e.g. in packages/api/.env)}"
MODEL="${OPENROUTER_MODEL:-meta-llama/llama-3.3-70b-instruct}"
PORT="${TEACHER_S2S_PORT:-8765}"

PY="$(pick_python || true)"
if [[ -z "${PY}" ]]; then
  echo "Need Python 3.11–3.13 for speech-to-speech (3.14+ breaks deps like misaki)."
  echo "Install with: brew install python@3.12"
  exit 1
fi

if [[ ! -x "$VENV/bin/speech-to-speech" ]]; then
  echo "Creating $VENV with $PY and installing speech-to-speech (first run can take a while)…"
  rm -rf "$VENV"
  "$PY" -m venv "$VENV"
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
  pip install -U pip
  if [[ "$(uname -s)" == "Darwin" ]]; then
    # mlx-audio Whisper + Qwen3 TTS ship with the base macOS install
    pip install speech-to-speech
  else
    pip install "speech-to-speech[faster-whisper]"
  fi
else
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
fi

# Prefer mlx-audio Whisper on macOS (built-in; multilingual EN↔JA).
# Avoid whisper-mlx / lightning-whisper-mlx — fragile tiktoken pin.
# Default: full large-v3 MLX (public). turbo is faster but weaker on JP / code-switch.
# Note: mlx-community/whisper-large-v3 (no -mlx) is gated/401 — use -mlx or -turbo.
# Override: TEACHER_S2S_STT_MODEL=mlx-community/whisper-large-v3-turbo
STT_MODEL="${TEACHER_S2S_STT_MODEL:-mlx-community/whisper-large-v3-mlx}"
STT_ARGS=(--stt mlx-audio-whisper --mlx_audio_whisper_model_name "$STT_MODEL")
if [[ "$(uname -s)" != "Darwin" ]]; then
  STT_ARGS=(--stt faster-whisper --faster_whisper_stt_model_name large-v3)
fi

# Patient VAD so brief pauses mid-sentence (esp. after "okay…") don't end the turn.
# Live transcription is OFF: it finalizes after a short silence and starts the LLM
# before you finish ("okay" → reply, rest of sentence dropped).
# Upstream defaults are aggressive (min_silence_ms=64).
MIN_SILENCE_MS="${TEACHER_S2S_MIN_SILENCE_MS:-2800}"
SPECULATIVE_REOPEN_MS="${TEACHER_S2S_SPECULATIVE_REOPEN_MS:-5000}"
UNANSWERED_REOPEN_MS="${TEACHER_S2S_UNANSWERED_REOPEN_MS:-15000}"
SPEECH_PAD_MS="${TEACHER_S2S_SPEECH_PAD_MS:-900}"

echo "Starting HF speech-to-speech on ws://127.0.0.1:${PORT}/v1/realtime"
echo "STT: ${STT_ARGS[*]}  language=auto"
echo "LLM: JoyLingo proxy → OpenRouter (UI-selected model; fallback ${MODEL})"
echo "VAD: min_silence=${MIN_SILENCE_MS}ms (no live transcription; wait for full pause)"
echo "In packages/web/.env.local set:"
echo "  VITE_TEACHER_S2S_URL=ws://127.0.0.1:${PORT}/v1/realtime"

# Point S2S at the local API so the teacher model selector controls voice too.
LLM_BASE_URL="${TEACHER_S2S_LLM_URL:-http://127.0.0.1:5174/api/teacher/llm/v1}"

exec speech-to-speech \
  --mode realtime \
  --ws_port "$PORT" \
  "${STT_ARGS[@]}" \
  --language auto \
  --enable_lang_prompt \
  --no_enable_live_transcription \
  --min_silence_ms "$MIN_SILENCE_MS" \
  --speech_pad_ms "$SPEECH_PAD_MS" \
  --speculative_reopen_ms "$SPECULATIVE_REOPEN_MS" \
  --unanswered_reopen_ms "$UNANSWERED_REOPEN_MS" \
  --llm_backend responses-api \
  --tts qwen3 \
  --qwen3_tts_language auto \
  --model_name "$MODEL" \
  --responses_api_base_url "$LLM_BASE_URL" \
  --responses_api_api_key "joylingo-local" \
  --responses_api_stream
