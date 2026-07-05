import { useState, useEffect, useRef, useMemo } from "react";

/*
  IMMERSION PLAYER — prototype
  ----------------------------------------------------------------
  Architecture notes (mirrors the real app):

  1. SUBTITLE DATA arrives PRE-TOKENIZED from your backend.
     Your server pipeline: fetch .srt/.ass from Jimaku → parse →
     tokenize with MeCab/Kuromoji → attach JMdict glosses + readings
     → serve JSON like the SAMPLE_EPISODE object below.
     The client never tokenizes. It just renders.

  2. THE PLAYER IS SWAPPABLE. This demo uses a mock clock.
     In production, replace MockPlayer with the YouTube IFrame API:

       // index.html: <script src="https://www.youtube.com/iframe_api"></script>
       const player = new YT.Player("yt-mount", {
         videoId: "VIDEO_ID",            // e.g. a Muse Asia upload
         events: { onReady, onStateChange }
       });
       // then poll ~4x/sec:
       setInterval(() => setCurrentTime(player.getCurrentTime()), 250);

     Everything below the player (subtitle sync, lookup, deck)
     consumes only `currentTime` — it doesn't care where video
     comes from. Same code works for a <video> tag or a browser
     extension overlaying Netflix.

  3. WORD KNOWLEDGE is a map keyed by dictionary form.
     In production this lives in Postgres + FSRS scheduling.
*/

// ---------- Sample data (original dialogue, written for this demo) ----------
// Shape = exactly what your backend would return for one episode.

