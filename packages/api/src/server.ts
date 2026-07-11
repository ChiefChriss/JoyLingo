import Fastify, {
  type FastifyInstance,
  type FastifyReply,
} from "fastify";
import cors from "@fastify/cors";
import { createHash } from "node:crypto";
import {
  createJob,
  getEpisodeByAnime,
  getEpisodeByYoutubeId,
  getEpisodeJson,
  getEpisodeSource,
  getJimakuMapping,
  getJob,
  getUserProfile,
  listEpisodes,
  upsertUserProfile,
  updateJob,
  updateSubtitleOffset,
  type DB,
} from "./db.js";
import {
  listKanjiCards,
  listKanjiProgress,
  listVocabulary,
  setVocabularyMined,
  syncVocabularyEntries,
  upsertEncounter,
  upsertKanjiCard,
  upsertKanjiProgress,
} from "./vocabulary.js";
import { extractKanji } from "@joylingo/shared";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { KanjiReference } from "@joylingo/shared";
import { gradeKanjiCard, gradeFusionCard } from "@joylingo/player-core";
import {
  getCurriculumWords,
  matchCurriculumClips,
  matchWordsToClips,
} from "./curriculum-match.js";
import {
  candidateToSaveInput,
  getFusionCard,
  listDueFusionCards,
  listFusionCards,
  saveFusionClips,
  updateFusionCard,
  type SaveClipInput,
} from "./curriculum-clips.js";
import {
  normalizeProfile,
  type CurriculumWord,
  type EduLessonId,
  type VocabularyEntry,
} from "@joylingo/shared";
import { enrichToEpisode, type EnrichRequest } from "./enrich-service.js";
import { JimakuError, downloadFile, listSubtitleFiles, searchEntries } from "./jimaku.js";
import { fetchYoutubeMetadata, isValidVideoId } from "./youtube.js";
import {
  YoutubeCaptionsError,
  downloadCaptions,
  listCaptionTracks,
} from "./youtube-captions.js";
import { searchAnime } from "./jikan.js";
import { streamBootstrap, streamSources } from "./stream.js";
import { handleVideoProxy } from "./proxy.js";
import type { TranslationMode } from "./allanime/types.js";
import { streamTeacherReply } from "./teacher/chat.js";
import { buildTeacherVoicePrompt } from "./teacher/context.js";
import {
  defaultModelId,
  isValidModelId,
  listOpenRouterModels,
  openRouterConfigured,
  teacherEnabled,
} from "./teacher/openrouter.js";
import { allowTeacherRequest } from "./teacher/rate-limit.js";
import type {
  TeacherChatMessage,
  TeacherMemory,
} from "./teacher/types.js";
import {
  getVoiceLlmModel,
  setVoiceLlmModel,
} from "./teacher/voice-model.js";

export interface BuildOptions {
  db: DB;
  logger?: boolean;
}

interface ImportBody {
  /** "youtube" → fetch captions via yt-dlp; "jimaku" (default) → download from Jimaku URLs. */
  source?: "youtube" | "jimaku";
  youtubeVideoId?: string;
  title?: string;
  titleEn?: string;
  // youtube source
  jaLang?: string;
  jaAuto?: boolean;
  enLang?: string;
  enAuto?: boolean;
  // jimaku source
  jimakuEntryId?: number;
  jaFileUrl?: string;
  jaFileName?: string;
  enFileUrl?: string;
  enFileName?: string;
  // anime stream binding (optional — pairs Jimaku subs with streamed episode)
  malId?: number;
  showId?: string;
  animeEpisode?: string;
  streamMode?: "sub" | "dub";
}

interface EnrichBody {
  title?: string;
  titleEn?: string;
  youtubeVideoId?: string;
  ja: { filename: string; content: string };
  en?: { filename: string; content: string };
}

