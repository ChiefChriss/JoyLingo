import { navigate } from "../App";

interface Props {
  /** Highlight the active section in the nav. */
  active?: "home" | "curriculum" | "kana" | "kanji";
}

export function SiteNav({ active = "home" }: Props) {
  return (
    <nav className="ip-nav" aria-label="Main">
      <button type="button" className="ip-nav-brand" onClick={() => navigate("/")}>
        <span className="ip-nav-logo" aria-hidden>語</span>
        <span className="ip-nav-name">JoyLingo</span>
      </button>
      <div className="ip-nav-links">
        <button
          type="button"
          className={"ip-nav-link" + (active === "home" ? " on" : "")}
          onClick={() => navigate("/")}
        >
          Home
        </button>
        <button
          type="button"
          className={"ip-nav-link" + (active === "curriculum" ? " on" : "")}
          onClick={() => navigate("/curriculum")}
        >
          Curriculum
        </button>
        <button
          type="button"
          className={"ip-nav-link" + (active === "kana" ? " on" : "")}
          onClick={() => navigate("/learn/kana")}
        >
          Kana
        </button>
        <button
          type="button"
          className={"ip-nav-link" + (active === "kanji" ? " on" : "")}
          onClick={() => navigate("/kanji")}
        >
          Kanji
        </button>
      </div>
    </nav>
  );
}
