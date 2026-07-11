/**
 * Hugging Face speech-to-speech client (OpenAI Realtime-compatible WebSocket).
 * @see https://github.com/huggingface/speech-to-speech
 *
 * Local server: `npm run teacher:s2s` → ws://127.0.0.1:8765/v1/realtime
 * Uses Whisper STT with --language auto so EN↔JA code-switching works.
 */

const TARGET_RATE = 16_000;

export interface TeacherS2SHandlers {
  onStatus?: (status: string) => void;
  onUserPartial?: (text: string) => void;
  onUserFinal?: (text: string) => void;
  onAssistantText?: (text: string) => void;
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
  onError?: (message: string) => void;
  onClosed?: () => void;
}

export interface TeacherS2SSession {
  stop: () => void;
}

export function teacherS2SConfigured(): boolean {
  return Boolean(import.meta.env.VITE_TEACHER_S2S_URL?.trim());
}

export function teacherS2SUrl(): string {
  const raw = import.meta.env.VITE_TEACHER_S2S_URL?.trim();
  if (!raw) {
    throw new Error(
      "VITE_TEACHER_S2S_URL is not set. Run npm run teacher:s2s and set the URL in .env.local",
    );
  }
  return raw.replace(/\/$/, "");
}

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]!));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function downsample(
  input: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    output[i] = input[Math.floor(i * ratio)] ?? 0;
  }
  return output;
}

class PcmPlayer {
  private ctx: AudioContext | null = null;
  private nextTime = 0;
  private readonly rate: number;
  private sources: AudioBufferSourceNode[] = [];

  constructor(rate = TARGET_RATE) {
    this.rate = rate;
  }

  async ensure(): Promise<AudioContext> {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ sampleRate: this.rate });
      this.nextTime = 0;
      this.sources = [];
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }

  async enqueueBase64Pcm16(b64: string): Promise<void> {
    const ctx = await this.ensure();
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const samples = new Int16Array(bytes.buffer);
    const floats = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      floats[i] = (samples[i] ?? 0) / 0x8000;
    }
    const audio = ctx.createBuffer(1, floats.length, this.rate);
    audio.copyToChannel(floats, 0);
    const src = ctx.createBufferSource();
    src.buffer = audio;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime + 0.02, this.nextTime);
    src.start(startAt);
    this.nextTime = startAt + audio.duration;
    this.sources.push(src);
    src.onended = () => {
      this.sources = this.sources.filter((s) => s !== src);
    };
  }

  /** Stop queued/playing assistant audio (barge-in). */
  interrupt(): void {
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    this.sources = [];
    this.nextTime = 0;
  }

  dispose(): void {
    this.interrupt();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

/**
 * Start a duplex voice session against a local HF speech-to-speech realtime server.
 */
export async function startTeacherS2SSession(opts: {
  instructions: string;
  handlers?: TeacherS2SHandlers;
}): Promise<TeacherS2SSession> {
  const handlers = opts.handlers ?? {};
  const url = teacherS2SUrl();
  const player = new PcmPlayer(TARGET_RATE);

  handlers.onStatus?.("Requesting microphone…");
  const media = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  handlers.onStatus?.("Connecting to speech-to-speech…");
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";

  let closed = false;
  let audioCtx: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    try {
      ws.close();
    } catch {
      // ignore
    }
    processor?.disconnect();
    source?.disconnect();
    void audioCtx?.close();
    media.getTracks().forEach((t) => t.stop());
    player.dispose();
    handlers.onClosed?.();
  };

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Timed out connecting to speech-to-speech"));
    }, 15_000);
    ws.onopen = () => {
      window.clearTimeout(timer);
      resolve();
    };
    ws.onerror = () => {
      window.clearTimeout(timer);
      reject(
        new Error(
          "Could not reach speech-to-speech. Is `npm run teacher:s2s` running?",
        ),
      );
    };
  });

  ws.send(
    JSON.stringify({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: opts.instructions,
        audio: {
          input: {
            turn_detection: {
              type: "server_vad",
              interrupt_response: true,
            },
          },
          output: {},
        },
      },
    }),
  );

  ws.onmessage = (ev) => {
    if (typeof ev.data !== "string") return;
    let event: {
      type?: string;
      delta?: string;
      transcript?: string;
      error?: { message?: string; type?: string };
    };
    try {
      event = JSON.parse(ev.data) as typeof event;
    } catch {
      return;
    }

    switch (event.type) {
      case "session.created":
        handlers.onStatus?.("Voice connected — speak naturally (EN/JA ok)");
        break;
      case "input_audio_buffer.speech_started":
        player.interrupt();
        handlers.onSpeechStarted?.();
        handlers.onStatus?.("Listening…");
        break;
      case "input_audio_buffer.speech_stopped":
        handlers.onSpeechStopped?.();
        handlers.onStatus?.("Transcribing…");
        break;
      case "conversation.item.input_audio_transcription.delta":
        if (event.delta?.trim()) handlers.onUserPartial?.(event.delta.trim());
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript?.trim()) {
          handlers.onUserFinal?.(event.transcript.trim());
        }
        handlers.onStatus?.("Thinking…");
        break;
      case "response.created":
        handlers.onStatus?.("Teacher speaking…");
        break;
      case "response.output_audio.delta":
        if (event.delta) void player.enqueueBase64Pcm16(event.delta);
        break;
      case "response.output_audio_transcript.done":
        if (event.transcript?.trim()) {
          handlers.onAssistantText?.(event.transcript.trim());
        }
        break;
      case "response.done":
        handlers.onStatus?.("Voice connected — speak naturally (EN/JA ok)");
        break;
      case "error":
        handlers.onError?.(
          event.error?.message ?? event.error?.type ?? "Speech-to-speech error",
        );
        break;
      default:
        break;
    }
  };

  ws.onclose = () => {
    if (!closed) {
      handlers.onError?.("Speech-to-speech connection closed");
      cleanup();
    }
  };

  audioCtx = new AudioContext();
  source = audioCtx.createMediaStreamSource(media);
  // ScriptProcessor is deprecated but widely available; fine for local-dev voice.
  processor = audioCtx.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (e) => {
    if (closed || ws.readyState !== WebSocket.OPEN) return;
    const input = e.inputBuffer.getChannelData(0);
    const down = downsample(input, audioCtx!.sampleRate, TARGET_RATE);
    const pcm = floatTo16BitPCM(down);
    ws.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: toBase64(pcm),
      }),
    );
  };
  const mute = audioCtx.createGain();
  mute.gain.value = 0;
  source.connect(processor);
  processor.connect(mute);
  mute.connect(audioCtx.destination);

  handlers.onStatus?.("Voice connected — speak naturally (EN/JA ok)");

  return {
    stop: () => {
      cleanup();
    },
  };
}
