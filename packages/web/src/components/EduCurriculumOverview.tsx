/** Curriculum index overview (00_index.md). */
import { marked } from "marked";
import { useEffect, useState } from "react";
import { navigate } from "../App";
import { SiteNav } from "./SiteNav";

marked.setOptions({ gfm: true, breaks: true });

export function EduCurriculumOverview() {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/curriculum/00_index.md");
        if (!res.ok) throw new Error(`Failed to load overview (${res.status})`);
        const md = await res.text();
        if (!cancelled) setHtml(marked.parse(md) as string);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="ip-root ip-lesson-page">
      <SiteNav active="curriculum" />
      <header className="ip-lesson-header">
        <button type="button" className="ip-back" onClick={() => navigate("/curriculum")}>
          ← Curriculum
        </button>
        <h1 className="ip-lesson-title">Curriculum overview</h1>
        <p className="ip-lesson-subtitle">Genki I &amp; II + Tobira pathway</p>
      </header>
      {error && <div className="ip-error">{error}</div>}
      {!html && !error && <div className="ip-loading">Loading overview…</div>}
      {html && (
        <article className="ip-lesson-body" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}