const SAMPLE_EPISODE = {
  title: "駅で",
  titleEn: "At the Station",
  duration: 35,
  lines: [
    {
      id: "L1", start: 0.5, end: 4.0, en: "Ah — the train's here.",
      tokens: [
        { s: "あ", r: null, dict: "あ", gloss: "ah; oh (interjection)", pos: "interj" },
        { s: "、", punct: true },
        { s: "電車", r: "でんしゃ", dict: "電車", gloss: "train (electric)", pos: "noun" },
        { s: "が", r: null, dict: "が", gloss: "subject marker", pos: "particle" },
        { s: "来た", r: "きた", dict: "来る", gloss: "to come (past: came)", pos: "verb" },
        { s: "。", punct: true },
      ],
    },
    {
      id: "L2", start: 4.5, end: 7.5, en: "Hurry up! We'll be late!",
      tokens: [
        { s: "急いで", r: "いそいで", dict: "急ぐ", gloss: "to hurry (te-form: hurry up!)", pos: "verb" },
        { s: "!", punct: true },
        { s: "遅れる", r: "おくれる", dict: "遅れる", gloss: "to be late", pos: "verb" },
        { s: "よ", r: null, dict: "よ", gloss: "emphasis particle", pos: "particle" },
        { s: "!", punct: true },
      ],
    },
    {
      id: "L3", start: 8.0, end: 11.5, en: "Wait a sec. I forgot my ticket.",
      tokens: [
        { s: "ちょっと", r: null, dict: "ちょっと", gloss: "a little; a moment", pos: "adv" },
        { s: "待って", r: "まって", dict: "待つ", gloss: "to wait (te-form: wait!)", pos: "verb" },
        { s: "。", punct: true },
        { s: "切符", r: "きっぷ", dict: "切符", gloss: "ticket", pos: "noun" },
        { s: "を", r: null, dict: "を", gloss: "object marker", pos: "particle" },
        { s: "忘れた", r: "わすれた", dict: "忘れる", gloss: "to forget (past: forgot)", pos: "verb" },
        { s: "。", punct: true },
      ],
    },
    {
      id: "L4", start: 12.0, end: 15.0, en: "Huh? Seriously?",
      tokens: [
        { s: "ええ", r: null, dict: "ええ", gloss: "eh?; huh? (surprise)", pos: "interj" },
        { s: "?", punct: true },
        { s: "本当", r: "ほんとう", dict: "本当", gloss: "truth; really", pos: "noun" },
        { s: "に", r: null, dict: "に", gloss: "adverbializing particle", pos: "particle" },
        { s: "?", punct: true },
      ],
    },
    {
      id: "L5", start: 15.5, end: 19.5, en: "It's fine — there's still time.",
      tokens: [
        { s: "大丈夫", r: "だいじょうぶ", dict: "大丈夫", gloss: "okay; all right", pos: "adj-na" },
        { s: "、", punct: true },
        { s: "まだ", r: null, dict: "まだ", gloss: "still; not yet", pos: "adv" },
        { s: "時間", r: "じかん", dict: "時間", gloss: "time", pos: "noun" },
        { s: "が", r: null, dict: "が", gloss: "subject marker", pos: "particle" },
        { s: "ある", r: null, dict: "ある", gloss: "to exist; there is", pos: "verb" },
        { s: "。", punct: true },
      ],
    },
    {
      id: "L6", start: 20.0, end: 24.0, en: "The next train is in ten minutes.",
      tokens: [
        { s: "次", r: "つぎ", dict: "次", gloss: "next", pos: "noun" },
        { s: "の", r: null, dict: "の", gloss: "possessive / linking particle", pos: "particle" },
        { s: "電車", r: "でんしゃ", dict: "電車", gloss: "train (electric)", pos: "noun" },
        { s: "は", r: null, dict: "は", gloss: "topic marker", pos: "particle" },
        { s: "十分後", r: "じゅっぷんご", dict: "十分後", gloss: "ten minutes later", pos: "noun" },
        { s: "だ", r: null, dict: "だ", gloss: "copula (is)", pos: "copula" },
        { s: "よ", r: null, dict: "よ", gloss: "emphasis particle", pos: "particle" },
        { s: "。", punct: true },
      ],
    },
    {
      id: "L7", start: 24.5, end: 28.5, en: "Then let's grab a coffee.",
      tokens: [
        { s: "じゃあ", r: null, dict: "じゃあ", gloss: "well then", pos: "conj" },
        { s: "、", punct: true },
        { s: "コーヒー", r: null, dict: "コーヒー", gloss: "coffee", pos: "noun" },
        { s: "を", r: null, dict: "を", gloss: "object marker", pos: "particle" },
        { s: "買おう", r: "かおう", dict: "買う", gloss: "to buy (volitional: let's buy)", pos: "verb" },
        { s: "。", punct: true },
      ],
    },
    {
      id: "L8", start: 29.0, end: 33.5, en: "Nice — I want one too.",
      tokens: [
        { s: "いい", r: null, dict: "いい", gloss: "good; nice", pos: "adj-i" },
        { s: "ね", r: null, dict: "ね", gloss: "agreement particle (right?)", pos: "particle" },
        { s: "。", punct: true },
        { s: "私", r: "わたし", dict: "私", gloss: "I; me", pos: "pronoun" },
        { s: "も", r: null, dict: "も", gloss: "also; too", pos: "particle" },
        { s: "飲みたい", r: "のみたい", dict: "飲む", gloss: "to drink (tai-form: want to drink)", pos: "verb" },
        { s: "。", punct: true },
      ],
    },
  ],
};

const fmt = (t) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

// ---------- Main app ----------

