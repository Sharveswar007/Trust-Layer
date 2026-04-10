import type { Claim } from "@/lib/types";

type HighlightedTextProps = {
  originalText: string;
  claims: Claim[];
};

type Match = {
  start: number;
  end: number;
  claim: Claim;
};

function overlaps(start: number, end: number, ranges: Match[]): boolean {
  return ranges.some((range) => start < range.end && end > range.start);
}

function findNonOverlappingMatch(text: string, term: string, ranges: Match[]): number {
  const source = text.toLowerCase();
  const needle = term.toLowerCase().trim();
  if (!needle) return -1;

  let fromIndex = 0;
  while (fromIndex < source.length) {
    const idx = source.indexOf(needle, fromIndex);
    if (idx === -1) return -1;

    const end = idx + needle.length;
    if (!overlaps(idx, end, ranges)) {
      return idx;
    }

    fromIndex = idx + 1;
  }

  return -1;
}

function highlightColor(verdict: Claim["verdict"]): string {
  if (verdict === "correct") return "#166534";
  if (verdict === "incorrect") return "#b91c1c";
  return "#92400e";
}

function highlightBackground(verdict: Claim["verdict"]): string {
  if (verdict === "correct") return "#dcfce7";
  if (verdict === "incorrect") return "#fee2e2";
  return "#fef3c7";
}

export function HighlightedText({ originalText, claims }: HighlightedTextProps) {
  if (!originalText.trim()) {
    return null;
  }

  const ranges: Match[] = [];
  for (const claim of claims) {
    const index = findNonOverlappingMatch(originalText, claim.text, ranges);
    if (index === -1) continue;

    ranges.push({
      start: index,
      end: index + claim.text.length,
      claim
    });
  }

  ranges.sort((a, b) => a.start - b.start);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (cursor < range.start) {
      nodes.push(
        <span key={`plain-${cursor}-${range.start}`}>{originalText.slice(cursor, range.start)}</span>
      );
    }

    const tooltip =
      range.claim.verdict === "incorrect" && range.claim.corrected
        ? `Correction: ${range.claim.corrected}`
        : `Verdict: ${range.claim.verdict}`;

    nodes.push(
      <span
        key={`claim-${range.start}-${range.end}`}
        title={tooltip}
        style={{
          color: highlightColor(range.claim.verdict),
          background: highlightBackground(range.claim.verdict),
          borderRadius: "6px",
          padding: "0.08rem 0.2rem",
          fontWeight: 600,
          cursor: "help",
          transition: "filter 180ms ease"
        }}
      >
        {originalText.slice(range.start, range.end)}
      </span>
    );

    cursor = range.end;
  }

  if (cursor < originalText.length) {
    nodes.push(<span key={`plain-${cursor}-end`}>{originalText.slice(cursor)}</span>);
  }

  return (
    <section
      style={{
        marginTop: "1rem",
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        borderRadius: "14px",
        padding: "0.85rem 0.95rem"
      }}
    >
      <p style={{ margin: "0 0 0.55rem", fontWeight: 700, color: "#0f172a" }}>Inline Claim Diff</p>
      <p style={{ margin: 0, color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{nodes}</p>
    </section>
  );
}
