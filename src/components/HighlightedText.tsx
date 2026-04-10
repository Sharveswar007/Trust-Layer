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

function highlightClass(verdict: Claim["verdict"]): string {
  if (verdict === "correct") return "bg-neutral-700/60 text-white border-neutral-500";
  if (verdict === "incorrect") return "bg-neutral-800 text-white border-neutral-600";
  return "bg-neutral-900 text-neutral-100 border-neutral-700";
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
        className={`inline rounded-md border px-1 py-[1px] font-medium ${highlightClass(range.claim.verdict)}`}
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
    <section className="panel mt-4 p-4">
      <p className="m-0 mb-2 text-sm font-semibold text-neutral-100">Inline Claim Diff</p>
      <p className="m-0 max-h-[420px] overflow-y-auto whitespace-pre-wrap break-words leading-7 text-sm text-neutral-300">{nodes}</p>
    </section>
  );
}