export default function ImmersionPlayer() {
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(null); // token being looked up
  const [furigana, setFurigana] = useState(true);
  const [showEn, setShowEn] = useState(false);
  // knowledge: { [dictForm]: { status: 'learning'|'known', reading, gloss, context } }
  const [knowledge, setKnowledge] = useState({});
  const [reviewing, setReviewing] = useState(false);
  const raf = useRef(null);

  // Mock playback clock — replace with player.getCurrentTime() polling in prod
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setCurrentTime((t) => {
        const next = t + dt;
        if (next >= SAMPLE_EPISODE.duration) {
          setPlaying(false);
          return SAMPLE_EPISODE.duration;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const activeLine = useMemo(
    () => SAMPLE_EPISODE.lines.find((l) => currentTime >= l.start && currentTime <= l.end) || null,
    [currentTime]
  );

  const deck = Object.entries(knowledge).map(([dict, v]) => ({ dict, ...v }));
  const dueCards = deck.filter((c) => c.status === "learning");

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setCurrentTime(frac * SAMPLE_EPISODE.duration);
  };

  const jumpToLine = (line) => {
    setCurrentTime(line.start + 0.01);
    setSelected(null);
  };

  const addToDeck = (tok, line) => {
    setKnowledge((k) => ({
      ...k,
      [tok.dict]: {
        status: "learning",
        reading: tok.r || tok.s,
        gloss: tok.gloss,
        surface: tok.s,
        context: line.tokens.map((t) => t.s).join(""),
        contextEn: line.en,
      },
    }));
  };

  const statusOf = (tok) => (tok.punct ? null : knowledge[tok.dict]?.status || null);

  return (
    <div className="ip-root">
      <style>{css}</style>

      {/* ---------- Header ---------- */}
      <header className="ip-header">
        <div>
          <div className="ip-eyebrow">Immersion player · prototype</div>
          <h1 className="ip-title">
            {SAMPLE_EPISODE.title} <span className="ip-title-en">{SAMPLE_EPISODE.titleEn}</span>
          </h1>
        </div>
        <div className="ip-header-stats">
          <span className="chip chip-amber">{dueCards.length} to review</span>
          <span className="chip">{deck.filter((c) => c.status === "known").length} known</span>
        </div>
      </header>

      {/* ---------- Player (mock — YouTube IFrame mounts here in prod) ---------- */}
      <div className="ip-player" onClick={() => setPlaying((p) => !p)}>
        <div className="ip-scene">
          <div className={"ip-scene-glow" + (playing ? " on" : "")} />
          <div className="ip-scene-label">EP 01 · {fmt(currentTime)} / {fmt(SAMPLE_EPISODE.duration)}</div>
          <div className="ip-scene-center">
            <button
              className="ip-playbtn"
              onClick={(e) => { e.stopPropagation(); setPlaying((p) => !p); }}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <div className="ip-scene-hint">
              {playing ? "" : "mock player — swap in the YouTube IFrame API here"}
            </div>
          </div>
        </div>
        <div className="ip-progress" onClick={(e) => { e.stopPropagation(); seek(e); }}>
          <div className="ip-progress-fill" style={{ width: `${(currentTime / SAMPLE_EPISODE.duration) * 100}%` }} />
          {SAMPLE_EPISODE.lines.map((l) => (
            <div key={l.id} className="ip-progress-tick" style={{ left: `${(l.start / SAMPLE_EPISODE.duration) * 100}%` }} />
          ))}
        </div>
      </div>

      {/* ---------- Active subtitle (the product) ---------- */}
      <section className="ip-subtitle-zone">
        {activeLine ? (
          <SubtitleLine
            line={activeLine}
            furigana={furigana}
            selected={selected}
            statusOf={statusOf}
            onTap={(tok) => !tok.punct && setSelected({ tok, line: activeLine })}
          />
        ) : (
          <div className="ip-sub-empty">{playing ? "…" : "Press play — subtitles sync to the clock"}</div>
        )}
        <div className="ip-sub-tools">
          <button className={"tool" + (furigana ? " on" : "")} onClick={() => setFurigana((f) => !f)}>
            ふりがな
          </button>
          <button className={"tool" + (showEn ? " on" : "")} onClick={() => setShowEn((s) => !s)}>
            EN
          </button>
        </div>
        {showEn && activeLine && <div className="ip-sub-en">{activeLine.en}</div>}
      </section>

      {/* ---------- Dictionary card ---------- */}
      {selected && (
        <section className="ip-dict">
          <div className="ip-dict-head">
            <span className="ip-dict-word">{selected.tok.dict}</span>
            {selected.tok.r && <span className="ip-dict-reading">【{selected.tok.r}】</span>}
            <span className="ip-dict-pos">{selected.tok.pos}</span>
            <button className="ip-dict-close" onClick={() => setSelected(null)}>✕</button>
          </div>
          <div className="ip-dict-gloss">{selected.tok.gloss}</div>
          <div className="ip-dict-context">「{selected.line.tokens.map((t) => t.s).join("")}」</div>
          <div className="ip-dict-actions">
            {knowledge[selected.tok.dict] ? (
              <span className="chip chip-amber">in your deck · {knowledge[selected.tok.dict].status}</span>
            ) : (
              <button className="btn-primary" onClick={() => { addToDeck(selected.tok, selected.line); }}>
                + Add to deck
              </button>
            )}
          </div>
        </section>
      )}

      {/* ---------- Transcript ---------- */}
      <section className="ip-transcript">
        <div className="ip-section-label">Transcript · tap a line to jump</div>
        {SAMPLE_EPISODE.lines.map((l) => (
          <button
            key={l.id}
            className={"ip-tr-line" + (activeLine?.id === l.id ? " active" : "")}
            onClick={() => jumpToLine(l)}
          >
            <span className="ip-tr-time">{fmt(l.start)}</span>
            <span className="ip-tr-text">{l.tokens.map((t) => t.s).join("")}</span>
          </button>
        ))}
      </section>

      {/* ---------- Deck ---------- */}
      <section className="ip-deck">
        <div className="ip-deck-head">
          <div className="ip-section-label">Your deck — words mined from this episode</div>
          {dueCards.length > 0 && (
            <button className="btn-primary" onClick={() => setReviewing(true)}>
              Review {dueCards.length}
            </button>
          )}
        </div>
        {deck.length === 0 ? (
          <div className="ip-deck-empty">
            Tap any word in a subtitle, then "Add to deck". In production this feeds an FSRS
            scheduler and each card keeps a link back to its clip.
          </div>
        ) : (
          <div className="ip-deck-grid">
            {deck.map((c) => (
              <div key={c.dict} className={"ip-card" + (c.status === "known" ? " known" : "")}>
                <div className="ip-card-word">{c.dict}</div>
                <div className="ip-card-reading">{c.reading}</div>
                <div className="ip-card-gloss">{c.gloss}</div>
                <div className={"ip-card-status " + c.status}>{c.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {reviewing && (
        <ReviewModal
          cards={dueCards}
          onGrade={(dict, good) =>
            setKnowledge((k) => ({ ...k, [dict]: { ...k[dict], status: good ? "known" : "learning" } }))
          }
          onClose={() => setReviewing(false)}
        />
      )}
    </div>
  );
}

// ---------- Subtitle renderer ----------

function SubtitleLine({ line, furigana, statusOf, onTap, selected }) {
  return (
    <div className="ip-subline" lang="ja">
      {line.tokens.map((tok, i) => {
        if (tok.punct) return <span key={i} className="ip-tok-punct">{tok.s}</span>;
        const st = statusOf(tok);
        const isSel = selected?.tok === tok;
        return (
          <button
            key={i}
            className={
              "ip-tok" +
              (st === "learning" ? " learning" : st === "known" ? " known" : "") +
              (isSel ? " sel" : "")
            }
            onClick={() => onTap(tok)}
          >
            {furigana && tok.r ? (
              <ruby>{tok.s}<rt>{tok.r}</rt></ruby>
            ) : (
              tok.s
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Review modal (SRS loop, simplified) ----------

function ReviewModal({ cards, onGrade, onClose }) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = cards[idx];

  if (!card) {
    return (
      <div className="ip-modal-backdrop" onClick={onClose}>
        <div className="ip-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ip-modal-done">Review complete 🎉</div>
          <button className="btn-primary" onClick={onClose}>Back to watching</button>
        </div>
      </div>
    );
  }

  const grade = (good) => {
    onGrade(card.dict, good);
    setRevealed(false);
    setIdx((i) => i + 1);
  };

  return (
    <div className="ip-modal-backdrop" onClick={onClose}>
      <div className="ip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ip-modal-count">{idx + 1} / {cards.length}</div>
        <div className="ip-modal-context" lang="ja">{card.context.replace(card.surface, "＿＿")}</div>
        <div className="ip-modal-word" lang="ja">{card.surface}</div>
        {revealed ? (
          <>
            <div className="ip-modal-reading">{card.reading}</div>
            <div className="ip-modal-gloss">{card.gloss}</div>
            <div className="ip-modal-en">"{card.contextEn}"</div>
            <div className="ip-modal-actions">
              <button className="btn-again" onClick={() => grade(false)}>Again</button>
              <button className="btn-primary" onClick={() => grade(true)}>Good</button>
            </div>
          </>
        ) : (
          <button className="btn-primary" onClick={() => setRevealed(true)}>Show answer</button>
        )}
        <div className="ip-modal-note">
          In production, "Again/Good" feeds FSRS scheduling and the card replays the clip audio.
        </div>
      </div>
    </div>
  );
}

// ---------- Styles ----------

const css = `
  .ip-root {
    --bg: #10141d;
    --panel: #171c28;
    --panel2: #1d2432;
    --line: #2a3245;
    --text: #ece6d9;
    --muted: #8b93a7;
    --amber: #e3a53f;
    --amber-dim: rgba(227,165,63,0.16);
    --known: #7bb383;
    --blue: #8fb2dd;
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, "Hiragino Sans", "Yu Gothic", "Segoe UI", sans-serif;
    max-width: 720px;
    margin: 0 auto;
    padding: 20px 16px 60px;
    box-sizing: border-box;
  }
  .ip-root * { box-sizing: border-box; }
  .ip-root button { font-family: inherit; cursor: pointer; }

  .ip-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .ip-eyebrow { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .ip-title { font-size: 26px; margin: 0; font-weight: 700; font-family: "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif; }
  .ip-title-en { font-size: 14px; color: var(--muted); font-weight: 400; margin-left: 8px; font-family: inherit; }
  .ip-header-stats { display: flex; gap: 8px; }

  .chip { font-size: 12px; padding: 4px 10px; border-radius: 999px; background: var(--panel2); color: var(--muted); border: 1px solid var(--line); }
  .chip-amber { color: var(--amber); border-color: rgba(227,165,63,0.4); background: var(--amber-dim); }

  .ip-player { border-radius: 14px; overflow: hidden; border: 1px solid var(--line); background: var(--panel); }
  .ip-scene { position: relative; aspect-ratio: 16/9; background: linear-gradient(160deg, #141a29 0%, #0d1119 60%, #131826 100%); display: flex; align-items: center; justify-content: center; }
  .ip-scene-glow { position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 70%, rgba(227,165,63,0.10), transparent 55%), radial-gradient(ellipse at 75% 25%, rgba(143,178,221,0.10), transparent 50%); opacity: 0.4; transition: opacity 0.8s; }
  .ip-scene-glow.on { opacity: 1; }
  .ip-scene-label { position: absolute; top: 10px; left: 14px; font-size: 12px; color: var(--muted); letter-spacing: 0.06em; }
  .ip-scene-center { position: relative; text-align: center; }
  .ip-playbtn { width: 64px; height: 64px; border-radius: 50%; border: 1px solid var(--line); background: rgba(23,28,40,0.85); color: var(--text); font-size: 20px; transition: transform 0.15s, border-color 0.15s; }
  .ip-playbtn:hover { transform: scale(1.06); border-color: var(--amber); }
  .ip-scene-hint { margin-top: 12px; font-size: 12px; color: var(--muted); }
  .ip-progress { position: relative; height: 22px; background: var(--panel2); cursor: pointer; }
  .ip-progress-fill { position: absolute; top: 0; left: 0; bottom: 0; background: linear-gradient(90deg, rgba(227,165,63,0.5), var(--amber)); }
  .ip-progress-tick { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(236,230,217,0.22); }

  .ip-subtitle-zone { margin-top: 18px; min-height: 120px; position: relative; text-align: center; padding: 8px 8px 0; }
  .ip-subline { font-size: 30px; line-height: 2.1; }
  .ip-sub-empty { color: var(--muted); font-size: 15px; padding: 34px 0; }
  .ip-tok { background: none; border: none; color: var(--text); font-size: inherit; padding: 2px 1px; border-bottom: 2px dotted rgba(139,147,167,0.45); transition: background 0.12s, border-color 0.12s; border-radius: 4px 4px 0 0; }
  .ip-tok:hover { background: rgba(143,178,221,0.12); }
  .ip-tok.sel { background: rgba(143,178,221,0.18); border-bottom-color: var(--blue); }
  .ip-tok.learning { border-bottom: 2px solid var(--amber); background: var(--amber-dim); }
  .ip-tok.known { border-bottom: 2px solid rgba(123,179,131,0.55); }
  .ip-tok-punct { color: var(--muted); font-size: inherit; }
  .ip-tok ruby rt { font-size: 11px; color: var(--blue); font-weight: 400; }
  .ip-sub-tools { position: absolute; right: 4px; top: -6px; display: flex; gap: 6px; }
  .tool { font-size: 11px; padding: 4px 9px; border-radius: 6px; border: 1px solid var(--line); background: var(--panel); color: var(--muted); }
  .tool.on { color: var(--amber); border-color: rgba(227,165,63,0.5); }
  .ip-sub-en { color: var(--muted); font-size: 15px; margin-top: 2px; }

  .ip-dict { margin-top: 14px; background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--amber); border-radius: 12px; padding: 14px 16px; }
  .ip-dict-head { display: flex; align-items: baseline; gap: 8px; }
  .ip-dict-word { font-size: 24px; font-weight: 700; }
  .ip-dict-reading { color: var(--blue); font-size: 15px; }
  .ip-dict-pos { font-size: 11px; color: var(--muted); border: 1px solid var(--line); padding: 1px 7px; border-radius: 999px; }
  .ip-dict-close { margin-left: auto; background: none; border: none; color: var(--muted); font-size: 14px; }
  .ip-dict-gloss { margin-top: 6px; font-size: 15px; }
  .ip-dict-context { margin-top: 6px; color: var(--muted); font-size: 14px; }
  .ip-dict-actions { margin-top: 10px; }

  .btn-primary { background: var(--amber); color: #1a1408; border: none; font-weight: 600; font-size: 14px; padding: 8px 16px; border-radius: 8px; }
  .btn-primary:hover { filter: brightness(1.08); }
  .btn-again { background: var(--panel2); color: var(--text); border: 1px solid var(--line); font-size: 14px; padding: 8px 16px; border-radius: 8px; }

  .ip-section-label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  .ip-transcript { margin-top: 26px; }
  .ip-tr-line { display: flex; gap: 12px; width: 100%; text-align: left; background: none; border: none; border-left: 2px solid transparent; color: var(--text); padding: 7px 10px; border-radius: 0 8px 8px 0; font-size: 15px; }
  .ip-tr-line:hover { background: var(--panel); }
  .ip-tr-line.active { background: var(--panel); border-left-color: var(--amber); }
  .ip-tr-time { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 13px; width: 38px; flex: none; padding-top: 1px; }

  .ip-deck { margin-top: 26px; }
  .ip-deck-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .ip-deck-empty { color: var(--muted); font-size: 14px; background: var(--panel); border: 1px dashed var(--line); border-radius: 12px; padding: 18px; line-height: 1.5; }
  .ip-deck-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 4px; }
  .ip-card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
  .ip-card.known { border-color: rgba(123,179,131,0.4); }
  .ip-card-word { font-size: 20px; font-weight: 700; }
  .ip-card-reading { color: var(--blue); font-size: 13px; margin-top: 2px; }
  .ip-card-gloss { color: var(--muted); font-size: 13px; margin-top: 4px; line-height: 1.4; }
  .ip-card-status { font-size: 11px; margin-top: 8px; letter-spacing: 0.08em; text-transform: uppercase; }
  .ip-card-status.learning { color: var(--amber); }
  .ip-card-status.known { color: var(--known); }

  .ip-modal-backdrop { position: fixed; inset: 0; background: rgba(8,10,16,0.78); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; }
  .ip-modal { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 26px 24px; width: 100%; max-width: 420px; text-align: center; }
  .ip-modal-count { font-size: 12px; color: var(--muted); margin-bottom: 14px; }
  .ip-modal-context { font-size: 17px; color: var(--muted); margin-bottom: 10px; }
  .ip-modal-word { font-size: 40px; font-weight: 700; margin-bottom: 14px; }
  .ip-modal-reading { color: var(--blue); font-size: 17px; }
  .ip-modal-gloss { font-size: 16px; margin-top: 6px; }
  .ip-modal-en { color: var(--muted); font-size: 14px; margin-top: 8px; font-style: italic; }
  .ip-modal-actions { display: flex; gap: 10px; justify-content: center; margin-top: 18px; }
  .ip-modal-note { margin-top: 18px; font-size: 12px; color: var(--muted); line-height: 1.5; }
  .ip-modal-done { font-size: 20px; margin-bottom: 18px; }

  @media (max-width: 480px) {
    .ip-subline { font-size: 24px; }
    .ip-title { font-size: 21px; }
  }
`;
