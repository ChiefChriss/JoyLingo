import { defaultModelId, isValidModelId } from "./openrouter.js";

/** In-memory model for the local HF speech-to-speech LLM proxy. */
let voiceLlmModel = defaultModelId();

export function getVoiceLlmModel(): string {
  return voiceLlmModel;
}

export function setVoiceLlmModel(model: string): string {
  const next = model.trim();
  if (!isValidModelId(next)) {
    throw new Error("Invalid model id");
  }
  voiceLlmModel = next;
  return voiceLlmModel;
}
