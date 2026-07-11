/**
 * Practice items for every EDU short lesson that is not auto-generated
 * (kana / vocab index). Keys are stable aliases matched via findPracticeSeed.
 */
import type { PracticeItem } from "@joylingo/shared";

function C(
  id: string,
  prompt: string,
  answer: string,
  choices: string[],
  explain?: string,
): PracticeItem {
  return { id, type: "choice", prompt, answer, choices, explain };
}

function Z(
  id: string,
  prompt: string,
  answer: string,
  choices: string[],
  explain?: string,
): PracticeItem {
  return { id, type: "cloze", prompt, answer, choices, explain };
}

function P(
  id: string,
  prompt: string,
  answer: string,
  accept?: string[],
  explain?: string,
): PracticeItem {
  return { id, type: "produce", prompt, answer, accept, explain };
}

/** Stable keys → item banks (min 5–7 items each). */
export const PRACTICE_SEEDS: Record<string, PracticeItem[]> = {
  // ─── Genki I grammar (02) L1–L12 ─────────────────────────────────────────
  "02-l1": [
    Z("02l1-1", "わたし___がくせいです。", "は", ["は", "が", "を", "に"], "は = topic"),
    Z("02l1-2", "あなたは がくせい___。", "ですか", ["ですか", "です", "でした", "じゃない"]),
    C("02l1-3", "Particle for “also / too”?", "も", ["も", "の", "は", "か"]),
    Z("02l1-4", "わたし___なまえ", "の", ["の", "は", "が", "を"], "possessive の"),
    P("02l1-5", 'Type: "I am a student." (polite)', "わたしはがくせいです", [
      "わたしは がくせいです",
      "私は学生です",
      "わたしは学生です",
    ]),
    C("02l1-6", "なに／なん means…", "what", ["what", "who", "where", "when"]),
    Z("02l1-7", "わたしは がくせい___です。(not a student)", "じゃない", [
      "じゃない",
      "でした",
      "ですか",
      "も",
    ]),
  ],
  "02-l2": [
    C("02l2-1", "これ is near…", "the speaker", ["the speaker", "the listener", "both far", "unknown"]),
    C("02l2-2", "それ is near…", "the listener", ["the listener", "the speaker", "both far", "unknown"]),
    Z("02l2-3", "___ほんは だれのですか。(that book near you)", "その", ["その", "この", "あの", "どの"]),
    Z("02l2-4", "がっこうは ___ですか。", "どこ", ["どこ", "ここ", "そこ", "あそこ"]),
    C("02l2-5", "Sentence-ending ね often means…", "seeking agreement", [
      "seeking agreement",
      "asserting new info",
      "past tense",
      "object marker",
    ]),
    C("02l2-6", "Sentence-ending よ often means…", "asserting new info", [
      "asserting new info",
      "soft apology",
      "past tense",
      "topic marker",
    ]),
    P("02l2-7", 'Type: "This is a book." (これ)', "これはほんです", [
      "これは ほんです",
      "これは本です",
    ]),
  ],
  "02-l3": [
    C("02l3-1", "たべる is which type?", "る-verb (一段)", [
      "る-verb (一段)",
      "う-verb (五段)",
      "Irregular",
      "Adjective",
    ]),
    C("02l3-2", "のむ is which type?", "う-verb (五段)", [
      "う-verb (五段)",
      "る-verb (一段)",
      "Irregular",
      "Noun",
    ]),
    Z("02l3-3", "たべる → polite present: たべ___", "ます", ["ます", "ました", "ません", "ましょう"]),
    Z("02l3-4", "コーヒー___のみます。", "を", ["を", "に", "で", "が"], "を = object"),
    Z("02l3-5", "としょかん___べんきょうします。", "で", ["で", "に", "を", "へ"], "で = place of action"),
    Z("02l3-6", "うち___かえります。", "に", ["に", "を", "で", "が"], "に = destination"),
    C("02l3-7", "Irregular verbs are…", "する and くる", [
      "する and くる",
      "たべる and みる",
      "いく and かえる",
      "のむ and はなす",
    ]),
  ],
  "02-l4": [
    C("02l4-1", "あります is used for…", "inanimate things", [
      "inanimate things",
      "people/animals only",
      "verbs only",
      "adjectives",
    ]),
    C("02l4-2", "います is used for…", "animate beings", [
      "animate beings",
      "books and chairs",
      "weather",
      "time only",
    ]),
    Z("02l4-3", "ほんは つくえの うえ___ あります。", "に", ["に", "で", "を", "が"]),
    Z("02l4-4", "へやに ねこ___ います。", "が", ["が", "を", "は", "で"]),
    C("02l4-5", "Past of です (affirmative)?", "でした", ["でした", "じゃないです", "です", "ます"]),
    C("02l4-6", "した means…", "under / below", ["under / below", "above", "inside", "next to"]),
    Z("02l4-7", "えんぴつ___けしゴム (pencil and eraser)", "と", ["と", "や", "の", "も"]),
  ],
  "02-l5": [
    C("02l5-1", "たかい is which adjective type?", "い-adjective", [
      "い-adjective",
      "な-adjective",
      "verb",
      "particle",
    ]),
    C("02l5-2", "しずか is which type?", "な-adjective", [
      "な-adjective",
      "い-adjective",
      "verb",
      "noun only",
    ]),
    Z("02l5-3", "たかい → negative: たか___です", "くない", ["くない", "じゃない", "なかった", "く"]),
    Z("02l5-4", "たかい → past: たか___です", "かった", ["かった", "でした", "くない", "いでした"]),
    Z("02l5-5", "コーヒー___ すきです。", "が", ["が", "を", "に", "で"], "すき takes が"),
    C("02l5-6", "いい (good) past affirmative is…", "よかったです", [
      "よかったです",
      "いかったです",
      "いいでした",
      "よくないです",
    ]),
    C("02l5-7", "～ましょう means…", "Let's ~", ["Let's ~", "I want to ~", "I must ~", "Don't ~"]),
  ],
  "02-l6": [
    C("02l6-1", "て-form of たべる?", "たべて", ["たべて", "たべって", "たべで", "たべます"]),
    C("02l6-2", "て-form of のむ?", "のんで", ["のんで", "のむて", "のみて", "のって"]),
    C("02l6-3", "て-form of いく?", "いって", ["いって", "いきて", "いいて", "いってる"]),
    Z("02l6-4", "まって___。(Please wait.)", "ください", ["ください", "ません", "います", "しまう"]),
    Z("02l6-5", "しゃしんを とっても___ですか。(May I take a photo?)", "いい", [
      "いい",
      "だめ",
      "いけない",
      "ください",
    ]),
    C("02l6-6", "～てはいけません means…", "must not / may not", [
      "must not / may not",
      "please do",
      "you may",
      "let's",
    ]),
    C("02l6-7", "～てもいいです means…", "it's OK to / may", [
      "it's OK to / may",
      "must not",
      "please don't",
      "I want to",
    ]),
  ],
  "02-l7": [
    C("02l7-1", "～ている for たべる is…", "たべている", [
      "たべている",
      "たべてるます",
      "たべて",
      "たべますている",
    ]),
    C("02l7-2", "～ている can mean ongoing action AND…", "resultant state", [
      "resultant state",
      "future only",
      "passive only",
      "causative",
    ]),
    Z("02l7-3", "いま べんきょうし___。", "ています", ["ています", "ます", "ました", "てください"]),
    C("02l7-4", "けっこんしている typically means…", "is married (state)", [
      "is married (state)",
      "is marrying right now only",
      "wants to marry",
      "was married",
    ]),
    Z("02l7-5", "としょかん___ べんきょうしに いきます。", "に", ["に", "で", "を", "が"]),
    C("02l7-6", "Counter for people?", "～にん", ["～にん", "～さつ", "～ほん", "～ひき"]),
    C("02l7-7", "ひとり is…", "one person", ["one person", "two people", "one book", "one animal"]),
  ],
  "02-l8": [
    C("02l8-1", "Short form of たべます (plain present)?", "たべる", [
      "たべる",
      "たべた",
      "たべない",
      "たべて",
    ]),
    C("02l8-2", "Short negative of たべる?", "たべない", [
      "たべない",
      "たべません",
      "たべなかった",
      "たべなくて",
    ]),
    Z("02l8-3", "あした あめが ふる___ おもいます。", "と", ["と", "を", "が", "に"]),
    Z("02l8-4", "ともだちが きた___ いいました。", "と", ["と", "を", "で", "に"]),
    C("02l8-5", "～ないでください means…", "please don't ~", [
      "please don't ~",
      "please do ~",
      "you may ~",
      "must ~",
    ]),
    C("02l8-6", "Short form of たかいです?", "たかい", ["たかい", "たかく", "たかかった", "たかくない"]),
    C("02l8-7", "Short form of しずかです?", "しずかだ", [
      "しずかだ",
      "しずかい",
      "しずか",
      "しずかる",
    ]),
  ],
  "02-l9": [
    C("02l9-1", "Plain past of たべる?", "たべた", ["たべた", "たべる", "たべない", "たべました"]),
    C("02l9-2", "Plain past negative of たべる?", "たべなかった", [
      "たべなかった",
      "たべない",
      "たべませんでした",
      "たべてない",
    ]),
    Z("02l9-3", "にほんに いった___ あります。", "ことが", ["ことが", "ものを", "ひとが", "ところを"]),
    C("02l9-4", "～たことがある means…", "have (the experience of) doing", [
      "have (the experience of) doing",
      "want to do",
      "must do",
      "while doing",
    ]),
    C("02l9-5", "Noun-modifying: “the person who came” ≈", "きた ひと", [
      "きた ひと",
      "ひと きた",
      "きます ひと",
      "きたです ひと",
    ]),
    C("02l9-6", "Plain past of たかい?", "たかかった", [
      "たかかった",
      "たかいだった",
      "たかくた",
      "たかいた",
    ]),
    C("02l9-7", "Plain past of しずかだ?", "しずかだった", [
      "しずかだった",
      "しずかかった",
      "しずかした",
      "しずかった",
    ]),
  ],
  "02-l10": [
    Z("02l10-1", "Aは B___ おおきいです。", "より", ["より", "ほうが", "いちばん", "と"]),
    Z("02l10-2", "Aの ほうが B___ おおきいです。", "より", ["より", "から", "まで", "でも"]),
    C("02l10-3", "いちばん means…", "the most / number one", [
      "the most / number one",
      "a little",
      "never",
      "together",
    ]),
    Z("02l10-4", "いしゃに なる___ です。", "つもり", ["つもり", "たい", "そう", "ばかり"]),
    C("02l10-5", "N に なる means…", "become N", ["become N", "do N", "want N", "from N"]),
    C("02l10-6", "どこか means…", "somewhere", ["somewhere", "nowhere", "everywhere", "anywhere? only"]),
    C("02l10-7", "どこにも + negative means…", "nowhere", [
      "nowhere",
      "somewhere",
      "everywhere",
      "anywhere is fine",
    ]),
  ],
  "02-l11": [
    Z("02l11-1", "すしが たべ___です。", "たい", ["たい", "たがる", "たそう", "よう"]),
    C("02l11-2", "～たい conjugates like…", "い-adjectives", [
      "い-adjectives",
      "う-verbs only",
      "な-adjectives only",
      "nouns",
    ]),
    Z("02l11-3", "えいがを み___、 ほんを よんだり します。", "たり", [
      "たり",
      "たりて",
      "とか",
      "し",
    ]),
    C("02l11-4", "A や B など suggests…", "incomplete list (and so on)", [
      "incomplete list (and so on)",
      "only A and B exactly",
      "A or B exclusive",
      "A is better than B",
    ]),
    C("02l11-5", "～ことがある (non-past) can mean…", "sometimes ~ happens", [
      "sometimes ~ happens",
      "have done before only",
      "must do",
      "while doing",
    ]),
    Z("02l11-6", "おんがく___ ききたいです。", "を", ["を", "が", "に", "で"]),
    C("02l11-7", "Negative of たべたいです?", "たべたくないです", [
      "たべたくないです",
      "たべないたいです",
      "たべたくありませんたい",
      "たべたいくないです",
    ]),
  ],
  "02-l12": [
    Z("02l12-1", "あたまが いたい___。 (explaining)", "んです", ["んです", "たいです", "そうです", "ばかりです"]),
    C("02l12-2", "～んです is used to…", "explain / seek explanation", [
      "explain / seek explanation",
      "make passive",
      "count objects",
      "mark the topic",
    ]),
    Z("02l12-3", "たべ___です。(ate too much)", "すぎ", ["すぎ", "ばかり", "たい", "そう"]),
    C("02l12-4", "～ほうがいいです means…", "you'd better / should", [
      "you'd better / should",
      "I want to",
      "I finished",
      "maybe",
    ]),
    Z("02l12-5", "びょうき___ やすみます。", "なので", ["なので", "のに", "ても", "たら"]),
    C("02l12-6", "～なければなりません means…", "must / have to", [
      "must / have to",
      "may",
      "want to",
      "finished doing",
    ]),
    C("02l12-7", "～ばかり means roughly…", "just did / nothing but", [
      "just did / nothing but",
      "must do",
      "while doing",
      "if only",
    ]),
  ],

  // ─── Genki II grammar (04) L13–L23 ───────────────────────────────────────
  "04-l13": [
    C("04l13-1", "Potential of たべる?", "たべられる", [
      "たべられる",
      "たべさせる",
      "たべられるう",
      "たべれるる",
    ]),
    C("04l13-2", "Potential of のむ?", "のめる", ["のめる", "のまれる", "のませる", "のめられる"]),
    Z("04l13-3", "にほんごが はなせ___。", "ます", ["ます", "る", "た", "ない"]),
    C("04l13-4", "～し、～し lists…", "reasons / qualities", [
      "reasons / qualities",
      "only two commands",
      "past events only",
      "honorifics",
    ]),
    C("04l13-5", "～そうです (hearsay) means…", "I hear that ~", [
      "I hear that ~",
      "it looks like ~",
      "I want to ~",
      "I made ~",
    ]),
    Z("04l13-6", "すしを たべて___。 (try eating)", "みる", ["みる", "おく", "しまう", "ある"]),
    C("04l13-7", "Object of potential often takes…", "が", ["が", "を only always", "へ", "と"]),
  ],
  "04-l14": [
    Z("04l14-1", "あたらしい くるまが ほし___。", "いです", ["いです", "いだ", "がるです", "たいです"]),
    C("04l14-2", "～ほしい describes what the speaker…", "wants (object)", [
      "wants (object)",
      "can do",
      "must do",
      "gave",
    ]),
    Z("04l14-3", "あした あめが ふる___。", "かもしれません", [
      "かもしれません",
      "つもりです",
      "ばかりです",
      "すぎます",
    ]),
    C("04l14-4", "あげる direction is…", "I/in-group → outsider", [
      "I/in-group → outsider",
      "outsider → me",
      "mutual only",
      "humble only",
    ]),
    C("04l14-5", "くれる direction is…", "outsider → me/in-group", [
      "outsider → me/in-group",
      "I → outsider",
      "only between strangers",
      "humble action",
    ]),
    C("04l14-6", "もらう means…", "receive (from someone)", [
      "receive (from someone)",
      "give to outsider",
      "make someone do",
      "look like",
    ]),
    Z("04l14-7", "ともだちに ほんを ___。 (I received a book)", "もらった", [
      "もらった",
      "あげた",
      "くれた",
      "やった",
    ]),
  ],
  "04-l15": [
    C("04l15-1", "Volitional of たべる?", "たべよう", ["たべよう", "たべろう", "たべましょうう", "たべるよう"]),
    C("04l15-2", "Volitional of のむ?", "のもう", ["のもう", "のみよう", "のめよう", "のむろう"]),
    C("04l15-3", "Volitional often means…", "let's / I will (intent)", [
      "let's / I will (intent)",
      "must not",
      "passive",
      "if only",
    ]),
    Z("04l15-4", "でかける まえに、でんきを けして___。", "おく", ["おく", "みる", "しまう", "ある"]),
    C("04l15-5", "～ておく means…", "do in advance / leave as is", [
      "do in advance / leave as is",
      "try doing",
      "finish completely",
      "give a favor",
    ]),
    C("04l15-6", "Noun qualification: short form before noun means…", "relative clause", [
      "relative clause",
      "past only",
      "question only",
      "honorific",
    ]),
    C("04l15-7", "Volitional of する?", "しよう", ["しよう", "すろう", "せよう", "さよう"]),
  ],
  "04-l16": [
    C("04l16-1", "～てあげる means…", "do a favor for someone", [
      "do a favor for someone",
      "receive a favor",
      "make someone do",
      "look like",
    ]),
    C("04l16-2", "～てくれる means…", "someone does a favor for me", [
      "someone does a favor for me",
      "I do for outsider only",
      "humble self-move",
      "passive suffering",
    ]),
    Z("04l16-3", "がくせいの ___、よく べんきょうしました。", "時", ["時", "前", "間", "後で"]),
    C("04l16-4", "～時 can mean…", "when / at the time of", [
      "when / at the time of",
      "because",
      "even if",
      "in order to",
    ]),
    Z("04l16-5", "おくれて ___。 (Sorry for being late)", "すみません", [
      "すみません",
      "ください",
      "ましょう",
      "くださいません",
    ]),
    C("04l16-6", "～てすみません apologizes for…", "having done ~", [
      "having done ~",
      "wanting ~",
      "future plans only",
      "nouns only",
    ]),
    C("04l16-7", "～てもらう means…", "have someone do ~ for me", [
      "have someone do ~ for me",
      "I do for them",
      "force someone",
      "look like ~",
    ]),
  ],
  "04-l17": [
    C("04l17-1", "おいしそうです means…", "looks delicious", [
      "looks delicious",
      "I hear it's delicious",
      "was delicious",
      "want delicious",
    ]),
    C("04l17-2", "Appearance そう attaches to…", "adj/verb stem", [
      "adj/verb stem",
      "only full です forms",
      "only past short form",
      "only nouns",
    ]),
    C("04l17-3", "～って is casual for…", "quoting / hearsay", [
      "quoting / hearsay",
      "must do",
      "while doing",
      "passive",
    ]),
    Z("04l17-4", "じかんが あった___、いきます。", "ら", ["ら", "ば", "と", "なら"]),
    C("04l17-5", "～たら often means…", "if/when (after ~)", [
      "if/when (after ~)",
      "even though",
      "in order to",
      "must",
    ]),
    C("04l17-6", "～なくてもいい means…", "don't have to ~", [
      "don't have to ~",
      "must ~",
      "want to ~",
      "just did ~",
    ]),
    C("04l17-7", "Hearsay vs appearance そう: appearance uses…", "stem + そう", [
      "stem + そう",
      "plain form + そうだ only",
      "ます + そう",
      "て + そう",
    ]),
  ],
  "04-l18": [
    C("04l18-1", "Transitive vs intransitive: あける / あく — which is transitive?", "あける", [
      "あける",
      "あく",
      "both same",
      "neither",
    ]),
    C("04l18-2", "～てしまう can mean…", "finish / regrettably do", [
      "finish / regrettably do",
      "try doing",
      "do in advance",
      "look like",
    ]),
    Z("04l18-3", "わすれて___。 (oh no, I forgot)", "しまった", [
      "しまった",
      "みた",
      "おいた",
      "くれた",
    ]),
    C("04l18-4", "Conditional と often for…", "natural consequence / whenever", [
      "natural consequence / whenever",
      "past only wishes",
      "humble requests",
      "counting",
    ]),
    C("04l18-5", "ば-form of いく?", "いけば", ["いけば", "いけら", "いったら", "いくば"]),
    C("04l18-6", "なら often means…", "if it is the case that…", [
      "if it is the case that…",
      "even if",
      "because of",
      "in order to",
    ]),
    C("04l18-7", "ドアが あいている uses intransitive to show…", "state / result", [
      "state / result",
      "I opened it actively only",
      "future plan",
      "honorific",
    ]),
  ],
  "04-l19": [
    C("04l19-1", "Sonkeigo elevates…", "the other person's actions", [
      "the other person's actions",
      "your own actions",
      "inanimate objects only",
      "past tense only",
    ]),
    C("04l19-2", "Honorific of いきます／きます／います?", "いらっしゃいます", [
      "いらっしゃいます",
      "まいります",
      "おります",
      "いたします",
    ]),
    C("04l19-3", "Honorific of たべます／のみます?", "めしあがります", [
      "めしあがります",
      "いただきます",
      "おります",
      "さしあげます",
    ]),
    C("04l19-4", "お＋stem＋になります is…", "respectful pattern", [
      "respectful pattern",
      "humble pattern",
      "casual slang",
      "potential form",
    ]),
    C("04l19-5", "Special honorific of します?", "なさいます", [
      "なさいます",
      "いたします",
      "おります",
      "まいります",
    ]),
    C("04l19-6", "Use sonkeigo when talking…", "about a superior's actions", [
      "about a superior's actions",
      "about your own actions to them",
      "only to children",
      "only in writing dates",
    ]),
    C("04l19-7", "いらっしゃいます can replace…", "いる／くる／いく", [
      "いる／くる／いく",
      "する only",
      "たべる only",
      "ある only",
    ]),
  ],
  "04-l20": [
    C("04l20-1", "Kenjougo humbles…", "your own actions", [
      "your own actions",
      "the listener's actions",
      "weather verbs",
      "adjectives only",
    ]),
    C("04l20-2", "Humble of いきます／きます?", "まいります", [
      "まいります",
      "いらっしゃいます",
      "めしあがります",
      "くださいます",
    ]),
    C("04l20-3", "Humble of いいます?", "もうします", [
      "もうします",
      "おっしゃいます",
      "ごぞんじです",
      "くださいます",
    ]),
    C("04l20-4", "お／ご＋stem＋します is…", "humble pattern", [
      "humble pattern",
      "honorific elevating other",
      "casual past",
      "passive",
    ]),
    C("04l20-5", "Extra-modest おります is humble for…", "います", [
      "います",
      "たべます",
      "します",
      "あります (inanimate same)",
    ]),
    C("04l20-6", "いただきます is humble for…", "たべる／もらう etc.", [
      "たべる／もらう etc.",
      "あげる only",
      "いく only",
      "みる only",
    ]),
    C("04l20-7", "When you visit a company, you often use…", "kenjougo for your side", [
      "kenjougo for your side",
      "sonkeigo for yourself",
      "no polite forms",
      "only plain short form",
    ]),
  ],
  "04-l21": [
    C("04l21-1", "Passive of たべる?", "たべられる", [
      "たべられる",
      "たべさせる",
      "たべられるう",
      "たべれる",
    ]),
    C("04l21-2", "Passive of のむ?", "のまれる", ["のまれる", "のめる", "のませる", "のめられる"]),
    C("04l21-3", "Direct passive often marks sufferer with…", "は／が", [
      "は／が",
      "を only",
      "へ only",
      "と only",
    ]),
    Z("04l21-4", "まどが あけて___。 (window has been opened / left open)", "ある", [
      "ある",
      "いる",
      "おく",
      "みる",
    ]),
    C("04l21-5", "～てある describes…", "resulting state from intentional action", [
      "resulting state from intentional action",
      "ongoing self action only",
      "future plans only",
      "humble movement",
    ]),
    C("04l21-6", "～間に means…", "while / during (in that interval)", [
      "while / during (in that interval)",
      "even if",
      "because",
      "instead of",
    ]),
    C("04l21-7", "Adjective + する (e.g. しずかにする) means…", "make it ~ / do in a ~ way", [
      "make it ~ / do in a ~ way",
      "become passively ~",
      "want ~",
      "look ~",
    ]),
  ],
  "04-l22": [
    C("04l22-1", "Causative of たべる?", "たべさせる", [
      "たべさせる",
      "たべられる",
      "たべさされる",
      "たべれる",
    ]),
    C("04l22-2", "Causative of のむ?", "のませる", ["のませる", "のまれる", "のめる", "のみさせる"]),
    C("04l22-3", "Causative can mean…", "make/let someone do", [
      "make/let someone do",
      "can do",
      "be done to",
      "look like",
    ]),
    C("04l22-4", "～なさい is…", "command (somewhat firm)", [
      "command (somewhat firm)",
      "humble request",
      "hearsay",
      "volitional let's",
    ]),
    C("04l22-5", "ば vs たら vs と: と is best for…", "constant natural results", [
      "constant natural results",
      "one-time past regrets only",
      "honorific offers",
      "counting people",
    ]),
    Z("04l22-6", "こどもに やさいを たべ___。 (make child eat)", "させた", [
      "させた",
      "られた",
      "みた",
      "おいた",
    ]),
    C("04l22-7", "Causative-passive often feels like…", "be forced to do", [
      "be forced to do",
      "want to do",
      "try to do",
      "look like doing",
    ]),
  ],
  "04-l23": [
    C("04l23-1", "Causative-passive of たべる?", "たべさせられる", [
      "たべさせられる",
      "たべられる",
      "たべさせる",
      "たべれさせる",
    ]),
    C("04l23-2", "～ことにする means…", "decide to ~", [
      "decide to ~",
      "come about that ~",
      "look like ~",
      "must ~",
    ]),
    C("04l23-3", "～ことになる means…", "it has been decided / turns out that", [
      "it has been decided / turns out that",
      "I personally decide only",
      "I want to",
      "please don't",
    ]),
    Z("04l23-4", "まいにち さんぽする___に しています。", "こと", [
      "こと",
      "もの",
      "ところ",
      "とき",
    ]),
    C("04l23-5", "～ておく (review) still means…", "do in advance / prepare", [
      "do in advance / prepare",
      "be forced to",
      "passive suffer",
      "honorific eat",
    ]),
    C("04l23-6", "Short causative-passive of いく often…", "いかされる", [
      "いかされる",
      "いかせられる only always",
      "いかれる",
      "いかせる",
    ]),
    C("04l23-7", "にほんに いくことになりました suggests…", "it was arranged/decided (external)", [
      "it was arranged/decided (external)",
      "I selfishly decided only",
      "I was forced to eat",
      "I heard that",
    ]),
  ],

  // ─── Tobira categories (06) ──────────────────────────────────────────────
  "06-about": [
    C("06ab-1", "Tobira is typically aimed at…", "intermediate (post-Genki) learners", [
      "intermediate (post-Genki) learners",
      "absolute beginners only",
      "native speakers only",
      "kanji-only study",
    ]),
    C("06ab-2", "Tobira focuses heavily on…", "grammar patterns for real discourse", [
      "grammar patterns for real discourse",
      "romaji only",
      "keigo exclusively",
      "numbers only",
    ]),
    C("06ab-3", "Compared with Genki, Tobira is…", "more advanced / abstract", [
      "more advanced / abstract",
      "easier kana drills",
      "only children's Japanese",
      "no reading practice",
    ]),
    C("06ab-4", "A good prerequisite for Tobira is…", "Genki II complete", [
      "Genki II complete",
      "no prior study",
      "only katakana",
      "JLPT N1 already",
    ]),
    C("06ab-5", "Tobira grammar is often grouped by…", "function / meaning categories", [
      "function / meaning categories",
      "stroke count only",
      "anime seasons",
      "pitch accent only",
    ]),
    C("06ab-6", "Studying Tobira patterns helps with…", "N3/N2 style reading & speech", [
      "N3/N2 style reading & speech",
      "only saying hello",
      "removing all kanji",
      "English grammar only",
    ]),
    C("06ab-7", "Best way to lock Tobira grammar is…", "active recall + example production", [
      "active recall + example production",
      "only re-reading once",
      "skipping examples",
      "never reviewing",
    ]),
  ],
  "06-c1": [
    C("06c1-1", "～わけだ often marks…", "natural conclusion / that means…", [
      "natural conclusion / that means…",
      "a direct command",
      "humble movement",
      "counting",
    ]),
    C("06c1-2", "～のだ／～んだ can…", "explain or press for explanation", [
      "explain or press for explanation",
      "make passive",
      "form volitional",
      "mark objects",
    ]),
    C("06c1-3", "～ということだ can report…", "hearsay / the fact that", [
      "hearsay / the fact that",
      "must do",
      "appearance only",
      "desire only",
    ]),
    Z("06c1-4", "そういう___ですね。(I see / that explains it)", "わけ", [
      "わけ",
      "つもり",
      "はず",
      "まま",
    ]),
    C("06c1-5", "～はずだ means…", "supposed to / should be the case", [
      "supposed to / should be the case",
      "want to",
      "even if",
      "while",
    ]),
    C("06c1-6", "Reasoning patterns often answer…", "why / how come", [
      "why / how come",
      "where only",
      "who only",
      "how many only",
    ]),
    C("06c1-7", "～から／～ので differ in…", "tone & clause formality nuance", [
      "tone & clause formality nuance",
      "being the same always",
      "only kanji spelling",
      "only pitch",
    ]),
  ],
  "06-c2": [
    C("06c2-1", "～なければならない means…", "must / have to", [
      "must / have to",
      "may",
      "want to",
      "looks like",
    ]),
    C("06c2-2", "～なくてはいけない is similar to…", "obligation", [
      "obligation",
      "permission only",
      "hearsay",
      "passive suffer",
    ]),
    C("06c2-3", "～べきだ means…", "ought to / should (normative)", [
      "ought to / should (normative)",
      "just did",
      "if only",
      "while doing",
    ]),
    C("06c2-4", "～ざるをえない means…", "cannot help but ~", [
      "cannot help but ~",
      "want to ~",
      "try to ~",
      "look ~",
    ]),
    C("06c2-5", "～ないわけにはいかない ≈", "cannot avoid doing", [
      "cannot avoid doing",
      "must not ever",
      "don't have to",
      "looks impossible",
    ]),
    Z("06c2-6", "しゅくだいを し___。 (must do homework, colloquial)", "なきゃ", [
      "なきゃ",
      "たきゃ",
      "なきゃい",
      "なけりゃだけ",
    ]),
    C("06c2-7", "Necessity patterns often pair with…", "social rules / deadlines", [
      "social rules / deadlines",
      "only food names",
      "only colors",
      "only numbers 1–10",
    ]),
  ],
  "06-c3": [
    C("06c3-1", "～だろう／～でしょう express…", "conjecture", [
      "conjecture",
      "completed past only",
      "humble give",
      "passive",
    ]),
    C("06c3-2", "～かもしれない means…", "might / may", [
      "might / may",
      "definitely",
      "must not",
      "please do",
    ]),
    C("06c3-3", "～に違いない means…", "must be (strong certainty)", [
      "must be (strong certainty)",
      "maybe not",
      "I want",
      "I tried",
    ]),
    C("06c3-4", "～ようだ can mean…", "seems / appears that", [
      "seems / appears that",
      "must do",
      "make someone",
      "count",
    ]),
    C("06c3-5", "～らしい often marks…", "hearsay or typical nature", [
      "hearsay or typical nature",
      "volitional only",
      "causative only",
      "object marker",
    ]),
    Z("06c3-6", "あしたは はれる___。 (probably)", "でしょう", [
      "でしょう",
      "たいです",
      "すぎます",
      "てください",
    ]),
    C("06c3-7", "Higher certainty than かもしれない is often…", "に違いない", [
      "に違いない",
      "かもしれない still higher",
      "たい",
      "てみる",
    ]),
  ],
  "06-c4": [
    C("06c4-1", "～せいで often has…", "negative cause nuance", [
      "negative cause nuance",
      "always positive praise",
      "only time meaning",
      "only location",
    ]),
    C("06c4-2", "～おかげで often has…", "positive thanks-for-cause", [
      "positive thanks-for-cause",
      "always blame",
      "only future",
      "only passive",
    ]),
    C("06c4-3", "～によって can mean…", "depending on / by means of", [
      "depending on / by means of",
      "even if",
      "want to",
      "don't have to",
    ]),
    C("06c4-4", "～ため(に) can express…", "cause or purpose", [
      "cause or purpose",
      "only counting",
      "only keigo",
      "only volitional",
    ]),
    Z("06c4-5", "あめの___、 しあいが 中止になった。", "せいで", [
      "せいで",
      "おかげで",
      "たびに",
      "まま",
    ]),
    C("06c4-6", "～からこそ emphasizes…", "precisely because", [
      "precisely because",
      "even without",
      "instead of",
      "as soon as",
    ]),
    C("06c4-7", "Cause patterns answer…", "why something happened", [
      "why something happened",
      "who is polite",
      "how to count birds",
      "stroke order only",
    ]),
  ],
  "06-c5": [
    C("06c5-1", "～たところ means roughly…", "just when / upon doing", [
      "just when / upon doing",
      "must do",
      "want to",
      "passive force",
    ]),
    C("06c5-2", "～たとたん means…", "the moment ~ happened", [
      "the moment ~ happened",
      "even if",
      "in order to",
      "because",
    ]),
    C("06c5-3", "～うちに means…", "while (still) / before change", [
      "while (still) / before change",
      "instead of",
      "despite",
      "only after forever",
    ]),
    C("06c5-4", "～てから／～たあとで order events…", "after doing", [
      "after doing",
      "before ever doing",
      "without doing",
      "instead of doing",
    ]),
    C("06c5-5", "～あいだ(に) relates to…", "time intervals", [
      "time intervals",
      "honorific food",
      "transitive pairs only",
      "counters for books",
    ]),
    Z("06c5-6", "わかい___、 たくさん 旅行したい。", "うちに", [
      "うちに",
      "せいで",
      "わけに",
      "ままにだけ",
    ]),
    C("06c5-7", "Sequence markers help build…", "narrative timelines", [
      "narrative timelines",
      "only adjective tense",
      "only pitch lists",
      "only particle を",
    ]),
  ],
  "06-c6": [
    C("06c6-1", "～ても means…", "even if", ["even if", "because", "in order to", "as soon as"]),
    C("06c6-2", "～のに means…", "even though / despite", [
      "even though / despite",
      "because positively",
      "let's",
      "must",
    ]),
    C("06c6-3", "～としても means…", "even if we assume", [
      "even if we assume",
      "only because",
      "want to",
      "looks like",
    ]),
    C("06c6-4", "ば／と／たら／なら are all…", "conditional families", [
      "conditional families",
      "honorific verbs only",
      "counters",
      "sentence-final particles only",
    ]),
    Z("06c6-5", "べんきょうして___、 しけんに おちた。", "も", ["も", "は", "が", "を"]),
    C("06c6-6", "Concession often contrasts…", "expectation vs reality", [
      "expectation vs reality",
      "only two nouns equally",
      "speaker height",
      "kanji grade only",
    ]),
    C("06c6-7", "～にもかかわらず is a formal…", "despite / notwithstanding", [
      "despite / notwithstanding",
      "in order that",
      "as soon as",
      "by means of only",
    ]),
  ],
  "06-c7": [
    C("06c7-1", "～ほど can mean…", "to the extent that / about", [
      "to the extent that / about",
      "must do",
      "please don't",
      "humble go",
    ]),
    C("06c7-2", "～くらい／ぐらい can mark…", "approximate degree", [
      "approximate degree",
      "honorific eat",
      "passive only",
      "volitional only",
    ]),
    C("06c7-3", "～より～のほうが is…", "comparison", [
      "comparison",
      "causative",
      "hearsay",
      "listing favors",
    ]),
    C("06c7-4", "～こそあれ／～というより adjust…", "degree / reframe comparison", [
      "degree / reframe comparison",
      "only time",
      "only location",
      "only counting pets",
    ]),
    Z("06c7-5", "これ___ むずかしくない。", "くらい", ["くらい", "ほど", "だけに", "まま"]),
    C("06c7-6", "最上級 (superlative) often uses…", "いちばん／もっとも", [
      "いちばん／もっとも",
      "てしまう only",
      "てみる only",
      "お～になる only",
    ]),
    C("06c7-7", "Degree expressions answer…", "how much / to what extent", [
      "how much / to what extent",
      "who is humble",
      "which counter for ships only",
      "stroke direction only",
    ]),
  ],
  "06-c8": [
    C("06c8-1", "～だけ means…", "only / just", ["only / just", "even", "because", "while"]),
    C("06c8-2", "～しか + negative means…", "only (nothing but)", [
      "only (nothing but)",
      "even including",
      "all of them",
      "none required",
    ]),
    C("06c8-3", "～こそ emphasizes…", "precisely X (focus)", [
      "precisely X (focus)",
      "approximately X",
      "excluding X always",
      "past X only",
    ]),
    C("06c8-4", "～さえ means…", "even (extreme example)", [
      "even (extreme example)",
      "only exactly two",
      "because of",
      "as soon as",
    ]),
    Z("06c8-5", "みず___ のまなかった。", "しか", ["しか", "でも", "まで", "より"]),
    C("06c8-6", "～にすぎない means…", "is nothing more than", [
      "is nothing more than",
      "is extremely more than",
      "must be",
      "wants to be",
    ]),
    C("06c8-7", "Emphasis/limitation particles often…", "narrow or spotlight a claim", [
      "narrow or spotlight a claim",
      "mark only destination",
      "create passive",
      "create volitional",
    ]),
  ],
  "06-c9": [
    C("06c9-1", "～つもりだ shows…", "intention", ["intention", "hearsay", "passive", "counting"]),
    C("06c9-2", "～ことにしている means…", "make it a rule to ~", [
      "make it a rule to ~",
      "be forced to",
      "look like",
      "have done once",
    ]),
    C("06c9-3", "～わけではない softens by…", "not necessarily claiming fully", [
      "not necessarily claiming fully",
      "ordering strongly",
      "making causative",
      "counting days",
    ]),
    C("06c9-4", "～かもしれないね softens…", "assertion with uncertainty", [
      "assertion with uncertainty",
      "commands",
      "honorific eat",
      "object marking",
    ]),
    C("06c9-5", "Attitude markers help show…", "speaker stance / certainty", [
      "speaker stance / certainty",
      "only kanji readings",
      "only counters",
      "only stroke order",
    ]),
    Z("06c9-6", "まいにち はしる___に している。", "こと", ["こと", "もの", "わけだけ", "はずだけ"]),
    C("06c9-7", "～ようと思う expresses…", "thinking of doing", [
      "thinking of doing",
      "being forced",
      "looking delicious",
      "having finished regrettably",
    ]),
  ],
  "06-c10": [
    C("06c10-1", "Nominalization with の／こと turns clauses into…", "noun-like units", [
      "noun-like units",
      "only adjectives",
      "only particles",
      "only volitional verbs",
    ]),
    C("06c10-2", "～こと is often more…", "abstract / formal than の", [
      "abstract / formal than の",
      "always more casual than の",
      "only for food",
      "only for keigo",
    ]),
    C("06c10-3", "Relative clauses in Japanese…", "precede the noun", [
      "precede the noun",
      "always follow the noun",
      "require English order",
      "cannot use past tense",
    ]),
    C("06c10-4", "～という N labels…", "content / name of N", [
      "content / name of N",
      "only time",
      "only passive agent",
      "only desire",
    ]),
    Z("06c10-5", "にほんごを べんきょうする___が すきです。", "の", [
      "の",
      "を",
      "がだけ",
      "に",
    ]),
    C("06c10-6", "Noun-modifying is essential for…", "complex reading", [
      "complex reading",
      "only saying yes",
      "removing all verbs",
      "romaji only chat",
    ]),
    C("06c10-7", "～についての／に関する modify nouns for…", "about / regarding", [
      "about / regarding",
      "even if",
      "as soon as",
      "forced to",
    ]),
  ],

  // ─── Keigo (07) ──────────────────────────────────────────────────────────
  "07-axes": [
    C("07ax-1", "The three axes of keigo are…", "丁寧語・尊敬語・謙譲語", [
      "丁寧語・尊敬語・謙譲語",
      "過去・現在・未来",
      "名詞・動詞・形容詞",
      "ひらがな・カタカナ・漢字 only labels",
    ]),
    C("07ax-2", "Teineigo is…", "polite baseline (です／ます)", [
      "polite baseline (です／ます)",
      "elevating others only",
      "humbling yourself only",
      "casual short form only",
    ]),
    C("07ax-3", "Sonkeigo elevates…", "the addressee / third party of respect", [
      "the addressee / third party of respect",
      "your own actions",
      "inanimate weather only",
      "children exclusively",
    ]),
    C("07ax-4", "Kenjougo humbles…", "the speaker's side", [
      "the speaker's side",
      "the customer's actions",
      "only adjectives",
      "only time words",
    ]),
    C("07ax-5", "Mixing axes incorrectly can sound…", "rude or unnatural", [
      "rude or unnatural",
      "always funnier",
      "more native automatically",
      "like keigo is optional always",
    ]),
    C("07ax-6", "In customer service you often…", "elevate customer, humble self", [
      "elevate customer, humble self",
      "elevate yourself, humble customer",
      "use only plain form",
      "avoid です entirely",
    ]),
    C("07ax-7", "Keigo is more about…", "social relationship management", [
      "social relationship management",
      "only JLPT listening speed",
      "only stroke order",
      "only pitch accent quizzes",
    ]),
  ],
  "07-teinei": [
    C("07tei-1", "です／ます forms are core…", "teineigo", ["teineigo", "sonkeigo only", "kenjougo only", "slang"]),
    C("07tei-2", "ございます is a polite form related to…", "ある／です politeness", [
      "ある／です politeness",
      "たべる honorific only",
      "passive only",
      "volitional only",
    ]),
    C("07tei-3", "お／ご + noun can add…", "politeness coloring", [
      "politeness coloring",
      "past tense",
      "passive force",
      "counting",
    ]),
    C("07tei-4", "Teineigo is appropriate with…", "strangers / formal contexts", [
      "strangers / formal contexts",
      "only family at home always",
      "only when angry",
      "never in business",
    ]),
    Z("07tei-5", "こちらは たなか___。", "です", ["です", "だ", "であるのみ", "でござる古"]),
    C("07tei-6", "丁寧語 alone does NOT automatically…", "elevate the listener's actions", [
      "elevate the listener's actions",
      "make sentences polite-ish",
      "use です",
      "use ます",
    ]),
    C("07tei-7", "Ending requests with ます forms is…", "basic polite style", [
      "basic polite style",
      "always humble movement",
      "always sonkeigo",
      "always wrong",
    ]),
  ],
  "07-sonkei": [
    C("07son-1", "いらっしゃる can mean…", "go / come / be (honorific)", [
      "go / come / be (honorific)",
      "eat humble",
      "say humble",
      "do humble only",
    ]),
    C("07son-2", "おっしゃる is honorific for…", "言う", ["言う", "行く", "する", "見る"]),
    C("07son-3", "くださる is honorific for…", "くれる", ["くれる", "あげる", "もらう", "やる"]),
    C("07son-4", "お＋stem＋になる elevates…", "the other person's action", [
      "the other person's action",
      "your action",
      "only nouns",
      "only time",
    ]),
    C("07son-5", "めしあがる is honorific for…", "eat / drink", [
      "eat / drink",
      "go",
      "say",
      "know",
    ]),
    C("07son-6", "ご存じです is honorific for…", "know", ["know", "come", "sleep", "write"]),
    Z("07son-7", "せんせいは もう ___いましたか。", "いらっしゃ", [
      "いらっしゃ",
      "まいり",
      "おり",
      "いたし",
    ]),
  ],
  "07-kenjo": [
    C("07ken-1", "まいる is humble for…", "行く／来る", ["行く／来る", "言う", "食べる", "くれる"]),
    C("07ken-2", "申す is humble for…", "言う", ["言う", "する", "見る", "ある"]),
    C("07ken-3", "いたす is humble for…", "する", ["する", "来る", "いる", "くれる"]),
    C("07ken-4", "お／ご＋stem＋する humbles…", "your action toward others", [
      "your action toward others",
      "their action toward you",
      "only weather",
      "only adjectives",
    ]),
    C("07ken-5", "拝見する is humble for…", "見る", ["見る", "行く", "食べる", "聞く only never"]),
    C("07ken-6", "伺う can mean humble…", "ask / visit / hear", [
      "ask / visit / hear",
      "eat honorific",
      "be honorific",
      "give honorific",
    ]),
    Z("07ken-7", "あした うかが___。", "います", ["います", "なります", "なさいます", "くださいます"]),
  ],
  "07-combine": [
    C("07com-1", "In one sentence you may…", "humble your verb and elevate theirs", [
      "humble your verb and elevate theirs",
      "elevate yourself and humble them",
      "never mix axes",
      "only use plain form",
    ]),
    C("07com-2", "「社長がおっしゃいました」 elevates…", "the president", [
      "the president",
      "yourself",
      "a child friend",
      "an object",
    ]),
    C("07com-3", "「私が申しました」 humbles…", "the speaker", [
      "the speaker",
      "the president",
      "the weather",
      "the listener always wrong",
    ]),
    C("07com-4", "Giving a gift: elevate receiver with…", "差し上げる / くださる patterns carefully", [
      "差し上げる / くださる patterns carefully",
      "only やる always",
      "only short form くれた",
      "no verbs",
    ]),
    C("07com-5", "Wrong mix example: using sonkeigo for yourself…", "sounds arrogant/odd", [
      "sounds arrogant/odd",
      "is required always",
      "is the only correct way",
      "marks past tense",
    ]),
    C("07com-6", "Business email often combines…", "ていねい + 謙譲 + 尊敬 as needed", [
      "ていねい + 謙譲 + 尊敬 as needed",
      "only casual line slang",
      "only emoji",
      "only romaji",
    ]),
    C("07com-7", "When in doubt in service contexts…", "polite + humble self + respect customer", [
      "polite + humble self + respect customer",
      "plain short forms only",
      "sonkeigo for yourself",
      "no です",
    ]),
  ],
  "07-scenarios": [
    C("07sc-1", "Answering the phone at work, a common humble opener is…", "お電話ありがとうございます／でございます", [
      "お電話ありがとうございます／でございます",
      "おれだよ",
      "あんた誰",
      "short form only だ",
    ]),
    C("07sc-2", "Visiting a client, you often say you…", "伺います", [
      "伺います",
      "いらっしゃいます about yourself",
      "めしあがります about yourself",
      "おっしゃいます about yourself",
    ]),
    C("07sc-3", "Offering help to a customer…", "elevate their convenience", [
      "elevate their convenience",
      "command them casually",
      "use only てform rude",
      "ignore politeness",
    ]),
    C("07sc-4", "Receiving a document from a superior: humble receive…", "拝見します／いただきます", [
      "拝見します／いただきます",
      "めしあがります",
      "いらっしゃいます",
      "おっしゃいます for yourself",
    ]),
    C("07sc-5", "Introducing your colleague to a client…", "humble your in-group somewhat", [
      "humble your in-group somewhat",
      "use sonkeigo for your junior always to client? careful",
      "use plain だ only",
      "never introduce",
    ]),
    C("07sc-6", "Store clerk to customer typically uses…", "respectful language toward customer", [
      "respectful language toward customer",
      "kenjougo for customer actions",
      "only slang",
      "only dictionary form",
    ]),
    C("07sc-7", "Leaving a message politely often uses…", "申し伝えます etc.", [
      "申し伝えます etc.",
      "のみたい",
      "食って",
      "やるよ",
    ]),
  ],
  "07-mistakes": [
    C("07mis-1", "Using いらっしゃる about yourself is…", "a common mistake", [
      "a common mistake",
      "required humble form",
      "correct kenjougo",
      "only for food",
    ]),
    C("07mis-2", "ダブル敬語 (e.g. お召し上がりになる) is often…", "overdone / nonstandard", [
      "overdone / nonstandard",
      "always required",
      "the only correct form",
      "used for children only",
    ]),
    C("07mis-3", "Humbling the customer's actions is…", "wrong direction", [
      "wrong direction",
      "always correct",
      "required in all chat",
      "used for weather",
    ]),
    C("07mis-4", "おる about a superior's existence is…", "incorrect (too humble for them)", [
      "incorrect (too humble for them)",
      "best honorific",
      "required sonkeigo",
      "casual slang only",
    ]),
    C("07mis-5", "Safer default with strangers…", "丁寧語 first", [
      "丁寧語 first",
      "full slang",
      "sonkeigo for yourself",
      "no copula",
    ]),
    C("07mis-6", "Saying ご苦労様 to a superior is often…", "inappropriate", [
      "inappropriate",
      "perfectly honorific always",
      "humble for yourself",
      "required greeting",
    ]),
    C("07mis-7", "Overusing させていただく can sound…", "stiff or unnatural if abused", [
      "stiff or unnatural if abused",
      "always wrong never usable",
      "only for past tense",
      "a particle",
    ]),
  ],
  "07-assess": [
    C("07as-1", "If you only know です／ます, your keigo level is…", "teineigo baseline", [
      "teineigo baseline",
      "full sonkeigo mastery",
      "full kenjougo mastery",
      "native business perfect",
    ]),
    C("07as-2", "Recognizing おっしゃる／いらっしゃる shows…", "sonkeigo awareness", [
      "sonkeigo awareness",
      "only kana skill",
      "only counting skill",
      "only pitch skill",
    ]),
    C("07as-3", "Producing まいります／いたします shows…", "kenjougo production", [
      "kenjougo production",
      "sonkeigo elevation of other only",
      "casual short form",
      "passive only",
    ]),
    C("07as-4", "Choosing the wrong axis usually…", "hurts social tone", [
      "hurts social tone",
      "improves grammar always",
      "changes only pitch",
      "is invisible",
    ]),
    C("07as-5", "Business-ready keigo needs…", "all three axes in context", [
      "all three axes in context",
      "only romaji",
      "only Genki L1",
      "no practice",
    ]),
    C("07as-6", "Best practice method…", "scenario drills + active recall", [
      "scenario drills + active recall",
      "read once and stop",
      "avoid speaking",
      "skip examples",
    ]),
    C("07as-7", "After this lesson you should…", "review mistakes & real scenarios", [
      "review mistakes & real scenarios",
      "never use です",
      "only use やる",
      "drop all politeness",
    ]),
  ],

  // ─── Vocab mega-lessons extras (03/05) when auto vocab is thin ───────────
  "03-convo": [
    C("03cv-1", "はじめまして is used when…", "meeting someone the first time", [
      "meeting someone the first time",
      "leaving forever",
      "ordering food only",
      "counting",
    ]),
    C("03cv-2", "どうぞよろしく is roughly…", "pleased to meet you / treat me well", [
      "pleased to meet you / treat me well",
      "goodbye forever",
      "I'm hungry",
      "how much?",
    ]),
    C("03cv-3", "すみません can mean…", "excuse me / sorry", [
      "excuse me / sorry",
      "congratulations only",
      "good morning only",
      "I refuse always",
    ]),
    C("03cv-4", "ありがとうございます is…", "thank you (polite)", [
      "thank you (polite)",
      "you're welcome only",
      "good night",
      "see you",
    ]),
    C("03cv-5", "いってきます is said by…", "the person leaving home", [
      "the person leaving home",
      "the person staying only never",
      "only teachers",
      "only store clerks",
    ]),
    C("03cv-6", "いってらっしゃい is said to…", "someone leaving", [
      "someone leaving",
      "someone arriving from abroad only",
      "only customers",
      "only yourself",
    ]),
    C("03cv-7", "いただきます before meals means…", "thanks for the food / I receive", [
      "thanks for the food / I receive",
      "I'm full forever",
      "check please only",
      "spicy please",
    ]),
  ],
  "03-kanji": [
    C("03kj-1", "Japanese kanji often encode…", "meaning + readings", [
      "meaning + readings",
      "only romaji",
      "only pitch numbers",
      "only verb tense",
    ]),
    C("03kj-2", "On-yomi are often…", "Sino-Japanese readings", [
      "Sino-Japanese readings",
      "only kun native always exclusively wrong",
      "particle readings",
      "English loan only",
    ]),
    C("03kj-3", "Kun-yomi are often…", "native Japanese readings", [
      "native Japanese readings",
      "only Chinese numbers",
      "only katakana",
      "only counters",
    ]),
    C("03kj-4", "Genki I introduces roughly…", "about 145 kanji", [
      "about 145 kanji",
      "2 kanji total",
      "2000 on day one",
      "no kanji",
    ]),
    C("03kj-5", "Best retention for kanji…", "words in context + recall", [
      "words in context + recall",
      "stare without writing",
      "skip readings",
      "never review",
    ]),
    C("03kj-6", "A kanji can have…", "multiple readings", [
      "multiple readings",
      "exactly one reading always",
      "no meaning",
      "only English",
    ]),
    C("03kj-7", "Learning kanji with vocab is better than…", "isolated lists only", [
      "isolated lists only",
      "using example words",
      "SRS review",
      "reading practice",
    ]),
  ],
  "05-adv": [
    C("05ad-1", "もう can mean…", "already / (not) anymore", [
      "already / (not) anymore",
      "only please",
      "only because",
      "only if",
    ]),
    C("05ad-2", "まだ can mean…", "still / not yet", [
      "still / not yet",
      "already finished always",
      "must",
      "want",
    ]),
    C("05ad-3", "だんだん means…", "gradually", ["gradually", "suddenly only", "never", "exactly once"]),
    C("05ad-4", "ぜひ means…", "by all means / definitely (want)", [
      "by all means / definitely (want)",
      "never",
      "accidentally",
      "only yesterday",
    ]),
    C("05ad-5", "たぶん means…", "probably", ["probably", "never", "must not", "please"]),
    C("05ad-6", "なかなか + negative means…", "not easily / not quite", [
      "not easily / not quite",
      "very easy always",
      "exactly",
      "honorific eat",
    ]),
    C("05ad-7", "ずっと means…", "continuously / by far", [
      "continuously / by far",
      "only once",
      "never",
      "please sit",
    ]),
  ],
  "05-convo": [
    C("05cv-1", "～てもいいですか asks…", "permission", ["permission", "name only", "price only", "time zone only"]),
    C("05cv-2", "～てくれませんか is a…", "request (favor)", [
      "request (favor)",
      "past tense statement only",
      "humble self-name",
      "counter",
    ]),
    C("05cv-3", "そうですか often shows…", "I see / acknowledgment", [
      "I see / acknowledgment",
      "I refuse always",
      "good morning",
      "count two",
    ]),
    C("05cv-4", "ほんとうですか checks…", "confirmation / surprise", [
      "confirmation / surprise",
      "order food",
      "board train",
      "write kanji",
    ]),
    C("05cv-5", "ちょっと… as refusal is often…", "soft no / hesitation", [
      "soft no / hesitation",
      "strong yes always",
      "counting",
      "honorific go",
    ]),
    C("05cv-6", "よろしくおねがいします can close…", "requests / introductions", [
      "requests / introductions",
      "only insults",
      "only math",
      "only weather reports",
    ]),
    C("05cv-7", "かしこまりました is…", "certainly (service response)", [
      "certainly (service response)",
      "I quit",
      "good night casual",
      "plain past eat",
    ]),
  ],
  "05-kanji": [
    C("05kj-1", "Genki II adds on the order of…", "~170 more kanji", [
      "~170 more kanji",
      "zero kanji",
      "exactly 2",
      "10,000 day one",
    ]),
    C("05kj-2", "Compounds often use…", "on-yomi combinations", [
      "on-yomi combinations",
      "only English",
      "only particles",
      "only teineigo",
    ]),
    C("05kj-3", "Reviewing Genki I kanji while learning II…", "reduces forgetting", [
      "reduces forgetting",
      "wastes time always",
      "is forbidden",
      "breaks SRS",
    ]),
    C("05kj-4", "Writing + reading together builds…", "stronger memory", [
      "stronger memory",
      "weaker memory",
      "only listening",
      "no benefit",
    ]),
    C("05kj-5", "Kanji in context (sentences) beats…", "pure isolated drills only", [
      "pure isolated drills only",
      "immersion examples",
      "vocab cards",
      "graded reading",
    ]),
    C("05kj-6", "A single kanji's meaning is…", "often extended by compounds", [
      "often extended by compounds",
      "never changes",
      "only romaji",
      "only hiragana",
    ]),
    C("05kj-7", "Spaced review after this section should…", "include weak characters first", [
      "include weak characters first",
      "skip all mistakes",
      "only new never old",
      "avoid recall",
    ]),
  ],
};

