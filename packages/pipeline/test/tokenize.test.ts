import { describe, it, expect, beforeAll } from "vitest";
import type { IpadicFeatures, Tokenizer } from "kuromoji";
import { getTokenizer, tokenizeLine, readingFor } from "../src/tokenize/kuromoji.js";
import { isWord, type WordToken } from "@joylingo/shared";

describe("readingFor", () => {
  it("returns null for pure-kana surfaces", () => {
    expect(readingFor("こんにちは", "コンニチハ")).toBeNull();
    expect(readingFor("が", "ガ")).toBeNull();
  });
  it("converts katakana reading to hiragana for kanji surfaces", () => {
    expect(readingFor("電車", "デンシャ")).toBe("でんしゃ");
    expect(readingFor("来た", "キタ")).toBe("きた");
  });
  it("returns null when kuromoji has no reading", () => {
    expect(readingFor("漢字", undefined)).toBeNull();
    expect(readingFor("漢字", "*")).toBeNull();
  });
});

describe("tokenizeLine (kuromoji)", () => {
  let tokenizer: Tokenizer<IpadicFeatures>;
  beforeAll(async () => {
    tokenizer = await getTokenizer();
  }, 30_000);

  it("produces the client token contract for a simple sentence", () => {
    const tokens = tokenizeLine(tokenizer, "電車が来た。");
    const bySurface = (s: string) => tokens.find((t) => t.s === s);

    const densha = bySurface("電車") as WordToken;
    expect(densha).toMatchObject({ s: "電車", r: "でんしゃ", dict: "電車", pos: "noun" });

    const ga = bySurface("が") as WordToken;
    expect(ga).toMatchObject({ dict: "が", pos: "particle", r: null });

    // trailing 。 is a punctuation token
    const period = tokens[tokens.length - 1]!;
    expect(period).toEqual({ s: "。", punct: true });
  });

  it("merges IPADIC over-segmentation into whole words with their dict form", () => {
    // 来 + た  → 来た (来る);  急い + で → 急いで (急ぐ);  飲み + たい → 飲みたい (飲む)
    const kita = tokenizeLine(tokenizer, "来た").find((t) => t.s === "来た") as WordToken;
    expect(kita).toMatchObject({ s: "来た", dict: "来る", pos: "verb", r: "きた" });

    const isoide = tokenizeLine(tokenizer, "急いで").find((t) => t.s === "急いで") as WordToken;
    expect(isoide).toMatchObject({ dict: "急ぐ", r: "いそいで" });

    const nomitai = tokenizeLine(tokenizer, "飲みたい").find((t) => t.s === "飲みたい") as WordToken;
    expect(nomitai).toMatchObject({ dict: "飲む", r: "のみたい" });

    // ...but a sentence-ending particle stays its own token
    const tokens = tokenizeLine(tokenizer, "遅れるよ");
    expect(tokens.map((t) => t.s)).toEqual(["遅れる", "よ"]);
  });

  it("treats standalone punctuation as punct even when IPADIC mistags it", () => {
    const tokens = tokenizeLine(tokenizer, "本当!");
    expect(tokens.find((t) => t.s === "!")).toEqual({ s: "!", punct: true });
  });

  it("word tokens carry gloss:null until enrichment fills them", () => {
    const tokens = tokenizeLine(tokenizer, "時間");
    const word = tokens.find(isWord) as WordToken;
    expect(word.gloss).toBeNull();
  });
});
