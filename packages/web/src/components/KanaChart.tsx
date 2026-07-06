import { kanaChartRows, type KanaScript } from "../lib/kana";

const COLS = ["a", "i", "u", "e", "o"] as const;

interface Props {
  script: KanaScript;
  /** Browse: tap cells for detail. Select: tap row headers (or cells) to toggle groups. */
  mode?: "browse" | "select";
  onSelect?: (char: string) => void;
  highlight?: string | null;
  enabledGroups?: Set<string>;
  onToggleGroup?: (groupId: string) => void;
}

export function KanaChart({
  script,
  mode = "browse",
  onSelect,
  highlight,
  enabledGroups,
  onToggleGroup,
}: Props) {
  const rows = kanaChartRows(script);
  const selectMode = mode === "select";

  return (
    <div className="kana-chart-wrap">
      <table className="kana-chart" lang="ja">
        <thead>
          <tr>
            <th className="kana-chart-corner" />
            {COLS.map((c) => (
              <th key={c} className="kana-chart-colhead">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowOn = selectMode && (enabledGroups?.has(row.groupId) ?? false);
            return (
              <tr key={row.groupId} className={rowOn ? "on" : undefined}>
                <th className="kana-chart-rowhead">
                  {selectMode ? (
                    <button
                      type="button"
                      className={"kana-chart-row-btn" + (rowOn ? " on" : "")}
                      onClick={() => onToggleGroup?.(row.groupId)}
                      title={`${rowOn ? "Deselect" : "Select"} ${row.head}`}
                      aria-pressed={rowOn}
                    >
                      {row.head}
                    </button>
                  ) : (
                    row.head
                  )}
                </th>
                {row.cells.map((cell, i) => (
                  <td key={i} className="kana-chart-cell">
                    {cell ? (
                      <button
                        type="button"
                        className={
                          "kana-chart-char" +
                          (!selectMode && highlight === cell.char ? " sel" : "") +
                          (rowOn ? " group-on" : "")
                        }
                        onClick={() => {
                          if (selectMode) onToggleGroup?.(row.groupId);
                          else onSelect?.(cell.char);
                        }}
                        title={selectMode ? `${rowOn ? "Deselect" : "Select"} ${row.head}` : cell.romaji}
                        aria-pressed={selectMode ? rowOn : undefined}
                      >
                        {cell.char}
                      </button>
                    ) : (
                      <span className="kana-chart-empty" />
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
