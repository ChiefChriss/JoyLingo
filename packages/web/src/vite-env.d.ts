/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Local-dev teacher panel. Leave unset in production. */
  readonly VITE_TEACHER_ENABLED?: string;
  /** Local-only voice (browser TTS / optional local TTS URL). */
  readonly VITE_TEACHER_VOICE?: string;
  readonly VITE_TEACHER_TTS_URL?: string;
  /** Hugging Face speech-to-speech OpenAI Realtime WebSocket URL. */
  readonly VITE_TEACHER_S2S_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
