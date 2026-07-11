import { useEffect, useMemo, useRef, useState } from "react";
import type { EduLessonId } from "@joylingo/shared";
import {
  fetchTeacherModels,
  fetchTeacherVoiceSession,
  setTeacherVoiceModel,
  streamTeacherChat,
  type TeacherModelInfo,
} from "../lib/teacher-api";
import {
  loadTeacherMemory,
  loadTeacherModel,
  rememberExchange,
  saveTeacherModel,
  teacherVoiceEnabled,
  type TeacherChatMessage,
  type TeacherMemory,
} from "../lib/teacher-memory";
import {
  startTeacherS2SSession,
  teacherS2SConfigured,
  type TeacherS2SSession,
} from "../lib/teacher-s2s";
import {
  readAloud,
  speechRecognitionAvailable,
  speechSynthesisAvailable,
  speakJapanese,
  startDictation,
  stopDictation,
  stopSpeaking,
  teacherSpeakText,
} from "../lib/teacher-voice";

interface Props {
  lessonId: EduLessonId;
  lessonTitle: string;
}

const AUTO_LISTEN_KEY = "joylingo:teacher-auto-listen";

function loadAutoListen(): boolean {
  try {
    return localStorage.getItem(AUTO_LISTEN_KEY) === "true";
  } catch {
    return false;
  }
}

function saveAutoListen(value: boolean): void {
  try {
    localStorage.setItem(AUTO_LISTEN_KEY, value ? "true" : "false");
  } catch {
    // ignore
  }
}

