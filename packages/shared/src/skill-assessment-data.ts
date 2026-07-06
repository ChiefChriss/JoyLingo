/** Auto-generated from skill_level.md — do not edit by hand. */
import type { SkillQuestion, SkillSectionMeta } from "./skill-assessment.js";

export const SKILL_SECTIONS: Record<string, SkillSectionMeta> = {
  "A": {
    "label": "Kana & Basic Sentences",
    "jlpt": "Pre-N5",
    "max": 8
  },
  "B": {
    "label": "Particles, Verbs, Adjectives",
    "jlpt": "N5",
    "max": 10
  },
  "C": {
    "label": "Te-form, Short Forms, Potential",
    "jlpt": "N5/N4",
    "max": 10
  },
  "D": {
    "label": "Conditionals, Passive, Causative",
    "jlpt": "N4",
    "max": 10
  },
  "E": {
    "label": "Advanced Grammar (Tobira)",
    "jlpt": "N3/N2",
    "max": 10
  },
  "F": {
    "label": "Keigo",
    "jlpt": "N3+",
    "max": 8
  },
  "G": {
    "label": "Reading Comprehension",
    "jlpt": "Mixed",
    "max": 6
  }
};

export const SKILL_QUESTIONS: SkillQuestion[] = [
  {
    "id": "q1",
    "section": "A",
    "prompt": "Which is the correct hiragana for \"sushi\"?",
    "options": [
      {
        "id": "a",
        "text": "すし"
      },
      {
        "id": "b",
        "text": "すす"
      },
      {
        "id": "c",
        "text": "しす"
      },
      {
        "id": "d",
        "text": "しし"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q2",
    "section": "A",
    "prompt": "Which is the correct katakana for \"America\"?",
    "options": [
      {
        "id": "a",
        "text": "アメリカ"
      },
      {
        "id": "b",
        "text": "アミリカ"
      },
      {
        "id": "c",
        "text": "アメカリ"
      },
      {
        "id": "d",
        "text": "アメイカ"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q3",
    "section": "A",
    "prompt": "What does 「わたしはがくせいです」 mean?",
    "options": [
      {
        "id": "a",
        "text": "I am a teacher."
      },
      {
        "id": "b",
        "text": "I am a student."
      },
      {
        "id": "c",
        "text": "You are a student."
      },
      {
        "id": "d",
        "text": "This is a school."
      }
    ],
    "correct": "b"
  },
  {
    "id": "q4",
    "section": "A",
    "prompt": "Which reads 「これはほんです」?",
    "options": [
      {
        "id": "a",
        "text": "Kore wa pen desu."
      },
      {
        "id": "b",
        "text": "Kore wa hon desu."
      },
      {
        "id": "c",
        "text": "Sore wa hon desu."
      },
      {
        "id": "d",
        "text": "Kore wa hito desu."
      }
    ],
    "correct": "b"
  },
  {
    "id": "q5",
    "section": "A",
    "prompt": "「いいですね」 — what nuance does ね add?",
    "options": [
      {
        "id": "a",
        "text": "Strong assertion"
      },
      {
        "id": "b",
        "text": "Seeking agreement / \"isn't it?\""
      },
      {
        "id": "c",
        "text": "Question"
      },
      {
        "id": "d",
        "text": "Sarcasm"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q6",
    "section": "A",
    "prompt": "Which of these is NOT a Japanese number?",
    "options": [
      {
        "id": "a",
        "text": "ろく"
      },
      {
        "id": "b",
        "text": "はち"
      },
      {
        "id": "c",
        "text": "しち"
      },
      {
        "id": "d",
        "text": "むい"
      }
    ],
    "correct": "d"
  },
  {
    "id": "q7",
    "section": "A",
    "prompt": "Match the time: ごご さんじ",
    "options": [
      {
        "id": "a",
        "text": "3:00 AM"
      },
      {
        "id": "b",
        "text": "3:00 PM"
      },
      {
        "id": "c",
        "text": "5:00 PM"
      },
      {
        "id": "d",
        "text": "5:00 AM"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q8",
    "section": "A",
    "prompt": "「これは いくらですか」 means:",
    "options": [
      {
        "id": "a",
        "text": "Where is this?"
      },
      {
        "id": "b",
        "text": "How much is this?"
      },
      {
        "id": "c",
        "text": "What is this?"
      },
      {
        "id": "d",
        "text": "When is this?"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q9",
    "section": "B",
    "prompt": "Fill in the particle: わたし ___ たなかです。",
    "options": [
      {
        "id": "a",
        "text": "を"
      },
      {
        "id": "b",
        "text": "は"
      },
      {
        "id": "c",
        "text": "が"
      },
      {
        "id": "d",
        "text": "に"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q10",
    "section": "B",
    "prompt": "Fill in the particle: コーヒー ___ のみます。",
    "options": [
      {
        "id": "a",
        "text": "を"
      },
      {
        "id": "b",
        "text": "は"
      },
      {
        "id": "c",
        "text": "が"
      },
      {
        "id": "d",
        "text": "で"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q11",
    "section": "B",
    "prompt": "Fill in the particle: としょかん ___ べんきょうします。",
    "options": [
      {
        "id": "a",
        "text": "に"
      },
      {
        "id": "b",
        "text": "で"
      },
      {
        "id": "c",
        "text": "を"
      },
      {
        "id": "d",
        "text": "へ"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q12",
    "section": "B",
    "prompt": "Which means \"I will go to Japan\"?",
    "options": [
      {
        "id": "a",
        "text": "にほんへ いきます。"
      },
      {
        "id": "b",
        "text": "にほんに きます。"
      },
      {
        "id": "c",
        "text": "にほんから いきます。"
      },
      {
        "id": "d",
        "text": "にほんまで いきます。"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q13",
    "section": "B",
    "prompt": "What is the past negative of です?",
    "options": [
      {
        "id": "a",
        "text": "でした"
      },
      {
        "id": "b",
        "text": "じゃなかったです"
      },
      {
        "id": "c",
        "text": "じゃないです"
      },
      {
        "id": "d",
        "text": "ではありません"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q14",
    "section": "B",
    "prompt": "Conjugate: たべる (to eat) → polite past affirmative",
    "options": [
      {
        "id": "a",
        "text": "たべました"
      },
      {
        "id": "b",
        "text": "たべます"
      },
      {
        "id": "c",
        "text": "たべませんでした"
      },
      {
        "id": "d",
        "text": "たべるです"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q15",
    "section": "B",
    "prompt": "Conjugate: のむ (to drink) → polite negative",
    "options": [
      {
        "id": "a",
        "text": "のみます"
      },
      {
        "id": "b",
        "text": "のみません"
      },
      {
        "id": "c",
        "text": "のまない"
      },
      {
        "id": "d",
        "text": "のまなかった"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q16",
    "section": "B",
    "prompt": "Which is a な-adjective?",
    "options": [
      {
        "id": "a",
        "text": "たかい"
      },
      {
        "id": "b",
        "text": "おもしろい"
      },
      {
        "id": "c",
        "text": "しずか"
      },
      {
        "id": "d",
        "text": "あたらしい"
      }
    ],
    "correct": "c"
  },
  {
    "id": "q17",
    "section": "B",
    "prompt": "What is the negative of たかい (expensive)?",
    "options": [
      {
        "id": "a",
        "text": "たかくない"
      },
      {
        "id": "b",
        "text": "たかじゃない"
      },
      {
        "id": "c",
        "text": "たかない"
      },
      {
        "id": "d",
        "text": "たかじゃなかった"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q18",
    "section": "B",
    "prompt": "Choose the correct sentence:",
    "options": [
      {
        "id": "a",
        "text": "わたしは いぬが すきです。"
      },
      {
        "id": "b",
        "text": "わたしは いぬを すきです。"
      },
      {
        "id": "c",
        "text": "わたしは いぬに すきです。"
      },
      {
        "id": "d",
        "text": "わたしは いぬで すきです。"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q19",
    "section": "C",
    "prompt": "What is the て-form of かく (to write)?",
    "options": [
      {
        "id": "a",
        "text": "かて"
      },
      {
        "id": "b",
        "text": "かいて"
      },
      {
        "id": "c",
        "text": "かって"
      },
      {
        "id": "d",
        "text": "かくて"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q20",
    "section": "C",
    "prompt": "What is the て-form of およぐ (to swim)?",
    "options": [
      {
        "id": "a",
        "text": "およいで"
      },
      {
        "id": "b",
        "text": "およて"
      },
      {
        "id": "c",
        "text": "およんで"
      },
      {
        "id": "d",
        "text": "およぐて"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q21",
    "section": "C",
    "prompt": "What is the て-form of する (to do)?",
    "options": [
      {
        "id": "a",
        "text": "すて"
      },
      {
        "id": "b",
        "text": "して"
      },
      {
        "id": "c",
        "text": "すって"
      },
      {
        "id": "d",
        "text": "しって"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q22",
    "section": "C",
    "prompt": "What is the た-form of のむ (to drink)?",
    "options": [
      {
        "id": "a",
        "text": "のた"
      },
      {
        "id": "b",
        "text": "のんで"
      },
      {
        "id": "c",
        "text": "のいた"
      },
      {
        "id": "d",
        "text": "のった"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q23",
    "section": "C",
    "prompt": "「まってください」 means:",
    "options": [
      {
        "id": "a",
        "text": "Please wait."
      },
      {
        "id": "b",
        "text": "Please don't wait."
      },
      {
        "id": "c",
        "text": "I will wait."
      },
      {
        "id": "d",
        "text": "Let's wait."
      }
    ],
    "correct": "a"
  },
  {
    "id": "q24",
    "section": "C",
    "prompt": "「はいってもいいですか」 means:",
    "options": [
      {
        "id": "a",
        "text": "You must enter."
      },
      {
        "id": "b",
        "text": "May I come in?"
      },
      {
        "id": "c",
        "text": "Please don't enter."
      },
      {
        "id": "d",
        "text": "Let's enter."
      }
    ],
    "correct": "b"
  },
  {
    "id": "q25",
    "section": "C",
    "prompt": "「たべてはいけません」 means:",
    "options": [
      {
        "id": "a",
        "text": "Please eat."
      },
      {
        "id": "b",
        "text": "You may eat."
      },
      {
        "id": "c",
        "text": "You must not eat."
      },
      {
        "id": "d",
        "text": "Let's eat."
      }
    ],
    "correct": "c"
  },
  {
    "id": "q26",
    "section": "C",
    "prompt": "What is the short form (casual) of たべます?",
    "options": [
      {
        "id": "a",
        "text": "たべる"
      },
      {
        "id": "b",
        "text": "たべない"
      },
      {
        "id": "c",
        "text": "たべた"
      },
      {
        "id": "d",
        "text": "たべろう"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q27",
    "section": "C",
    "prompt": "「にほんごが はなせます」 means:",
    "options": [
      {
        "id": "a",
        "text": "I speak Japanese."
      },
      {
        "id": "b",
        "text": "I can speak Japanese."
      },
      {
        "id": "c",
        "text": "I want to speak Japanese."
      },
      {
        "id": "d",
        "text": "I will speak Japanese."
      }
    ],
    "correct": "b"
  },
  {
    "id": "q28",
    "section": "C",
    "prompt": "What is the potential form of いく (to go)?",
    "options": [
      {
        "id": "a",
        "text": "いかれる"
      },
      {
        "id": "b",
        "text": "いける"
      },
      {
        "id": "c",
        "text": "いかせる"
      },
      {
        "id": "d",
        "text": "いかられる"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q29",
    "section": "D",
    "prompt": "「あした はれたら、こうえんに いきます」 — which conditional is used?",
    "options": [
      {
        "id": "a",
        "text": "と"
      },
      {
        "id": "b",
        "text": "ば"
      },
      {
        "id": "c",
        "text": "たら"
      },
      {
        "id": "d",
        "text": "なら"
      }
    ],
    "correct": "c"
  },
  {
    "id": "q30",
    "section": "D",
    "prompt": "Which conditional is for natural consequences?",
    "options": [
      {
        "id": "a",
        "text": "と"
      },
      {
        "id": "b",
        "text": "ば"
      },
      {
        "id": "c",
        "text": "たら"
      },
      {
        "id": "d",
        "text": "なら"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q31",
    "section": "D",
    "prompt": "What is the passive form of たべる?",
    "options": [
      {
        "id": "a",
        "text": "たべられる"
      },
      {
        "id": "b",
        "text": "たべさせる"
      },
      {
        "id": "c",
        "text": "たべられる (but this could also be potential — context matters!)"
      },
      {
        "id": "d",
        "text": "たべれる"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q32",
    "section": "D",
    "prompt": "「わたしは いぬに てを かまれました」 means:",
    "options": [
      {
        "id": "a",
        "text": "I bit the dog's hand."
      },
      {
        "id": "b",
        "text": "I had my hand bitten by a dog."
      },
      {
        "id": "c",
        "text": "The dog and I bit hands."
      },
      {
        "id": "d",
        "text": "I was petting the dog."
      }
    ],
    "correct": "b"
  },
  {
    "id": "q33",
    "section": "D",
    "prompt": "What is the causative form of いく?",
    "options": [
      {
        "id": "a",
        "text": "いかせる"
      },
      {
        "id": "b",
        "text": "いける"
      },
      {
        "id": "c",
        "text": "いかれる"
      },
      {
        "id": "d",
        "text": "いかせられる"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q34",
    "section": "D",
    "prompt": "「ともだちは わたしに プレゼントを ___」",
    "options": [
      {
        "id": "a",
        "text": "あげました"
      },
      {
        "id": "b",
        "text": "くれました"
      },
      {
        "id": "c",
        "text": "もらいました"
      },
      {
        "id": "d",
        "text": "しました"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q35",
    "section": "D",
    "prompt": "「わたしは ともだちに にほんごを おしえて ___」",
    "options": [
      {
        "id": "a",
        "text": "あげました"
      },
      {
        "id": "b",
        "text": "くれました"
      },
      {
        "id": "c",
        "text": "いただきました"
      },
      {
        "id": "d",
        "text": "くださいました"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q36",
    "section": "D",
    "prompt": "What does ～てみる express?",
    "options": [
      {
        "id": "a",
        "text": "To see something"
      },
      {
        "id": "b",
        "text": "To try doing something"
      },
      {
        "id": "c",
        "text": "To watch something"
      },
      {
        "id": "d",
        "text": "To look at something carefully"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q37",
    "section": "D",
    "prompt": "「しゅくだいを やってしまいました」 implies:",
    "options": [
      {
        "id": "a",
        "text": "I'm upset about doing homework."
      },
      {
        "id": "b",
        "text": "I finished the homework (completely, or with a sense of finality)."
      },
      {
        "id": "c",
        "text": "I threw away the homework."
      },
      {
        "id": "d",
        "text": "I started the homework."
      }
    ],
    "correct": "b"
  },
  {
    "id": "q38",
    "section": "D",
    "prompt": "「まどが しめてあります」 (vs 「まどが しまっています」) implies:",
    "options": [
      {
        "id": "a",
        "text": "The window is naturally closed."
      },
      {
        "id": "b",
        "text": "Someone intentionally closed the window and it remains closed."
      },
      {
        "id": "c",
        "text": "The window is being closed now."
      },
      {
        "id": "d",
        "text": "The window can't be closed."
      }
    ],
    "correct": "b"
  },
  {
    "id": "q39",
    "section": "E",
    "prompt": "「にほんに １０ねん すんでいるから、にほんごが じょうずな ___」",
    "options": [
      {
        "id": "a",
        "text": "はずだ"
      },
      {
        "id": "b",
        "text": "わけだ"
      },
      {
        "id": "c",
        "text": "べきだ"
      },
      {
        "id": "d",
        "text": "ことだ"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q40",
    "section": "E",
    "prompt": "「べんきょうしないと、しけんに おちる ___」",
    "options": [
      {
        "id": "a",
        "text": "かもしれない"
      },
      {
        "id": "b",
        "text": "にちがいない"
      },
      {
        "id": "c",
        "text": "はずがない"
      },
      {
        "id": "d",
        "text": "わけではない"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q41",
    "section": "E",
    "prompt": "「わるいことを したら、あやまる ___」",
    "options": [
      {
        "id": "a",
        "text": "ことだ"
      },
      {
        "id": "b",
        "text": "ものだ"
      },
      {
        "id": "c",
        "text": "べきだ"
      },
      {
        "id": "d",
        "text": "わけだ"
      }
    ],
    "correct": "c"
  },
  {
    "id": "q42",
    "section": "E",
    "prompt": "「これは ただの うわさ ___」",
    "options": [
      {
        "id": "a",
        "text": "にすぎない"
      },
      {
        "id": "b",
        "text": "にほかならない"
      },
      {
        "id": "c",
        "text": "にちがいない"
      },
      {
        "id": "d",
        "text": "にかぎる"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q43",
    "section": "E",
    "prompt": "「あめの ___、ピクニックが ちゅうしに なった」",
    "options": [
      {
        "id": "a",
        "text": "おかげで"
      },
      {
        "id": "b",
        "text": "せいで"
      },
      {
        "id": "c",
        "text": "ために"
      },
      {
        "id": "d",
        "text": "ように"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q44",
    "section": "E",
    "prompt": "「せんせいの ___、にほんごが じょうずに なりました」",
    "options": [
      {
        "id": "a",
        "text": "せいで"
      },
      {
        "id": "b",
        "text": "おかげで"
      },
      {
        "id": "c",
        "text": "ばかりに"
      },
      {
        "id": "d",
        "text": "くせに"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q45",
    "section": "E",
    "prompt": "「くわしいことが ___、おしらせします」",
    "options": [
      {
        "id": "a",
        "text": "わかり次第"
      },
      {
        "id": "b",
        "text": "わかったとたん"
      },
      {
        "id": "c",
        "text": "わかるうちに"
      },
      {
        "id": "d",
        "text": "わかったばかり"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q46",
    "section": "E",
    "prompt": "「へやに ___とたん、でんわが なった」",
    "options": [
      {
        "id": "a",
        "text": "はいった"
      },
      {
        "id": "b",
        "text": "はいる"
      },
      {
        "id": "c",
        "text": "はいり"
      },
      {
        "id": "d",
        "text": "はいって"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q47",
    "section": "E",
    "prompt": "「いのちの ___、ゆめを あきらめない」",
    "options": [
      {
        "id": "a",
        "text": "ある限り"
      },
      {
        "id": "b",
        "text": "あるばかり"
      },
      {
        "id": "c",
        "text": "あるせいで"
      },
      {
        "id": "d",
        "text": "あるものの"
      }
    ],
    "correct": "a"
  },
  {
    "id": "q48",
    "section": "E",
    "prompt": "「こどものころ、よく このこうえんで あそんだ ___」",
    "options": [
      {
        "id": "a",
        "text": "ことだ"
      },
      {
        "id": "b",
        "text": "ものだ"
      },
      {
        "id": "c",
        "text": "べきだ"
      },
      {
        "id": "d",
        "text": "わけだ"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q49",
    "section": "F",
    "prompt": "Which is the sonkeigo (respectful) form of いる (to be)?",
    "options": [
      {
        "id": "a",
        "text": "おる"
      },
      {
        "id": "b",
        "text": "いらっしゃる"
      },
      {
        "id": "c",
        "text": "まいる"
      },
      {
        "id": "d",
        "text": "ござる"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q50",
    "section": "F",
    "prompt": "Which is the kenjougo (humble) form of する (to do)?",
    "options": [
      {
        "id": "a",
        "text": "なさる"
      },
      {
        "id": "b",
        "text": "いたす"
      },
      {
        "id": "c",
        "text": "くださる"
      },
      {
        "id": "d",
        "text": "あそばす"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q51",
    "section": "F",
    "prompt": "「社長は そう ___」 (The president said so — sonkeigo)",
    "options": [
      {
        "id": "a",
        "text": "もうしました"
      },
      {
        "id": "b",
        "text": "おっしゃいました"
      },
      {
        "id": "c",
        "text": "いたしました"
      },
      {
        "id": "d",
        "text": "いいました"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q52",
    "section": "F",
    "prompt": "「私は 山田と ___」 (I am called Yamada — kenjougo, formal introduction)",
    "options": [
      {
        "id": "a",
        "text": "いいます"
      },
      {
        "id": "b",
        "text": "おっしゃいます"
      },
      {
        "id": "c",
        "text": "もうします"
      },
      {
        "id": "d",
        "text": "なさいます"
      }
    ],
    "correct": "c"
  },
  {
    "id": "q53",
    "section": "F",
    "prompt": "「もう ___か」 (Have you already eaten? — sonkeigo, to a client)",
    "options": [
      {
        "id": "a",
        "text": "たべました"
      },
      {
        "id": "b",
        "text": "めしあがりました"
      },
      {
        "id": "c",
        "text": "いただきました"
      },
      {
        "id": "d",
        "text": "おあがりました"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q54",
    "section": "F",
    "prompt": "「私は もう ___」 (I have already eaten — kenjougo, to a client)",
    "options": [
      {
        "id": "a",
        "text": "めしあがりました"
      },
      {
        "id": "b",
        "text": "たべました"
      },
      {
        "id": "c",
        "text": "いただきました"
      },
      {
        "id": "d",
        "text": "おたべしました"
      }
    ],
    "correct": "c"
  },
  {
    "id": "q55",
    "section": "F",
    "prompt": "Which is WRONG?",
    "options": [
      {
        "id": "a",
        "text": "社長はいらっしゃいますか (asking about the president — sonkeigo)"
      },
      {
        "id": "b",
        "text": "私はまいります (I will go — kenjougo)"
      },
      {
        "id": "c",
        "text": "私はおっしゃいました (I said — using sonkeigo for self)"
      },
      {
        "id": "d",
        "text": "先生がくださいました (the teacher gave to me — sonkeigo)"
      }
    ],
    "correct": "c"
  },
  {
    "id": "q56",
    "section": "F",
    "prompt": "「おきゃくさま、こちらで ___」 (Please wait here — sonkeigo, service staff)",
    "options": [
      {
        "id": "a",
        "text": "おまちしてください"
      },
      {
        "id": "b",
        "text": "おまちになります"
      },
      {
        "id": "c",
        "text": "まってください"
      },
      {
        "id": "d",
        "text": "まちます"
      }
    ],
    "correct": "b"
  },
  {
    "id": "q57",
    "section": "G",
    "prompt": "What time does the writer leave home?",
    "options": [
      {
        "id": "a",
        "text": "7:00"
      },
      {
        "id": "b",
        "text": "7:30"
      },
      {
        "id": "c",
        "text": "8:30"
      },
      {
        "id": "d",
        "text": "9:00"
      }
    ],
    "correct": "c",
    "passage": "わたしは まいにち ７じに おきます。あさごはんを たべてから、はを みがきます。８じはんに うちを でて、でんしゃで かいしゃに いきます。かいしゃは えきの ちかくに あります。しごとは ９じに はじまります。ひるやすみに どうりょうと いっしょに しょくどうで ひるごはんを たべます。しごとは ５じに おわります。うちに かえってから、ばんごはんを つくります。そのあと、テレビを みたり、ほんを よんだり します。１２じごろ ねます。"
  },
  {
    "id": "q58",
    "section": "G",
    "prompt": "Where does the writer eat lunch?",
    "options": [
      {
        "id": "a",
        "text": "At home"
      },
      {
        "id": "b",
        "text": "At the station"
      },
      {
        "id": "c",
        "text": "In the cafeteria"
      },
      {
        "id": "d",
        "text": "At a restaurant"
      }
    ],
    "correct": "c",
    "passage": "わたしは まいにち ７じに おきます。あさごはんを たべてから、はを みがきます。８じはんに うちを でて、でんしゃで かいしゃに いきます。かいしゃは えきの ちかくに あります。しごとは ９じに はじまります。ひるやすみに どうりょうと いっしょに しょくどうで ひるごはんを たべます。しごとは ５じに おわります。うちに かえってから、ばんごはんを つくります。そのあと、テレビを みたり、ほんを よんだり します。１２じごろ ねます。"
  },
  {
    "id": "q59",
    "section": "G",
    "prompt": "What does the writer do after returning home?",
    "options": [
      {
        "id": "a",
        "text": "Watches TV and reads books"
      },
      {
        "id": "b",
        "text": "Goes to sleep immediately"
      },
      {
        "id": "c",
        "text": "Goes out with colleagues"
      },
      {
        "id": "d",
        "text": "Studies Japanese"
      }
    ],
    "correct": "a",
    "passage": "わたしは まいにち ７じに おきます。あさごはんを たべてから、はを みがきます。８じはんに うちを でて、でんしゃで かいしゃに いきます。かいしゃは えきの ちかくに あります。しごとは ９じに はじまります。ひるやすみに どうりょうと いっしょに しょくどうで ひるごはんを たべます。しごとは ５じに おわります。うちに かえってから、ばんごはんを つくります。そのあと、テレビを みたり、ほんを よんだり します。１２じごろ ねます。"
  },
  {
    "id": "q60",
    "section": "G",
    "prompt": "When does the Japanese school year start?",
    "options": [
      {
        "id": "a",
        "text": "September"
      },
      {
        "id": "b",
        "text": "April"
      },
      {
        "id": "c",
        "text": "March"
      },
      {
        "id": "d",
        "text": "January"
      }
    ],
    "correct": "b",
    "passage": "日本の学校は、４月に始まります。多くの国では、新学期は９月に始まりますが、日本では、桜が咲く春に新しい学年が始まります。小学校は６年間、中学校は３年間、高校は３年間です。日本の子どもは、６歳から１５歳まで学校に行かなければなりません。現在、日本の高校進学率は９８パーセント以上で、ほとんどの子どもが高校に行きます。大学に進学する学生も、年々増えています。"
  },
  {
    "id": "q61",
    "section": "G",
    "prompt": "How many years is junior high school?",
    "options": [
      {
        "id": "a",
        "text": "6 years"
      },
      {
        "id": "b",
        "text": "3 years"
      },
      {
        "id": "c",
        "text": "4 years"
      },
      {
        "id": "d",
        "text": "2 years"
      }
    ],
    "correct": "b",
    "passage": "日本の学校は、４月に始まります。多くの国では、新学期は９月に始まりますが、日本では、桜が咲く春に新しい学年が始まります。小学校は６年間、中学校は３年間、高校は３年間です。日本の子どもは、６歳から１５歳まで学校に行かなければなりません。現在、日本の高校進学率は９８パーセント以上で、ほとんどの子どもが高校に行きます。大学に進学する学生も、年々増えています。"
  },
  {
    "id": "q62",
    "section": "G",
    "prompt": "What percentage of students go to high school?",
    "options": [
      {
        "id": "a",
        "text": "About 80%"
      },
      {
        "id": "b",
        "text": "About 90%"
      },
      {
        "id": "c",
        "text": "Over 98%"
      },
      {
        "id": "d",
        "text": "100%"
      }
    ],
    "correct": "c",
    "passage": "日本の学校は、４月に始まります。多くの国では、新学期は９月に始まりますが、日本では、桜が咲く春に新しい学年が始まります。小学校は６年間、中学校は３年間、高校は３年間です。日本の子どもは、６歳から１５歳まで学校に行かなければなりません。現在、日本の高校進学率は９８パーセント以上で、ほとんどの子どもが高校に行きます。大学に進学する学生も、年々増えています。"
  }
];
