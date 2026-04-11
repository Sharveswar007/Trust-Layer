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

type TemporalDiff = {
  from: string;
  to: string;
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
  if (verdict === "correct") return "bg-emerald-500/20 text-emerald-100 border-emerald-400/50";
  if (verdict === "incorrect") return "bg-red-500/20 text-red-100 border-red-400/50";
  return "bg-amber-500/20 text-amber-100 border-amber-400/50";
}

function hasTemporalSignal(value: string): boolean {
  const pattern =
    /\b(19\d{2}|20\d{2}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|today|yesterday|tomorrow|currently|current|latest|recent|updated|since|before|after|during|in\s+\d{4})\b/i;
  return pattern.test(value);
}

function getTemporalDiff(claim: Claim): TemporalDiff | null {
  const claimYears = claim.text.match(/\b(19\d{2}|20\d{2})\b/g) ?? [];
  const correctedYears = claim.corrected.match(/\b(19\d{2}|20\d{2})\b/g) ?? [];

  if (claimYears.length === 0 || correctedYears.length === 0) {
    return null;
  }

  const from = claimYears[0]!;
  const to = correctedYears[0]!;
  if (from === to) {
    return null;
  }

  return { from, to };
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

    const temporal =
      hasTemporalSignal(range.claim.text) ||
      hasTemporalSignal(range.claim.corrected) ||
      hasTemporalSignal(range.claim.explanation) ||
      getTemporalDiff(range.claim) !== null;

    nodes.push(
      <span
        key={`claim-${range.start}-${range.end}`}
        title={tooltip}
        className={`inline rounded-md border px-1 py-px font-medium ${highlightClass(range.claim.verdict)} ${temporal ? "ring-1 ring-sky-400/70" : ""}`}
      >
        {originalText.slice(range.start, range.end)}
      </span>
    );

    cursor = range.end;
  }

  if (cursor < originalText.length) {
    nodes.push(<span key={`plain-${cursor}-end`}>{originalText.slice(cursor)}</span>);
  }

  const incorrectClaims = claims.filter((claim) => claim.verdict === "incorrect");
  const correctClaims = claims.filter((claim) => claim.verdict === "correct");
  const temporalClaims = claims.filter((claim) => {
    if (hasTemporalSignal(claim.text) || hasTemporalSignal(claim.corrected) || hasTemporalSignal(claim.explanation)) {
      return true;
    }

    return getTemporalDiff(claim) !== null;
  });

  return (
    <section className="panel mt-4 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
        <p className="m-0 text-sm font-semibold text-neutral-100">Correct vs Wrong Highlights</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-red-400/50 bg-red-500/20 px-2 py-0.5 text-red-100">Wrong</span>
          <span className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 text-emerald-100">Correct</span>
          <span className="rounded-full border border-sky-400/50 bg-sky-500/20 px-2 py-0.5 text-sky-100">Temporal</span>
        </div>
      </div>

      <p className="m-0 max-h-80 overflow-y-auto whitespace-pre-wrap wrap-break-word leading-7 text-sm text-neutral-300">
        {nodes}
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <article className="rounded-xl border border-red-500/35 bg-red-950/20 p-3">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-red-200">
            Wrong Highlights ({incorrectClaims.length})
          </p>
          {incorrectClaims.length === 0 ? (
            <p className="m-0 mt-2 text-sm text-neutral-300">No incorrect claims detected.</p>
          ) : (
            <div className="mt-2 grid gap-2">
              {incorrectClaims.slice(0, 5).map((claim, idx) => (
                <div key={`${claim.text}-wrong-${idx}`} className="rounded-lg border border-red-500/25 bg-black/20 p-2">
                  <p className="m-0 text-sm font-medium text-red-100">{claim.text}</p>
                  {claim.corrected ? (
                    <p className="m-0 mt-1 text-xs text-neutral-200">
                      Suggested correction: <span className="text-emerald-200">{claim.corrected}</span>
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-3">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-200">
            Correct Highlights ({correctClaims.length})
          </p>
          {correctClaims.length === 0 ? (
            <p className="m-0 mt-2 text-sm text-neutral-300">No correct claims detected yet.</p>
          ) : (
            <div className="mt-2 grid gap-2">
              {correctClaims.slice(0, 5).map((claim, idx) => (
                <div key={`${claim.text}-correct-${idx}`} className="rounded-lg border border-emerald-500/25 bg-black/20 p-2">
                  <p className="m-0 text-sm font-medium text-emerald-100">{claim.text}</p>
                  <p className="m-0 mt-1 text-xs text-neutral-200">Confidence: {claim.confidence ?? 0}%</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <article className="mt-3 rounded-xl border border-sky-500/35 bg-sky-950/20 p-3">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-sky-200">
          Temporal Disambiguation ({temporalClaims.length})
        </p>
        {temporalClaims.length === 0 ? (
          <p className="m-0 mt-2 text-sm text-neutral-300">No time-sensitive claims detected.</p>
        ) : (
          <div className="mt-2 grid gap-2">
            {temporalClaims.slice(0, 6).map((claim, idx) => {
              const diff = getTemporalDiff(claim);

              return (
                <div key={`${claim.text}-temporal-${idx}`} className="rounded-lg border border-sky-500/25 bg-black/20 p-2">
                  <p className="m-0 text-sm font-medium text-sky-100">{claim.text}</p>
                  {diff ? (
                    <p className="m-0 mt-1 text-xs text-neutral-200">
                      Time correction: <span className="text-red-200">{diff.from}</span> to <span className="text-emerald-200">{diff.to}</span>
                    </p>
                  ) : null}
                  <p className="m-0 mt-1 text-xs text-neutral-300">
                    {claim.explanation || "Detected as time-sensitive based on temporal language."}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}

