import type { Pos } from "@joylingo/shared";
import type { IpadicFeatures } from "kuromoji";

/**
 * Map kuromoji's (IPADIC) Japanese part-of-speech onto our compact `Pos` set.
 *
 * IPADIC's `pos` is the coarse class (名詞, 動詞, 助詞 …) and `pos_detail_1..3`
 * refine it (e.g. 名詞-代名詞 = pronoun, 名詞-形容動詞語幹 = na-adjective stem).
 */
export function mapPos(f: IpadicFeatures): Pos {
  const { pos, pos_detail_1, pos_detail_2, basic_form } = f;

  switch (pos) {
    case "名詞": {
      if (pos_detail_1 === "代名詞") return "pronoun";
      if (pos_detail_1 === "形容動詞語幹") return "adj-na";
      if (pos_detail_1 === "接尾") {
        return pos_detail_2 === "助数詞" ? "counter" : "suffix";
      }
      return "noun";
    }
    case "動詞":
      return "verb";
    case "形容詞":
      return "adj-i";
    case "副詞":
      return "adv";
    case "助詞":
      return "particle";
    case "助動詞":
      // だ/です standing as the copula vs. bound auxiliaries (た, ない, れる…)
      return basic_form === "だ" || basic_form === "です" ? "copula" : "auxiliary";
    case "接続詞":
      return "conj";
    case "感動詞":
    case "フィラー":
      return "interj";
    case "接頭詞":
      return "prefix";
    case "連体詞":
      // Prenominal adjectivals (この, 大きな). No exact bucket; group with adj-na.
      return "adj-na";
    default:
      return "unknown";
  }
}

/** True when kuromoji classified the token as a symbol/punctuation (記号). */
export function isSymbol(f: IpadicFeatures): boolean {
  return f.pos === "記号";
}
