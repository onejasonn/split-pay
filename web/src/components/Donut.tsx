import { PALETTE } from "../config";

/** SVG donut of recipient shares (basis points). */
export function Donut({ shares, size = 180, label }: { shares: number[]; size?: number; label?: string }) {
  const total = shares.reduce((a, b) => a + b, 0) || 1;
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 180 180" width={size} height={size} role="img" aria-label="Share breakdown">
      <circle cx="90" cy="90" r={r} fill="none" stroke="#efe5d6" strokeWidth="26" />
      {shares.map((s, i) => {
        const len = (s / total) * c;
        const el = (
          <circle
            key={i}
            cx="90"
            cy="90"
            r={r}
            fill="none"
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth="26"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 90 90)"
          />
        );
        offset += len;
        return el;
      })}
      {label && (
        <text x="90" y="96" textAnchor="middle" fontFamily="Fraunces" fontSize="22" fontWeight="700" fill="#3d1747">
          {label}
        </text>
      )}
    </svg>
  );
}
