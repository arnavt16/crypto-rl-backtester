import type { TradeLogEntry } from "../types";

interface Props {
  trades: TradeLogEntry[];
}

function positionLabel(p: number): string {
  if (p > 0) return "Long";
  if (p < 0) return "Short";
  return "Flat";
}

export function TradeLogTable({ trades }: Props) {
  return (
    <div className="card-surface rounded-lg">
      <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Trade Log
        </h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {trades.length} position changes
        </span>
      </div>
      <div className="max-h-80 overflow-y-auto overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead
            className="sticky top-0"
            style={{ background: "var(--surface-1)", color: "var(--text-muted)" }}
          >
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">From</th>
              <th className="px-4 py-2 font-medium">To</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 text-right font-medium">Step P&amp;L</th>
              <th className="px-4 py-2 text-right font-medium">Friction</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center" colSpan={6} style={{ color: "var(--text-muted)" }}>
                  No trades yet.
                </td>
              </tr>
            )}
            {trades.map((t, i) => (
              <tr
                key={`${t.date}-${i}`}
                className="border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="px-4 py-1.5" style={{ color: "var(--text-secondary)" }}>
                  {t.date}
                </td>
                <td className="px-4 py-1.5" style={{ color: "var(--text-secondary)" }}>
                  {positionLabel(t.from_position)}
                </td>
                <td className="px-4 py-1.5" style={{ color: "var(--text-primary)" }}>
                  {positionLabel(t.to_position)}
                </td>
                <td
                  className="tabular-nums px-4 py-1.5 text-right"
                  style={{ color: "var(--text-secondary)" }}
                >
                  ${t.price.toFixed(2)}
                </td>
                <td
                  className="tabular-nums px-4 py-1.5 text-right"
                  style={{ color: t.pnl_step >= 0 ? "var(--status-good)" : "var(--status-critical)" }}
                >
                  {(t.pnl_step * 100).toFixed(2)}%
                </td>
                <td
                  className="tabular-nums px-4 py-1.5 text-right"
                  style={{ color: "var(--text-muted)" }}
                >
                  {(t.friction * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