export function buildServer({ db, logger = true }: BuildOptions): FastifyInstance {
  const app = Fastify({ logger });
  app.register(cors, { origin: true });

  app.get("/api/health", async () => ({ ok: true }));

  // --- catalog ---------------------------------------------------------

  app.get<{ Querystring: { featured?: string; malId?: string } }>("/api/episodes", async (req, reply) => {
    const featuredOnly = req.query.featured === "true";
    const malIdRaw = req.query.malId?.trim();
    const malId = malIdRaw ? Number(malIdRaw) : undefined;
    if (malId !== undefined && !Number.isInteger(malId)) {
      return { episodes: [] };
    }
    const body = { episodes: await listEpisodes(db, { featuredOnly, malId }) };
    return sendCachedJson(
      req.headers["if-none-match"],
      reply,
      body,
      "public, max-age=60, stale-while-revalidate=300",
    );
  });

  // --- device profile (best-effort mirror) ----------------------------------

  app.get("/api/profile", async (req, reply) => {
    const userId = deviceId(req);
    const row = await getUserProfile(db, userId);
    if (!row) return reply.code(404).send({ error: "profile not found" });
    return { profile: row.profile };
  });

  app.patch<{ Body: unknown }>("/api/profile", async (req, reply) => {
    const userId = deviceId(req);
    if (!req.body || typeof req.body !== "object") {
      return reply.code(400).send({ error: "profile object required" });
    }
    const row = await upsertUserProfile(db, userId, req.body);
    return { profile: row.profile };
  });

  app.get<{ Params: { id: string } }>("/api/episodes/:id", async (req, reply) => {
    const episode = await getEpisodeJson(db, req.params.id);
    if (!episode) return reply.code(404).send({ error: "episode not found" });
    return sendCachedJson(
      req.headers["if-none-match"],
      reply,
      episode,
      "public, max-age=3600",
    );
  });

  app.get<{ Params: { id: string } }>("/api/episodes/:id/source", async (req, reply) => {
    const source = await getEpisodeSource(db, req.params.id);
    if (!source) return reply.code(404).send({ error: "episode not found" });
    return source;
  });

  app.get<{ Params: { videoId: string } }>(
    "/api/episodes/by-youtube/:videoId",
    async (req, reply) => {
      const source = await getEpisodeByYoutubeId(db, req.params.videoId);
      if (!source) return reply.code(404).send({ error: "no episode for this video" });
      return source;
    },
  );

  app.get<{ Querystring: { malId?: string; episode?: string; mode?: string } }>(
    "/api/episodes/by-anime",
    async (req, reply) => {
      const malId = Number(req.query.malId);
      const episode = req.query.episode?.trim();
      const mode = req.query.mode ?? "sub";
      if (!Number.isInteger(malId) || !episode) {
        return reply.code(400).send({ error: "malId and episode are required" });
      }
      const source = await getEpisodeByAnime(db, malId, episode, mode);
      if (!source) return reply.code(404).send({ error: "no episode for this anime" });
      return source;
    },
  );

  app.patch<{ Params: { id: string }; Body: { subtitleOffset?: number } }>(
    "/api/episodes/:id",
    async (req, reply) => {
      const offset = req.body?.subtitleOffset;
      if (typeof offset !== "number" || !Number.isFinite(offset)) {
        return reply.code(400).send({ error: "subtitleOffset (number) is required" });
      }
      const updated = await updateSubtitleOffset(db, req.params.id, offset);
      if (!updated) return reply.code(404).send({ error: "episode not found" });
      return updated;
    },
  );

  // --- youtube metadata --------------------------------------------------

  app.get<{ Querystring: { videoId?: string } }>("/api/youtube/metadata", async (req, reply) => {
    const videoId = req.query.videoId ?? "";
    if (!isValidVideoId(videoId)) {
      return reply.code(400).send({ error: "videoId (11 chars) is required" });
    }
    const meta = await fetchYoutubeMetadata(videoId);
    if (!meta) return reply.code(404).send({ error: "video not found or not embeddable" });
    return meta;
  });

  app.get<{ Querystring: { videoId?: string } }>("/api/youtube/captions", async (req, reply) => {
    const videoId = req.query.videoId ?? "";
    if (!isValidVideoId(videoId)) {
      return reply.code(400).send({ error: "videoId (11 chars) is required" });
    }
    try {
      return await listCaptionTracks(videoId);
    } catch (err) {
      if (err instanceof YoutubeCaptionsError) {
        return reply.code(err.statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  // --- jimaku proxy --------------------------------------------------------

  app.get<{ Querystring: { q?: string } }>("/api/jimaku/search", async (req, reply) => {
    const q = req.query.q?.trim();
    if (!q) return reply.code(400).send({ error: "q is required" });
    try {
      return { entries: await searchEntries(q) };
    } catch (err) {
      return sendJimakuError(reply, err);
    }
  });

  app.get<{ Params: { entryId: string }; Querystring: { episode?: string } }>(
    "/api/jimaku/entries/:entryId/files",
    async (req, reply) => {
      const entryId = Number(req.params.entryId);
      if (!Number.isInteger(entryId)) return reply.code(400).send({ error: "bad entry id" });
      const episode = req.query.episode ? Number(req.query.episode) : undefined;
      try {
        return { files: await listSubtitleFiles(entryId, episode) };
      } catch (err) {
        return sendJimakuError(reply, err);
      }
    },
  );

  app.get<{ Params: { videoId: string } }>(
    "/api/jimaku/mapping/by-youtube/:videoId",
    async (req, reply) => {
      const mapping = await getJimakuMapping(db, req.params.videoId);
      if (!mapping) {
        return reply.code(404).send({ error: "mapping not found" });
      }
      return mapping;
    },
  );

  // --- anime search + stream (I<3Ani integration) -------------------------

  app.get<{ Querystring: { q?: string } }>("/api/anime/search", async (req, reply) => {
    const q = req.query.q?.trim();
    if (!q) return reply.code(400).send({ error: "q is required" });
    try {
      return { results: await searchAnime(q) };
    } catch (err) {
      app.log.error(err, "anime search failed");
      const message = err instanceof Error ? err.message : "Anime search failed";
      return reply.code(502).send({ error: message });
    }
  });

  app.get<{
    Querystring: {
      malId?: string;
      mode?: string;
      action?: string;
      showId?: string;
      episode?: string;
      titles?: string;
    };
  }>("/api/stream", async (req, reply) => {
    const mode = (req.query.mode ?? "sub") as TranslationMode;
    const action = req.query.action ?? "bootstrap";
    const showId = req.query.showId;
    const episode = req.query.episode;
    const fallbackTitles =
      req.query.titles?.split("|").map((t) => t.trim()).filter(Boolean) ?? [];

    if (mode !== "sub" && mode !== "dub") return reply.code(400).send({ error: "Invalid mode" });

    try {
      if (action === "sources") {
        if (!showId || !episode) {
          return reply.code(400).send({ error: "Missing showId or episode" });
        }
        const parsedMalId = Number.parseInt(req.query.malId ?? "", 10);
        return {
          sources: await streamSources(
            showId,
            episode,
            mode,
            Number.isNaN(parsedMalId) ? undefined : parsedMalId,
          ),
        };
      }

      const malId = parseInt(req.query.malId ?? "", 10);
      if (Number.isNaN(malId)) return reply.code(400).send({ error: "Invalid malId" });

      if (action === "bootstrap") {
        return await streamBootstrap({ malId, mode, showId, episode, fallbackTitles });
      }

      return reply.code(400).send({ error: "Unknown action" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      return reply.code(502).send({ error: message });
    }
  });

  app.get<{ Querystring: { url?: string; referer?: string } }>(
    "/api/proxy",
    handleVideoProxy,
  );

  // --- import (jimaku pick → async enrich) ---------------------------------

  app.post<{ Body: ImportBody }>("/api/episodes/import", async (req, reply) => {
    const b = req.body ?? ({} as ImportBody);
    const source: "youtube" | "jimaku" =
      b.source ?? (b.jaLang && !b.jaFileUrl ? "youtube" : "jimaku");

    if (source === "youtube") {
      if (!b.youtubeVideoId || !isValidVideoId(b.youtubeVideoId)) {
        return reply.code(400).send({ error: "youtubeVideoId (11 chars) is required" });
      }
      if (!b.jaLang) return reply.code(400).send({ error: "jaLang is required" });
    } else {
      if (!b.jaFileUrl || !b.jaFileName) {
        return reply.code(400).send({ error: "jaFileUrl and jaFileName are required" });
      }
      if (b.youtubeVideoId && !isValidVideoId(b.youtubeVideoId)) {
        return reply.code(400).send({ error: "bad youtubeVideoId" });
      }
    }

    const job = await createJob(db, b.youtubeVideoId ?? null);

    // Inline job runner (MVP — the guide allows skipping a real queue).
    void (async () => {
      try {
        await updateJob(db, job.id, { status: "running" });
        const enrichReq =
          source === "youtube" ? await buildYoutubeRequest(b) : await buildJimakuRequest(b);
        const row = await enrichToEpisode(db, enrichReq);
        await updateJob(db, job.id, { status: "done", episodeId: row.episodeId });
      } catch (err) {
        app.log.error(err, "enrich job failed");
        await updateJob(db, job.id, {
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return reply.code(202).send({ jobId: job.id });
  });

  app.get<{ Params: { jobId: string } }>("/api/episodes/import/:jobId", async (req, reply) => {
    const job = await getJob(db, req.params.jobId);
    if (!job) return reply.code(404).send({ error: "job not found" });
    return job;
  });

  // --- raw upload fallback (v1 / power users) ------------------------------

  app.post<{ Body: EnrichBody }>("/api/episodes/enrich", async (req, reply) => {
    const b = req.body;
    if (!b?.ja?.filename || !b.ja.content) {
      return reply.code(400).send({ error: "ja { filename, content } is required" });
    }
    if (b.youtubeVideoId && !isValidVideoId(b.youtubeVideoId)) {
      return reply.code(400).send({ error: "bad youtubeVideoId" });
    }
    const row = await enrichToEpisode(db, {
      ja: b.ja,
      en: b.en?.filename && b.en.content ? b.en : undefined,
      title: b.title,
      titleEn: b.titleEn,
      youtubeVideoId: b.youtubeVideoId ?? null,
    });
    return reply.code(201).send(row);
  });

  // --- vocabulary + kanji (device-scoped until auth) ---------------------

  app.post<{ Body: EncounterBody }>("/api/vocabulary/encounter", async (req, reply) => {
    const userId = deviceId(req);
    const b = req.body;
    if (!b?.dict || !b.episodeId || !b.lineId) {
      return reply.code(400).send({ error: "dict, episodeId, lineId required" });
    }
    const entry = await upsertEncounter(db, userId, {
      dict: b.dict,
      reading: b.reading ?? b.dict,
      gloss: b.gloss ?? null,
      surface: b.surface ?? b.dict,
      episodeId: b.episodeId,
      lineId: b.lineId,
      mined: b.mined,
    });
    const chars = [...new Set([...extractKanji(b.dict), ...extractKanji(b.surface ?? b.dict)])];
    await upsertKanjiProgress(db, userId, chars, b.dict, 1, new Date(entry.lastSeenAt));
    return entry;
  });

  app.get<{ Querystring: { mined?: string } }>("/api/vocabulary", async (req) => {
    const userId = deviceId(req);
    const mined =
      req.query.mined === "true" ? true : req.query.mined === "false" ? false : undefined;
    return { entries: await listVocabulary(db, userId, { mined }) };
  });

  app.post<{ Body: { dict: string } }>("/api/vocabulary/mine", async (req, reply) => {
    const userId = deviceId(req);
    if (!req.body?.dict) return reply.code(400).send({ error: "dict required" });
    await setVocabularyMined(db, userId, req.body.dict);
    return { ok: true };
  });

  app.post<{ Body: { entries?: VocabularyEntry[] } }>(
    "/api/vocabulary/sync",
    async (req, reply) => {
      const entries = req.body?.entries;
      if (!Array.isArray(entries)) {
        return reply.code(400).send({ error: "entries array required" });
      }
      await syncVocabularyEntries(db, deviceId(req), entries);
      return { ok: true };
    },
  );

  app.get("/api/kanji/progress", async (req) => {
    const userId = deviceId(req);
    return { progress: await listKanjiProgress(db, userId) };
  });

  app.get<{ Params: { char: string } }>("/api/kanji/reference/:char", async (req, reply) => {
    const ref = await loadKanjiReference();
    const entry = ref[decodeURIComponent(req.params.char)];
    if (!entry) return reply.code(404).send({ error: "kanji not found" });
    return entry;
  });

  app.get("/api/kanji/cards", async (req) => {
    const userId = deviceId(req);
    return { cards: await listKanjiCards(db, userId) };
  });

  app.post<{ Body: { char: string; good: boolean } }>("/api/kanji/cards/review", async (req, reply) => {
    const userId = deviceId(req);
    const { char, good } = req.body ?? {};
    if (!char) return reply.code(400).send({ error: "char required" });
    const cards = await listKanjiCards(db, userId);
    const existing = cards.find((c) => c.char === char);
    if (!existing) return reply.code(404).send({ error: "card not found" });
    const updated = gradeKanjiCard(existing, good);
    await upsertKanjiCard(db, userId, updated);
    return updated;
  });

  // --- AI curriculum teacher (local-dev gated) -----------------------------

  app.get("/api/teacher/models", async (_req, reply) => {
    if (!teacherEnabled()) {
      return reply.code(503).send({
        error:
          "Teacher is disabled. Set TEACHER_ENABLED=true in the API env for local use.",
      });
    }
    if (!openRouterConfigured()) {
      return reply
        .code(503)
        .send({ error: "OPENROUTER_API_KEY is not configured" });
    }
    try {
      return await listOpenRouterModels();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to list models";
      return reply.code(502).send({ error: message });
    }
  });

  /** Lesson instructions for a local Hugging Face speech-to-speech session. */
  app.post<{
    Body: {
      lessonId?: string;
      memory?: TeacherMemory;
      /** Same OpenRouter model id as the text teacher selector. */
      model?: string;
    };
  }>("/api/teacher/voice-session", async (req, reply) => {
    if (!teacherEnabled()) {
      return reply.code(503).send({
        error:
          "Teacher is disabled. Set TEACHER_ENABLED=true in the API env for local use.",
      });
    }

    const lessonId = req.body?.lessonId as EduLessonId | undefined;
    const memory = req.body?.memory;
    const model = req.body?.model?.trim();
    if (!lessonId) return reply.code(400).send({ error: "lessonId required" });
    if (!memory || memory.lessonId !== lessonId) {
      return reply.code(400).send({ error: "memory for this lessonId required" });
    }
    if (model) {
      try {
        setVoiceLlmModel(model);
      } catch {
        return reply.code(400).send({ error: "Invalid model id" });
      }
    }

    try {
      const instructions = await buildTeacherVoicePrompt(lessonId, memory);
      return {
        lessonId,
        instructions,
        model: getVoiceLlmModel(),
        /** Client connects directly to the local HF realtime server. */
        protocol: "openai-realtime",
        sampleRateHz: 16_000,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to build voice session";
      return reply.code(400).send({ error: message });
    }
  });

  /** Remember the UI-selected model for the local S2S → OpenRouter proxy. */
  app.post<{ Body: { model?: string } }>(
    "/api/teacher/voice-model",
    async (req, reply) => {
      if (!teacherEnabled()) {
        return reply.code(503).send({
          error:
            "Teacher is disabled. Set TEACHER_ENABLED=true in the API env for local use.",
        });
      }
      const model = req.body?.model?.trim();
      if (!model) return reply.code(400).send({ error: "model required" });
      try {
        return { model: setVoiceLlmModel(model) };
      } catch {
        return reply.code(400).send({ error: "Invalid model id" });
      }
    },
  );

  app.get("/api/teacher/voice-model", async (_req, reply) => {
    if (!teacherEnabled()) {
      return reply.code(503).send({
        error:
          "Teacher is disabled. Set TEACHER_ENABLED=true in the API env for local use.",
      });
    }
    return { model: getVoiceLlmModel() };
  });

  /**
   * OpenAI Responses-compatible proxy for HF speech-to-speech.
   * S2S points here; we forward to OpenRouter using the UI-selected model.
   */
  app.post("/api/teacher/llm/v1/responses", async (req, reply) => {
    if (!teacherEnabled()) {
      return reply.code(503).send({
        error:
          "Teacher is disabled. Set TEACHER_ENABLED=true in the API env for local use.",
      });
    }
    if (!openRouterConfigured()) {
      return reply
        .code(503)
        .send({ error: "OPENROUTER_API_KEY is not configured" });
    }

    const key = process.env.OPENROUTER_API_KEY?.trim();
    if (!key) {
      return reply.code(503).send({ error: "OPENROUTER_API_KEY is not configured" });
    }

    const incoming =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : {};
    const model = getVoiceLlmModel();
    const payload = { ...incoming, model };

    const upstream = await fetch("https://openrouter.ai/api/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://joylingo.local",
        "X-Title": "JoyLingo Teacher Voice",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "OpenRouter proxy failed";
      return { error: message } as const;
    });

    if ("error" in upstream) {
      return reply.code(502).send({ error: upstream.error });
    }

    const contentType =
      upstream.headers.get("content-type") ?? "application/json";

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return reply.code(upstream.status).type(contentType).send(text);
    }

    // Streaming SSE / event-stream from OpenRouter Responses API
    if (
      contentType.includes("text/event-stream") ||
      incoming.stream === true
    ) {
      reply.hijack();
      reply.raw.writeHead(upstream.status, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      if (!upstream.body) {
        reply.raw.end();
        return;
      }
      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(value);
        }
      } catch {
        // client or upstream closed
      } finally {
        reply.raw.end();
      }
      return;
    }

    const text = await upstream.text();
    return reply.code(upstream.status).type(contentType).send(text);
  });

  app.post<{
    Body: {
      lessonId?: string;
      threadId?: string;
      model?: string;
      messages?: TeacherChatMessage[];
      memory?: TeacherMemory;
    };
  }>("/api/teacher/chat", async (req, reply) => {
    if (!teacherEnabled()) {
      return reply.code(503).send({
        error:
          "Teacher is disabled. Set TEACHER_ENABLED=true in the API env for local use.",
      });
    }
    if (!openRouterConfigured()) {
      return reply
        .code(503)
        .send({ error: "OPENROUTER_API_KEY is not configured" });
    }

    const userId = deviceId(req);
    if (!allowTeacherRequest(userId)) {
      return reply.code(429).send({ error: "Too many teacher requests — try again shortly" });
    }

    const lessonId = req.body?.lessonId as EduLessonId | undefined;
    const messages = req.body?.messages;
    const memory = req.body?.memory;
    const model = req.body?.model?.trim() || undefined;
    if (!lessonId) return reply.code(400).send({ error: "lessonId required" });
    if (!Array.isArray(messages) || messages.length === 0) {
      return reply.code(400).send({ error: "messages required" });
    }
    if (!memory || memory.lessonId !== lessonId) {
      return reply.code(400).send({ error: "memory for this lessonId required" });
    }
    if (model && !isValidModelId(model)) {
      return reply.code(400).send({ error: "Invalid model id" });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const writeEvent = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      for await (const token of streamTeacherReply({
        lessonId,
        messages,
        memory,
        model: model || defaultModelId(),
      })) {
        writeEvent("token", { text: token });
      }
      writeEvent("done", { ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Teacher request failed";
      writeEvent("error", { error: message });
    } finally {
      reply.raw.end();
    }
  });

  // --- curriculum × immersion fusion ---------------------------------------

  app.get<{ Querystring: { lessonId?: string } }>("/api/curriculum/words", async (req, reply) => {
    const lessonId = req.query.lessonId as EduLessonId | undefined;
    if (!lessonId) return reply.code(400).send({ error: "lessonId required" });
    const words = await getCurriculumWords(lessonId);
    return { words };
  });

  app.post<{ Body: { lessonId?: EduLessonId } }>("/api/curriculum/match", async (req, reply) => {
    const userId = deviceId(req);
    const lessonId = req.body?.lessonId;
    if (!lessonId) return reply.code(400).send({ error: "lessonId required" });
    const profileRow = await getUserProfile(db, userId);
    const profile = normalizeProfile(profileRow?.profile);
    const malIds = profile.favoriteAnime.map((a) => a.malId);
    const candidates = await matchCurriculumClips(db, lessonId, malIds);
    const words = await getCurriculumWords(lessonId);
    const wordById = Object.fromEntries(words.map((w) => [w.id, w]));
    return { candidates, words: wordById };
  });

  app.post<{ Body: { words?: CurriculumWord[] } }>(
    "/api/curriculum/match-words",
    async (req, reply) => {
      const words = req.body?.words;
      if (!Array.isArray(words)) {
        return reply.code(400).send({ error: "words array required" });
      }
      const profileRow = await getUserProfile(db, deviceId(req));
      const profile = normalizeProfile(profileRow?.profile);
      const malIds = profile.favoriteAnime.map((anime) => anime.malId);
      const candidates = await matchWordsToClips(db, words, malIds);
      return {
        candidates,
        words: Object.fromEntries(words.map((word) => [word.id, word])),
      };
    },
  );

  app.get("/api/curriculum/clips", async (req) => {
    const userId = deviceId(req);
    return { cards: await listFusionCards(db, userId) };
  });

  app.get("/api/curriculum/clips/due", async (req) => {
    const userId = deviceId(req);
    return { cards: await listDueFusionCards(db, userId) };
  });

  app.post<{ Body: { candidates?: string[] } }>("/api/curriculum/clips", async (req, reply) => {
    const userId = deviceId(req);
    const ids = req.body?.candidates;
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: "candidates array required" });
    }
    const lessonId = (req.body as { lessonId?: EduLessonId }).lessonId;
    if (!lessonId) return reply.code(400).send({ error: "lessonId required" });
    const profileRow = await getUserProfile(db, userId);
    const profile = normalizeProfile(profileRow?.profile);
    const malIds = profile.favoriteAnime.map((a) => a.malId);
    const allCandidates = await matchCurriculumClips(db, lessonId, malIds);
    const selected = allCandidates.filter((c) =>
      ids.includes(`${c.curriculumWordId}:${c.episodeId}:${c.lineId}`),
    );
    const words = await getCurriculumWords(lessonId);
    const wordById = Object.fromEntries(words.map((w) => [w.id, w]));
    const inputs = selected.map((c) => {
      const word = wordById[c.curriculumWordId];
      return candidateToSaveInput(c, word?.gloss ?? c.gloss ?? "", word?.reading ?? c.surface);
    });
    const saved = await saveFusionClips(db, userId, inputs);
    return { cards: saved };
  });

  app.post<{ Body: { clips?: SaveClipInput[] } }>(
    "/api/curriculum/clips/direct",
    async (req, reply) => {
      const clips = req.body?.clips;
      if (!Array.isArray(clips) || clips.length === 0) {
        return reply.code(400).send({ error: "clips array required" });
      }
      return {
        cards: await saveFusionClips(db, deviceId(req), clips),
      };
    },
  );

  app.post<{ Params: { id: string }; Body: { good?: boolean } }>(
    "/api/curriculum/clips/:id/review",
    async (req, reply) => {
      const userId = deviceId(req);
      const card = await getFusionCard(db, userId, req.params.id);
      if (!card) return reply.code(404).send({ error: "card not found" });
      const updated = gradeFusionCard(card, Boolean(req.body?.good));
      await updateFusionCard(db, userId, updated);
      return updated;
    },
  );

  return app;
}

interface EncounterBody {
  dict: string;
  reading?: string;
  gloss?: string | null;
  surface?: string;
  episodeId: string;
  lineId: string;
  mined?: boolean;
}

let kanjiRefCache: Record<string, KanjiReference> | null = null;

async function loadKanjiReference(): Promise<Record<string, KanjiReference>> {
  if (kanjiRefCache) return kanjiRefCache;
  const refPath = fileURLToPath(
    new URL("../../web/public/kanji/reference.json", import.meta.url),
  );
  try {
    const raw = await readFile(refPath, "utf8");
    const list = JSON.parse(raw) as KanjiReference[];
    kanjiRefCache = Object.fromEntries(list.map((k) => [k.char, k]));
  } catch {
    kanjiRefCache = {};
  }
  return kanjiRefCache;
}

function deviceId(req: { headers: Record<string, string | string[] | undefined> }): string {
  const h = req.headers["x-joylingo-device-id"];
  const id = Array.isArray(h) ? h[0] : h;
  return id?.trim() || "anonymous";
}

function sendJimakuError(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, err: unknown) {
  if (err instanceof JimakuError) return reply.code(err.statusCode).send({ error: err.message });
  throw err;
}

function sendCachedJson(
  ifNoneMatch: string | string[] | undefined,
  reply: FastifyReply,
  body: unknown,
  cacheControl: string,
) {
  const etag = `"${createHash("sha1")
    .update(JSON.stringify(body))
    .digest("base64url")}"`;
  reply.header("ETag", etag);
  reply.header("Cache-Control", cacheControl);
  const requestEtag = Array.isArray(ifNoneMatch)
    ? ifNoneMatch[0]
    : ifNoneMatch;
  if (requestEtag === etag) return reply.code(304).send();
  return reply.send(body);
}

async function buildJimakuRequest(b: ImportBody): Promise<EnrichRequest> {
  const animeStream =
    b.malId != null && b.showId && b.animeEpisode && b.streamMode
      ? {
          malId: b.malId,
          showId: b.showId,
          episode: b.animeEpisode,
          mode: b.streamMode,
        }
      : null;

  return {
    ja: { filename: b.jaFileName!, content: await downloadFile(b.jaFileUrl!, b.jaFileName) },
    en:
      b.enFileUrl && b.enFileName
        ? { filename: b.enFileName, content: await downloadFile(b.enFileUrl, b.enFileName) }
        : undefined,
    title: b.title,
    titleEn: b.titleEn,
    youtubeVideoId: b.youtubeVideoId ?? null,
    jimakuEntryId: b.jimakuEntryId ?? null,
    animeStream,
  };
}

async function buildYoutubeRequest(b: ImportBody): Promise<EnrichRequest> {
  const captions = await downloadCaptions(
    b.youtubeVideoId!,
    { lang: b.jaLang!, name: b.jaLang!, auto: b.jaAuto ?? false },
    b.enLang ? { lang: b.enLang, name: b.enLang, auto: b.enAuto ?? false } : null,
  );
  // No title from the client → fall back to the video title so the episode
  // id doesn't degrade to a filename slug.
  const title = b.title ?? (await fetchYoutubeMetadata(b.youtubeVideoId!))?.title;
  return {
    ja: captions.ja,
    en: captions.en,
    title,
    titleEn: b.titleEn,
    youtubeVideoId: b.youtubeVideoId!,
    jimakuEntryId: null,
  };
}