export function TeacherPanel({ lessonId, lessonTitle }: Props) {
  /** Open by default so the right-rail chat is immediately usable on lesson pages. */
  const [open, setOpen] = useState(true);
  const [memory, setMemory] = useState<TeacherMemory>(() =>
    loadTeacherMemory(lessonId),
  );
  const [messages, setMessages] = useState<TeacherChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<TeacherModelInfo[]>([]);
  const [model, setModel] = useState(() => loadTeacherModel() ?? "");
  const [modelFilter, setModelFilter] = useState("");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [listeningIndex, setListeningIndex] = useState<number | null>(null);
  const [dictating, setDictating] = useState(false);
  const [autoListen, setAutoListen] = useState(loadAutoListen);
  const [voiceCall, setVoiceCall] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stopDictationRef = useRef<(() => void) | null>(null);
  const s2sRef = useRef<TeacherS2SSession | null>(null);
  const pendingUserRef = useRef<string>("");
  const voice = teacherVoiceEnabled();
  const canListen = speechSynthesisAvailable();
  const s2sReady = teacherS2SConfigured();
  const canDictate = !s2sReady && speechRecognitionAvailable();

  const stopVoiceCall = () => {
    s2sRef.current?.stop();
    s2sRef.current = null;
    setVoiceCall(false);
    setVoiceStatus(null);
  };

  useEffect(() => {
    setMemory(loadTeacherMemory(lessonId));
    setMessages([]);
    setError(null);
    setListeningIndex(null);
    abortRef.current?.abort();
    stopSpeaking();
    stopDictationRef.current?.();
    stopDictationRef.current = null;
    stopDictation();
    setDictating(false);
    stopVoiceCall();
  }, [lessonId]);

  useEffect(() => () => {
    abortRef.current?.abort();
    stopSpeaking();
    stopDictationRef.current?.();
    stopDictation();
    s2sRef.current?.stop();
  }, []);

  useEffect(() => {
    if (!open || models.length > 0) return;
    const controller = new AbortController();
    setModelsLoading(true);
    setModelsError(null);
    void fetchTeacherModels(controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setModels(res.models);
        const saved = loadTeacherModel();
        const next =
          (saved && res.models.some((m) => m.id === saved) && saved) ||
          res.defaultModel ||
          res.models[0]?.id ||
          "";
        setModel(next);
        if (next) {
          saveTeacherModel(next);
          void setTeacherVoiceModel(next).catch(() => {
            /* API may still be starting */
          });
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setModelsError(
          err instanceof Error ? err.message : "Failed to load models",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setModelsLoading(false);
      });
    return () => controller.abort();
  }, [open, models.length]);

  const filteredModels = useMemo(() => {
    const q = modelFilter.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    );
  }, [models, modelFilter]);

  const selectOptions = useMemo(() => {
    if (!model || filteredModels.some((m) => m.id === model)) {
      return filteredModels;
    }
    const selected = models.find((m) => m.id === model);
    return selected ? [selected, ...filteredModels] : filteredModels;
  }, [filteredModels, model, models]);

  const startNewQuestion = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStreaming(false);
    setListeningIndex(null);
    stopSpeaking();
  };

  const toggleListen = (index: number, content: string) => {
    if (!canListen || !content.trim() || voiceCall) return;
    if (listeningIndex === index) {
      stopSpeaking();
      setListeningIndex(null);
      return;
    }
    setListeningIndex(index);
    readAloud(content, {
      onEnd: () => setListeningIndex((cur) => (cur === index ? null : cur)),
      onError: (message) => {
        setListeningIndex(null);
        setError(message);
      },
    });
  };

  const toggleDictation = () => {
    if (!canDictate || streaming || voiceCall) return;
    if (dictating) {
      stopDictationRef.current?.();
      stopDictationRef.current = null;
      stopDictation();
      setDictating(false);
      return;
    }
    setError(null);
    setDictating(true);
    stopDictationRef.current = startDictation({
      lang: "en-US",
      onResult: (text) => setInput(text),
      onError: (message) => setError(message),
      onEnd: () => {
        setDictating(false);
        stopDictationRef.current = null;
      },
    });
  };

  const toggleVoiceCall = async () => {
    if (voiceCall) {
      stopVoiceCall();
      return;
    }
    if (!s2sReady) {
      setError(
        "Set VITE_TEACHER_S2S_URL and run npm run teacher:s2s (Hugging Face speech-to-speech).",
      );
      return;
    }
    if (dictating) {
      stopDictationRef.current?.();
      stopDictationRef.current = null;
      stopDictation();
      setDictating(false);
    }
    stopSpeaking();
    setListeningIndex(null);
    setError(null);
    setVoiceStatus("Starting voice session…");
    setVoiceCall(true);

    try {
      const session = await fetchTeacherVoiceSession({
        lessonId,
        memory,
        model: model || undefined,
      });
      const handle = await startTeacherS2SSession({
        instructions: session.instructions,
        handlers: {
          onStatus: setVoiceStatus,
          onUserPartial: (text) => {
            pendingUserRef.current = text;
            setInput(text);
          },
          onUserFinal: (text) => {
            pendingUserRef.current = text;
            setInput("");
            setMessages((prev) => [...prev, { role: "user", content: text }]);
          },
          onAssistantText: (text) => {
            const question = pendingUserRef.current;
            pendingUserRef.current = "";
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: text },
            ]);
            if (question.trim() && text.trim()) {
              setMemory(rememberExchange(lessonId, question, text));
            }
          },
          onError: (message) => {
            setError(message);
            setVoiceStatus(message);
          },
          onClosed: () => {
            s2sRef.current = null;
            setVoiceCall(false);
            setVoiceStatus(null);
          },
        },
      });
      s2sRef.current = handle;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start voice session";
      setError(message);
      setVoiceCall(false);
      setVoiceStatus(null);
    }
  };

  const ask = async () => {
    const question = input.trim();
    if (!question || streaming || voiceCall) return;

    if (dictating) {
      stopDictationRef.current?.();
      stopDictationRef.current = null;
      stopDictation();
      setDictating(false);
    }
    stopSpeaking();
    setListeningIndex(null);

    const history: TeacherChatMessage[] = [
      ...messages,
      { role: "user", content: question },
    ];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let answer = "";

    try {
      await streamTeacherChat({
        lessonId,
        model: model || undefined,
        messages: history,
        memory,
        signal: controller.signal,
        onToken: (text) => {
          answer += text;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = { role: "assistant", content: answer };
            }
            return next;
          });
        },
      });
      const nextMemory = rememberExchange(lessonId, question, answer);
      setMemory(nextMemory);
      const assistantIndex = history.length;
      if (autoListen && canListen && answer.trim()) {
        setListeningIndex(assistantIndex);
        readAloud(answer, {
          onEnd: () =>
            setListeningIndex((cur) =>
              cur === assistantIndex ? null : cur,
            ),
        });
      } else if (voice && answer.trim()) {
        speakJapanese(teacherSpeakText(answer));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Teacher failed";
      setError(message);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && !last.content) next.pop();
        return next;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <aside className={"ip-teacher" + (open ? " open" : "")} aria-label="Ask teacher">
      {!open && (
        <button
          type="button"
          className="ip-teacher-toggle"
          onClick={() => setOpen(true)}
          aria-expanded={false}
        >
          Ask teacher
        </button>
      )}

      {open && (
        <div className="ip-teacher-panel">
          <div className="ip-teacher-head">
            <div>
              <div className="ip-section-label">Lesson teacher</div>
              <div className="ip-teacher-subtitle">{lessonTitle}</div>
            </div>
            <div className="ip-teacher-head-actions">
              {canListen && !voiceCall && (
                <label className="ip-teacher-auto-listen">
                  <input
                    type="checkbox"
                    checked={autoListen}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setAutoListen(next);
                      saveAutoListen(next);
                    }}
                  />
                  Auto-listen
                </label>
              )}
              <button type="button" className="tool" onClick={startNewQuestion}>
                New question
              </button>
              <button
                type="button"
                className="tool"
                onClick={() => setOpen(false)}
                aria-expanded={true}
              >
                Hide
              </button>
            </div>
          </div>

          <div className="ip-teacher-voice-bar">
            <button
              type="button"
              className={"ip-teacher-voice-btn" + (voiceCall ? " live" : "")}
              disabled={streaming}
              onClick={() => void toggleVoiceCall()}
            >
              {voiceCall ? "End voice" : "Voice (HF S2S)"}
            </button>
            <div className="ip-teacher-voice-hint">
              {s2sReady
                ? voiceStatus ??
                  "Multilingual STT via Hugging Face speech-to-speech — EN↔JA switching works."
                : "Install & run npm run teacher:s2s, then set VITE_TEACHER_S2S_URL in .env.local"}
            </div>
          </div>

          <div className="ip-teacher-model">
            <label className="ip-teacher-model-label" htmlFor="teacher-model">
              Model
            </label>
            <input
              type="search"
              className="ip-teacher-model-filter"
              value={modelFilter}
              disabled={modelsLoading || models.length === 0 || voiceCall}
              placeholder="Filter models…"
              aria-label="Filter models"
              onChange={(e) => setModelFilter(e.target.value)}
            />
            <select
              id="teacher-model"
              className="ip-teacher-model-select"
              value={model}
              disabled={
                streaming ||
                voiceCall ||
                modelsLoading ||
                selectOptions.length === 0
              }
              onChange={(e) => {
                const next = e.target.value;
                setModel(next);
                saveTeacherModel(next);
                void setTeacherVoiceModel(next).catch(() => {
                  /* proxy may be offline until API restart */
                });
              }}
            >
              {modelsLoading && <option value="">Loading models…</option>}
              {!modelsLoading && selectOptions.length === 0 && (
                <option value="">No models match</option>
              )}
              {selectOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name === m.id ? m.id : `${m.name} (${m.id})`}
                </option>
              ))}
            </select>
            {modelsError && (
              <div className="ip-error">{modelsError}</div>
            )}
            {!modelsLoading && !modelsError && models.length > 0 && (
              <div className="ip-teacher-model-meta">
                {filteredModels.length === models.length
                  ? `${models.length} models`
                  : `${filteredModels.length} of ${models.length} models`}
                {" · "}
                Used for text chat and voice.
              </div>
            )}
          </div>

          {memory.coveredTopics.length > 0 && (
            <div className="ip-teacher-topics">
              {memory.coveredTopics.slice(0, 8).map((topic) => (
                <span key={topic} className="chip chip-amber">
                  {topic}
                </span>
              ))}
            </div>
          )}

          <div className="ip-teacher-thread" aria-live="polite">
            {messages.length === 0 && (
              <p className="ip-teacher-empty">
                Use <strong>Voice (HF S2S)</strong> for spoken EN↔JA practice, or
                type below. Browser mic dictation is English-only and disabled
                when S2S is configured.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={"ip-teacher-bubble " + m.role}
              >
                <div className="ip-teacher-bubble-label">
                  {m.role === "user" ? "You" : "Teacher"}
                </div>
                <div className="ip-teacher-bubble-body">
                  {m.content || (streaming && m.role === "assistant" ? "…" : "")}
                </div>
                {m.role === "assistant" &&
                  m.content &&
                  !streaming &&
                  !voiceCall && (
                    <div className="ip-teacher-bubble-actions">
                      {canListen && (
                        <button
                          type="button"
                          className={
                            "tool" + (listeningIndex === i ? " active" : "")
                          }
                          onClick={() => toggleListen(i, m.content)}
                        >
                          {listeningIndex === i ? "Stop" : "Listen"}
                        </button>
                      )}
                      {voice && (
                        <button
                          type="button"
                          className="tool"
                          onClick={() =>
                            speakJapanese(teacherSpeakText(m.content))
                          }
                        >
                          Speak JP
                        </button>
                      )}
                    </div>
                  )}
              </div>
            ))}
          </div>

          {error && <div className="ip-error">{error}</div>}

          <form
            className="ip-teacher-compose"
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <textarea
              className="ip-teacher-input"
              rows={3}
              value={input}
              disabled={streaming || voiceCall}
              placeholder={
                voiceCall
                  ? "Voice mode active — speak into your mic"
                  : dictating
                    ? "Listening… speak your question"
                    : "e.g. What’s the difference between は and が in this lesson?"
              }
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask();
                }
              }}
            />
            <div className="ip-teacher-compose-actions">
              {canDictate && (
                <button
                  type="button"
                  className={
                    "ip-teacher-mic" + (dictating ? " listening" : "")
                  }
                  disabled={streaming || voiceCall}
                  aria-pressed={dictating}
                  title={dictating ? "Stop listening" : "Dictate question (browser, EN)"}
                  onClick={toggleDictation}
                >
                  {dictating ? "Listening…" : "Mic"}
                </button>
              )}
              <button
                type="submit"
                className="btn-primary"
                disabled={streaming || voiceCall || !input.trim()}
              >
                {streaming ? "Thinking…" : "Ask"}
              </button>
            </div>
          </form>
        </div>
      )}
    </aside>
  );
}
