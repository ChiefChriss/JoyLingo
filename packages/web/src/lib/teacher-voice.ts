/**
 * Browser voice helpers for the lesson teacher.
 * - Read aloud / Listen: speechSynthesis (no cloud key)
 * - Dictation: Web Speech Recognition when available
 * - Japanese study TTS: still gated by VITE_TEACHER_VOICE
 */

const DEFAULT_STUDY_RATE = 0.82;
const DEFAULT_READ_RATE = 1;

export interface SpeakJapaneseOptions {
  /** Kana reading is preferred over the display surface when provided. */
  reading?: string;
  /** Browser/local TTS playback rate. 0.82 is deliberately slower for study. */
  rate?: number;
}

export interface ReadAloudOptions {
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

export interface DictationOptions {
  lang?: string;
  /** Called with the latest transcript (interim or final). */
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

let localRequest: AbortController | null = null;
let localAudio: HTMLAudioElement | null = null;
let localAudioUrl: string | null = null;
let activeDictation: SpeechRecognitionLike | null = null;
let readAloudGeneration = 0;

function localTtsUrl(): string | null {
  const url = import.meta.env.VITE_TEACHER_TTS_URL?.trim();
  return url || null;
}

export function pronunciationVoiceEnabled(): boolean {
  return import.meta.env.VITE_TEACHER_VOICE === "true";
}

export function speechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionAvailable(): boolean {
  return speechRecognitionCtor() !== null;
}

/** Prefer the teacher's kana-only `Speak:` line over reading an English explanation. */
export function teacherSpeakText(answer: string): string {
  const speakLine = answer.match(
    /(?:^|\n)\s*(?:\*\*)?Speak(?:\*\*)?:\s*([^\n]+)/i,
  )?.[1];
  return (speakLine ?? answer).replace(/[*_`]/g, "").trim();
}

/** Strip light markdown so TTS doesn't say asterisks / backticks. */
export function plainTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[|_~>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Study-speed Japanese pronunciation (fusion / dictionary / Speak line).
 * Gated by VITE_TEACHER_VOICE.
 */
export function speakJapanese(
  text: string,
  options: SpeakJapaneseOptions = {},
): void {
  const spokenText = options.reading?.trim() || text.trim();
  if (
    !pronunciationVoiceEnabled() ||
    !spokenText ||
    typeof window === "undefined"
  ) {
    return;
  }

  stopSpeaking();
  const rate = options.rate ?? DEFAULT_STUDY_RATE;

  const endpoint = localTtsUrl();
  if (endpoint) {
    localRequest = new AbortController();
    void speakViaLocalTts(endpoint, spokenText, rate, localRequest.signal);
    return;
  }

  speakWithBrowser(spokenText, rate, "ja-JP");
}

/**
 * ChatGPT-style read aloud for a full teacher reply (English + Japanese chunks).
 * Available whenever the browser supports speechSynthesis — no extra env flag.
 */
export function readAloud(text: string, options: ReadAloudOptions = {}): void {
  if (!speechSynthesisAvailable()) {
    options.onError?.("Speech synthesis is not available in this browser");
    return;
  }
  const cleaned = plainTextForSpeech(text);
  if (!cleaned) {
    options.onError?.("Nothing to read");
    return;
  }

  stopSpeaking();
  const generation = ++readAloudGeneration;
  const rate = options.rate ?? DEFAULT_READ_RATE;
  const chunks = splitForSpeech(cleaned);
  if (chunks.length === 0) {
    options.onError?.("Nothing to read");
    return;
  }

  options.onStart?.();
  let index = 0;
  let started = false;

  const speakNext = () => {
    if (generation !== readAloudGeneration) return;
    if (index >= chunks.length) {
      options.onEnd?.();
      return;
    }
    const chunk = chunks[index++]!;
    const utter = new SpeechSynthesisUtterance(chunk.text);
    utter.lang = chunk.lang;
    utter.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((voice) =>
      voice.lang.toLowerCase().startsWith(chunk.lang.slice(0, 2).toLowerCase()),
    );
    if (match) utter.voice = match;
    utter.onend = speakNext;
    utter.onerror = () => {
      if (generation === readAloudGeneration) options.onEnd?.();
    };
    window.speechSynthesis.speak(utter);
  };

  const begin = () => {
    if (started || generation !== readAloudGeneration) return;
    started = true;
    speakNext();
  };

  // Chrome often returns [] until voiceschanged fires once.
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.addEventListener("voiceschanged", begin, {
      once: true,
    });
    window.setTimeout(begin, 250);
  } else {
    begin();
  }
}

export function stopSpeaking(): void {
  if (typeof window === "undefined") return;
  readAloudGeneration += 1;
  localRequest?.abort();
  localRequest = null;
  if (localAudio) {
    localAudio.pause();
    localAudio.src = "";
    localAudio = null;
  }
  if (localAudioUrl) {
    URL.revokeObjectURL(localAudioUrl);
    localAudioUrl = null;
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/**
 * Push-to-talk / tap-to-dictate via Web Speech Recognition.
 * Returns a stop function.
 */
export function startDictation(options: DictationOptions): () => void {
  stopDictation();
  const Ctor = speechRecognitionCtor();
  if (!Ctor) {
    options.onError?.("Speech recognition is not available in this browser");
    options.onEnd?.();
    return () => {};
  }

  const recognition = new Ctor();
  activeDictation = recognition;
  recognition.lang = options.lang ?? "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = "";

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (!result) continue;
      const piece = result[0]?.transcript ?? "";
      if (result.isFinal) {
        finalText = `${finalText} ${piece}`.trim();
        options.onResult(finalText, true);
      } else {
        interim += piece;
      }
    }
    if (interim) {
      options.onResult(`${finalText} ${interim}`.trim(), false);
    }
  };

  recognition.onerror = (event) => {
    const code = event.error ?? "failed";
    if (code !== "aborted" && code !== "no-speech") {
      options.onError?.(
        code === "not-allowed"
          ? "Microphone permission denied"
          : `Dictation error: ${code}`,
      );
    }
  };

  recognition.onend = () => {
    if (activeDictation === recognition) activeDictation = null;
    options.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    activeDictation = null;
    options.onError?.("Could not start microphone");
    options.onEnd?.();
  }

  return () => {
    if (activeDictation === recognition) {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      activeDictation = null;
    }
  };
}

export function stopDictation(): void {
  if (!activeDictation) return;
  try {
    activeDictation.abort();
  } catch {
    try {
      activeDictation.stop();
    } catch {
      // ignore
    }
  }
  activeDictation = null;
}

async function speakViaLocalTts(
  endpoint: string,
  text: string,
  rate: number,
  signal: AbortSignal,
): Promise<void> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, lang: "ja", rate }),
      signal,
    });
    if (!res.ok) throw new Error(`local TTS ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("audio")) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      localAudio = audio;
      localAudioUrl = url;
      audio.onended = clearLocalAudio;
      audio.onerror = clearLocalAudio;
      await audio.play();
      return;
    }
    speakWithBrowser(text, rate, "ja-JP");
  } catch {
    if (!signal.aborted) speakWithBrowser(text, rate, "ja-JP");
  } finally {
    if (localRequest?.signal === signal) localRequest = null;
  }
}

function clearLocalAudio(): void {
  localAudio = null;
  if (localAudioUrl) {
    URL.revokeObjectURL(localAudioUrl);
    localAudioUrl = null;
  }
}

function speakWithBrowser(text: string, rate: number, lang: string): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find((voice) =>
    voice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()),
  );
  if (match) utter.voice = match;
  window.speechSynthesis.speak(utter);
}

function isJapaneseChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x3040 && code <= 0x30ff) || // hiragana + katakana
    (code >= 0x3400 && code <= 0x9fff) || // CJK
    (code >= 0xff66 && code <= 0xff9d) // halfwidth katakana
  );
}

/** Split mixed EN/JA text into speech chunks with matching voices. */
function splitForSpeech(text: string): { text: string; lang: string }[] {
  const chunks: { text: string; lang: string }[] = [];
  let buffer = "";
  let japanese: boolean | null = null;

  const flush = () => {
    const piece = buffer.trim();
    if (!piece || japanese === null) {
      buffer = "";
      return;
    }
    chunks.push({ text: piece, lang: japanese ? "ja-JP" : "en-US" });
    buffer = "";
  };

  for (const ch of text) {
    if (/\s/.test(ch)) {
      buffer += ch;
      continue;
    }
    const ja = isJapaneseChar(ch);
    if (japanese === null) japanese = ja;
    if (ja !== japanese) {
      flush();
      japanese = ja;
    }
    buffer += ch;
  }
  flush();
  return chunks;
}
