import { levelColor } from "@/lib/api";
import { useEffect, useRef, useState } from "react";

interface TankLevelProps {
  percent: number;
  size?: number;
  showLabel?: boolean;
  animated?: boolean;
}

export function TankLevel({ percent, size = 120, showLabel = true, animated = true }: TankLevelProps) {
  const [displayed, setDisplayed] = useState(animated ? 0 : percent);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animated) { setDisplayed(percent); return; }
    const start = displayed;
    const end = Math.min(100, Math.max(0, percent));
    const duration = 1200;
    const startTime = performance.now();
    function step(now: number) {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayed(start + (end - start) * ease);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [percent]);

  const color = levelColor(displayed);
  const pct = Math.min(100, Math.max(0, displayed));
  const bodyH = 160;
  const bodyY = 20;
  const fillH = (bodyH * pct) / 100;
  const fillY = bodyY + bodyH - fillH;

  return (
    <svg viewBox="0 0 100 220" width={size} height={size * (220 / 100)} style={{ overflow: "visible" }}>
      {/* Tank body */}
      <rect x="10" y={bodyY} width="80" height={bodyH} rx="8" fill="hsl(20 12% 14%)" stroke="hsl(24 10% 22%)" strokeWidth="2" />
      {/* Water fill */}
      <clipPath id={`clip-${Math.round(pct)}`}>
        <rect x="12" y={bodyY + 2} width="76" height={bodyH - 4} rx="6" />
      </clipPath>
      <rect
        x="12"
        y={fillY}
        width="76"
        height={fillH}
        fill={color}
        clipPath={`url(#clip-${Math.round(pct)})`}
        opacity="0.85"
      />
      {/* Shimmer highlight */}
      <rect x="12" y={fillY} width="76" height={Math.min(fillH, 8)} fill="white" opacity="0.08" clipPath={`url(#clip-${Math.round(pct)})`} />
      {/* Gauge lines */}
      {[25, 50, 75].map((mark) => {
        const y = bodyY + bodyH - (bodyH * mark) / 100;
        return (
          <g key={mark}>
            <line x1="10" y1={y} x2="20" y2={y} stroke="hsl(24 10% 30%)" strokeWidth="1" />
            <text x="22" y={y + 4} fontSize="8" fill="hsl(24 8% 45%)">{mark}%</text>
          </g>
        );
      })}
      {/* Percentage text */}
      {showLabel && (
        <text
          x="50"
          y={bodyY + bodyH / 2 + 6}
          textAnchor="middle"
          fontSize="22"
          fontWeight="bold"
          fill="white"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
        >
          {Math.round(pct)}%
        </text>
      )}
      {/* Pipe at bottom */}
      <rect x="42" y={bodyY + bodyH} width="16" height="10" rx="3" fill="hsl(20 12% 14%)" stroke="hsl(24 10% 22%)" strokeWidth="1.5" />
      {/* Cap at top */}
      <rect x="20" y={bodyY - 8} width="60" height="10" rx="4" fill="hsl(20 12% 18%)" stroke="hsl(24 10% 22%)" strokeWidth="1.5" />
    </svg>
  );
}
