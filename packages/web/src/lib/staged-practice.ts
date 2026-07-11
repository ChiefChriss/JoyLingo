/**
 * Build school-grade 4-stage practice sets from base seed/generated items.
 */
import type {
  EduSectionId,
  PracticeItem,
  PracticeSet,
  PracticeStage,
} from "@joylingo/shared";
import { SCHOOL_PASS_SCORE } from "@joylingo/shared";

const JA_RE = /[\u3040-\u30ff\u4e00-\u9fff]/;

function extractJa(text: string): string | null {
  const m = text.match(
    /[\u3040-\u30ff\u4e00-\u9fff][\u3040-\u30ff\u4e00-\u9fff\sー・。、]*[\u3040-\u30ff\u4e00-\u9fff。]?/,
  );
  return m ? m[0]!.trim() : null;
}

function withStage(item: PracticeItem, stage: PracticeStage): PracticeItem {
  return { ...item, stage };
}

/**
 * Split / synthesize listening, checkpoint, production, speaking from a flat bank.
 */
export function buildStagedPracticeSet(
  sectionId: EduSectionId,
  sectionTitle: string,
  baseItems: PracticeItem[],
  kind: PracticeSet["kind"] = "grammar",
): PracticeSet {
  const checkpoint: PracticeItem[] = [];
  const production: PracticeItem[] = [];

  for (const raw of baseItems) {
    const item = { ...raw };
    if (
      item.type === "choice" ||
      (item.type === "cloze" && (item.choices?.length ?? 0) > 0) ||
      item.type === "listen_choice"
    ) {
      checkpoint.push(withStage({ ...item, type: item.type === "listen_choice" ? "choice" : item.type }, "checkpoint"));
    } else if (
      item.type === "produce" ||
      item.type === "produce_ja" ||
      item.type === "conjugate" ||
      item.type === "reading" ||
      item.type === "translate_en" ||
      (item.type === "cloze" && !(item.choices?.length ?? 0))
    ) {
      production.push(
        withStage(
          {
            ...item,
            type: item.type === "reading" ? "reading" : "produce_ja",
          },
          "production",
        ),
      );
    } else {
      checkpoint.push(withStage(item, "checkpoint"));
    }
  }

  // Convert some checkpoint cloze → production free-type for balance
  if (production.length < 6) {
    for (const c of checkpoint) {
      if (production.length >= 6) break;
      if (c.type === "cloze" && c.answer) {
        production.push(
          withStage(
            {
              id: `${c.id}-prod`,
              type: "produce_ja",
              prompt: c.prompt.replace("___", "____") + " (type the missing part)",
              answer: c.answer,
              accept: c.accept,
              explain: c.explain,
              hint: c.hint,
            },
            "production",
          ),
        );
      }
    }
  }

  // Listening from Japanese-bearing items
  const listening: PracticeItem[] = [];
  const listenSources = [...baseItems, ...checkpoint, ...production];
  for (const src of listenSources) {
    if (listening.length >= 4) break;
    const ja =
      src.promptJa ||
      (JA_RE.test(src.answer) ? src.answer : null) ||
      extractJa(src.prompt);
    if (!ja || ja.length < 2) continue;
    if (src.choices && src.choices.length >= 2) {
      listening.push(
        withStage(
          {
            id: `${sectionId}-listen-${listening.length}`,
            type: "listen_choice",
            prompt: "Listen, then choose the best meaning / form.",
            promptJa: ja,
            answer: src.choices.includes(src.answer) ? src.answer : src.choices[0]!,
            choices: src.choices,
            explain: src.explain ?? `Heard: ${ja}`,
          },
          "listening",
        ),
      );
    } else {
      listening.push(
        withStage(
          {
            id: `${sectionId}-listen-${listening.length}`,
            type: "listen_cloze",
            prompt: "Listen, then type what you heard (Japanese).",
            promptJa: ja,
            answer: ja,
            accept: [ja.replace(/\s/g, "")],
            explain: `Target: ${ja}`,
          },
          "listening",
        ),
      );
    }
  }

  // Fallback listening lines if still thin
  const fallbacks = [
    "わたしはがくせいです。",
    "これはほんです。",
    "コーヒーをのみます。",
    "すこしにほんごがわかります。",
  ];
  let fi = 0;
  while (listening.length < 3) {
    const ja = fallbacks[fi % fallbacks.length]!;
    fi++;
    listening.push(
      withStage(
        {
          id: `${sectionId}-listen-fb-${listening.length}`,
          type: "listen_cloze",
          prompt: "Listen, then type the Japanese you hear.",
          promptJa: ja,
          answer: ja,
          accept: [ja.replace(/\s/g, "")],
        },
        "listening",
      ),
    );
  }

  // Pad production
  let pi = 0;
  while (production.length < 6 && checkpoint.length > 0) {
    const c = checkpoint[pi % checkpoint.length]!;
    pi++;
    production.push(
      withStage(
        {
          id: `${c.id}-pad-prod-${production.length}`,
          type: "produce_ja",
          prompt: c.choices
            ? `Type the correct answer: ${c.prompt}`
            : c.prompt,
          answer: c.answer,
          accept: c.accept,
          explain: c.explain,
        },
        "production",
      ),
    );
  }

  // Pad checkpoint
  let ci = 0;
  while (checkpoint.length < 6 && production.length > 0) {
    const p = production[ci % production.length]!;
    ci++;
    checkpoint.push(
      withStage(
        {
          id: `${p.id}-pad-ck-${checkpoint.length}`,
          type: "choice",
          prompt: p.prompt,
          answer: p.answer,
          choices: [p.answer, "わからない", "です", "ます"].slice(0, 4),
          explain: p.explain,
        },
        "checkpoint",
      ),
    );
  }

  const speaking: PracticeItem[] = [
    withStage(
      {
        id: `${sectionId}-speak`,
        type: "speak_prompt",
        prompt: `Speak for 20–40 seconds about this short lesson: 「${sectionTitle}」. Use Japanese. Include at least one pattern from the section.`,
        answer: "spoken",
        speakSeconds: 25,
        speakChecklist: [
          "I spoke mostly or only in Japanese",
          "I used grammar/vocab from this short lesson",
          "I listened to my recording and understood myself",
        ],
      },
      "speaking",
    ),
  ];

  const staged = {
    listening: listening.slice(0, 4),
    checkpoint: checkpoint.slice(0, 8),
    production: production.slice(0, 8),
    speaking,
  };

  const items = [
    ...staged.listening,
    ...staged.checkpoint,
    ...staged.production,
    ...staged.speaking,
  ];

  return {
    sectionId,
    kind,
    passScore: SCHOOL_PASS_SCORE,
    items,
    staged,
  };
}
