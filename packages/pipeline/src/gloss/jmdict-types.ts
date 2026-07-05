/**
 * Minimal subset of the jmdict-simplified JSON schema (scriptin/jmdict-simplified,
 * format 3.x). We only type the fields the gloss provider reads.
 * @see https://github.com/scriptin/jmdict-simplified
 */
export interface JmdictFile {
  version: string;
  dictDate: string;
  words: JmdictWord[];
}

export interface JmdictWord {
  id: string;
  kanji: JmdictKanji[];
  kana: JmdictKana[];
  sense: JmdictSense[];
}

export interface JmdictKanji {
  text: string;
  common: boolean;
  tags: string[];
}

export interface JmdictKana {
  text: string;
  common: boolean;
  tags: string[];
  appliesToKanji: string[];
}

export interface JmdictSense {
  partOfSpeech: string[];
  gloss: JmdictGloss[];
}

export interface JmdictGloss {
  lang: string;
  text: string;
}
