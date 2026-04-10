"use client";

import { useEffect, useMemo, useState } from "react";

type ScoreRingProps = {
  score: number;
  size?: number;
  strokeWidth?: number;
};

function getRingColor(score: number): string {
  if (score >= 70) return "#16a34a";
  if (score >= 40) return "#d97706";
  return "#dc2626";
}

export function ScoreRing({ score, size = 92, strokeWidth = 10 }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimatedScore(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const radius = useMemo(() => (size - strokeWidth) / 2, [size, strokeWidth]);
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);
  const dashOffset = useMemo(
    () => circumference * (1 - animatedScore / 100),
    [circumference, animatedScore]
  );
  const color = useMemo(() => getRingColor(clamped), [clamped]);

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-grid",
        placeItems: "center"
      }}
      aria-label={`Trust score ${clamped}`}
      role="img"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>

      <div
        style={{
          position: "absolute",
          textAlign: "center",
          fontWeight: 800,
          fontSize: "1.05rem",
          color: "#111827"
        }}
      >
        {clamped}
      </div>
    </div>
  );
}