/**
 * Map section id/title → seed key. Uses lesson numbers and keywords so
 * slugify differences (Japanese in slugs) do not break lookup.
 */
export function findPracticeSeed(
  sectionId: string,
  title = "",
): PracticeItem[] | null {
  const t = `${sectionId} ${title}`.toLowerCase();

  // Genki lesson numbers (02 L1–12, 04 L13–23)
  const lessonNum = /(?:^|:)lesson-(\d+)\b/.exec(sectionId) ?? /lesson\s*(\d+)/i.exec(title);
  if (lessonNum) {
    const n = Number(lessonNum[1]);
    if (n >= 1 && n <= 12 && (sectionId.startsWith("02") || t.includes("02:"))) {
      const items = PRACTICE_SEEDS[`02-l${n}`];
      if (items) return items;
    }
    if (n >= 13 && n <= 23) {
      const items = PRACTICE_SEEDS[`04-l${n}`];
      if (items) return items;
    }
    // 04 sections are lesson-13 etc.
    if (sectionId.startsWith("04") && n >= 13 && n <= 23) {
      return PRACTICE_SEEDS[`04-l${n}`] ?? null;
    }
    if (sectionId.startsWith("02") && n >= 1 && n <= 12) {
      return PRACTICE_SEEDS[`02-l${n}`] ?? null;
    }
  }

  // Tobira categories
  const cat = /grammar-category-(\d+)/.exec(sectionId) ?? /category\s*(\d+)/i.exec(title);
  if (cat && (sectionId.startsWith("06") || /tobira/i.test(t))) {
    return PRACTICE_SEEDS[`06-c${cat[1]}`] ?? null;
  }
  if (sectionId.startsWith("06") && /about|structure/i.test(t)) {
    return PRACTICE_SEEDS["06-about"] ?? null;
  }

  // Keigo
  if (sectionId.startsWith("07") || /keigo|敬語|sonkei|kenjou|teinei/i.test(t)) {
    if (/three axes|axes of keigo|三/i.test(t) || /the-three-axes/.test(sectionId))
      return PRACTICE_SEEDS["07-axes"]!;
    if (/teineigo|丁寧/i.test(t)) return PRACTICE_SEEDS["07-teinei"]!;
    if (/sonkeigo|尊敬/i.test(t)) return PRACTICE_SEEDS["07-sonkei"]!;
    if (/kenjougo|謙譲/i.test(t)) return PRACTICE_SEEDS["07-kenjo"]!;
    if (/combining|combine/i.test(t)) return PRACTICE_SEEDS["07-combine"]!;
    if (/scenario|real-world/i.test(t)) return PRACTICE_SEEDS["07-scenarios"]!;
    if (/mistake/i.test(t)) return PRACTICE_SEEDS["07-mistakes"]!;
    if (/assessment|self-assessment|self-check|self check/i.test(t))
      return PRACTICE_SEEDS["07-assess"]!;
    if (/quick-reference|quick reference|reference table/i.test(t))
      return PRACTICE_SEEDS["07-axes"]!; // conceptual review
  }

  // Vocab lesson non-table sections
  if (sectionId.startsWith("03")) {
    if (/conversation|patterns/i.test(t)) return PRACTICE_SEEDS["03-convo"]!;
    if (/kanji/i.test(t)) return PRACTICE_SEEDS["03-kanji"]!;
  }
  if (sectionId.startsWith("05")) {
    if (/adverb|expression/i.test(t)) return PRACTICE_SEEDS["05-adv"]!;
    if (/conversation|patterns/i.test(t)) return PRACTICE_SEEDS["05-convo"]!;
    if (/kanji/i.test(t)) return PRACTICE_SEEDS["05-kanji"]!;
  }

  // Exact key fallback
  if (PRACTICE_SEEDS[sectionId]) return PRACTICE_SEEDS[sectionId]!;

  return null;
}
