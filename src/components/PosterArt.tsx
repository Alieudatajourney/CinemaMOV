"use client";
import { useId, type ReactElement } from "react";
import type { MovieArt } from "@/lib/types";

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function wrapTitle(title: string, max: number): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

function Motif({ art, w, h, uid }: { art: MovieArt; w: number; h: number; uid: string }) {
  const r = rng(art.hueA * 31 + art.hueB * 7 + art.motif.length);
  const light = `hsl(${art.hueA} 80% 72%)`;
  const soft = `hsl(${art.hueB} 70% 65%)`;
  const cx = w / 2;
  const cy = h * 0.42;
  const els: ReactElement[] = [];
  switch (art.motif) {
    case "orbit":
      for (let i = 0; i < 5; i++)
        els.push(<ellipse key={i} cx={cx} cy={cy} rx={w * (0.18 + i * 0.1)} ry={w * (0.06 + i * 0.035)} fill="none" stroke={light} strokeOpacity={0.5 - i * 0.07} strokeWidth={1.4} transform={`rotate(-18 ${cx} ${cy})`} />);
      els.push(<circle key="p" cx={cx} cy={cy} r={w * 0.12} fill={`url(#${uid}-orb)`} />);
      els.push(<circle key="m" cx={cx + w * 0.34} cy={cy - w * 0.1} r={w * 0.025} fill={soft} />);
      break;
    case "waves":
      for (let i = 0; i < 9; i++) {
        const y = h * 0.34 + i * h * 0.045;
        const a = 10 + i * 2;
        els.push(<path key={i} d={`M0 ${y} C ${w * 0.25} ${y - a}, ${w * 0.5} ${y + a}, ${w * 0.75} ${y - a / 2} S ${w} ${y}, ${w} ${y}`} fill="none" stroke={i % 3 === 0 ? light : soft} strokeOpacity={0.55 - i * 0.04} strokeWidth={1.6} />);
      }
      els.push(<circle key="moon" cx={w * 0.72} cy={h * 0.18} r={w * 0.07} fill={light} opacity={0.85} />);
      els.push(<path key="boat" d={`M${w * 0.3} ${h * 0.33} l${w * 0.16} 0 l-${w * 0.025} ${h * 0.018} l-${w * 0.11} 0z M${w * 0.37} ${h * 0.33} l0 -${h * 0.06} l${w * 0.05} ${h * 0.06}`} fill="#0b0a08" opacity={0.85} />);
      break;
    case "sun":
      for (let i = 0; i < 14; i++) {
        const ang = (Math.PI * (i + 0.5)) / 14;
        els.push(<line key={i} x1={cx} y1={h * 0.5} x2={cx - Math.cos(ang) * w * 0.8} y2={h * 0.5 - Math.sin(ang) * w * 0.8} stroke={light} strokeOpacity={0.18} strokeWidth={6} />);
      }
      els.push(<circle key="s" cx={cx} cy={h * 0.5} r={w * 0.24} fill={`url(#${uid}-orb)`} />);
      for (let i = 0; i < 5; i++) els.push(<rect key={`b${i}`} x={0} y={h * 0.5 + i * 9} width={w} height={3 + i} fill="#0b0a08" opacity={0.55} />);
      break;
    case "shards":
      for (let i = 0; i < 9; i++) {
        const x = r() * w;
        const y = h * 0.1 + r() * h * 0.55;
        const s = 40 + r() * 90;
        els.push(<polygon key={i} points={`${x},${y} ${x + s},${y + s * 0.3} ${x + s * 0.25},${y + s}`} fill={i % 2 ? light : soft} opacity={0.12 + r() * 0.25} />);
      }
      els.push(<line key="l" x1={w * 0.1} y1={h * 0.7} x2={w * 0.9} y2={h * 0.12} stroke={light} strokeOpacity={0.5} strokeWidth={1.2} />);
      break;
    case "rings":
      for (let i = 0; i < 7; i++)
        els.push(<circle key={i} cx={cx + (i % 2 ? 8 : -8)} cy={cy} r={w * 0.06 + i * w * 0.055} fill="none" stroke={i % 2 ? light : soft} strokeOpacity={0.6 - i * 0.07} strokeWidth={2.2 - i * 0.2} />);
      els.push(<circle key="c" cx={cx} cy={cy} r={w * 0.05} fill={light} />);
      break;
    case "grid": {
      const hy = h * 0.46;
      for (let i = -8; i <= 8; i++) els.push(<line key={`v${i}`} x1={cx + i * 12} y1={hy} x2={cx + i * 90} y2={h} stroke={light} strokeOpacity={0.35} strokeWidth={1} />);
      for (let i = 0; i < 9; i++) {
        const y = hy + Math.pow(i / 8, 2) * (h - hy);
        els.push(<line key={`h${i}`} x1={0} y1={y} x2={w} y2={y} stroke={soft} strokeOpacity={0.35} strokeWidth={1} />);
      }
      for (let i = 0; i < 7; i++) {
        const bw = 18 + r() * 34;
        const bh = 50 + r() * 140;
        const bx = i * (w / 7) + r() * 10;
        els.push(<rect key={`t${i}`} x={bx} y={hy - bh} width={bw} height={bh} fill="#08070a" opacity={0.85} />);
        els.push(<rect key={`tw${i}`} x={bx + 4} y={hy - bh + 8} width={3} height={bh * 0.6} fill={light} opacity={0.4} />);
      }
      break;
    }
    case "palms": {
      els.push(<path key="fall" d={`M${w * 0.45} ${h * 0.12} q 8 ${h * 0.25} -4 ${h * 0.5}`} stroke={light} strokeOpacity={0.6} strokeWidth={14} fill="none" strokeLinecap="round" />);
      for (let i = 0; i < 5; i++) {
        const x = (i + 0.5) * (w / 5) + (r() - 0.5) * 30;
        const top = h * (0.18 + r() * 0.2);
        els.push(<path key={`t${i}`} d={`M${x} ${h * 0.72} Q ${x - 10} ${(top + h * 0.72) / 2} ${x + 6} ${top}`} stroke="#07090a" strokeWidth={6} fill="none" />);
        for (let f = 0; f < 6; f++) {
          const ang = (f / 6) * Math.PI * 2;
          els.push(<path key={`f${i}${f}`} d={`M${x + 6} ${top} q ${Math.cos(ang) * 30} ${Math.sin(ang) * 14 - 16} ${Math.cos(ang) * 52} ${Math.sin(ang) * 30 + 6}`} stroke="#07090a" strokeWidth={5} fill="none" strokeLinecap="round" />);
        }
      }
      break;
    }
    case "stars":
      for (let i = 0; i < 70; i++) els.push(<circle key={i} cx={r() * w} cy={r() * h * 0.7} r={r() * 1.6 + 0.3} fill="#fff" opacity={0.3 + r() * 0.6} />);
      els.push(<path key="moon" d={`M${w * 0.68} ${h * 0.14} a ${w * 0.11} ${w * 0.11} 0 1 0 ${w * 0.08} ${w * 0.19} a ${w * 0.085} ${w * 0.085} 0 1 1 -${w * 0.08} -${w * 0.19}z`} fill={light} />);
      els.push(<path key="skyline" d={`M0 ${h * 0.62} h${w * 0.12} v-30 h${w * 0.08} v18 h${w * 0.1} v-52 h${w * 0.06} v40 h${w * 0.14} v-22 h${w * 0.1} v34 h${w} V${h} H0z`} fill="#06060a" opacity={0.9} />);
      break;
  }
  return <g>{els}</g>;
}

export function PosterArt({
  art,
  title,
  rating,
  variant = "poster",
  showTitle = true,
  className,
}: {
  art: MovieArt;
  title: string;
  rating?: string;
  variant?: "poster" | "backdrop";
  showTitle?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const w = variant === "poster" ? 400 : 1600;
  const h = variant === "poster" ? 600 : 900;
  const lines = wrapTitle(title, 13);
  const fs = lines.length > 2 ? 44 : 52;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={`Artwork for ${title}`}>
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={`hsl(${art.hueA} 50% 32%)`} />
          <stop offset="0.55" stopColor={`hsl(${art.hueB} 45% 16%)`} />
          <stop offset="1" stopColor="#0a0908" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor={`hsl(${art.hueA} 90% 70%)`} stopOpacity="0.45" />
          <stop offset="1" stopColor={`hsl(${art.hueA} 90% 70%)`} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-orb`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={`hsl(${art.hueA} 95% 85%)`} />
          <stop offset="0.6" stopColor={`hsl(${art.hueA} 75% 55%)`} />
          <stop offset="1" stopColor={`hsl(${art.hueB} 60% 25%)`} />
        </radialGradient>
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.45" stopColor="#0a0908" stopOpacity="0" />
          <stop offset="1" stopColor="#0a0908" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${uid}-bg)`} />
      <rect width={w} height={h} fill={`url(#${uid}-glow)`} />
      {variant === "backdrop" ? (
        <g transform={`translate(${w * 0.45} 0) scale(${h / 600})`}>
          <Motif art={art} w={400 * 1.6} h={600} uid={uid} />
        </g>
      ) : (
        <Motif art={art} w={w} h={h} uid={uid} />
      )}
      <rect width={w} height={h} fill={`url(#${uid}-fade)`} />
      {variant === "poster" && showTitle && (
        <g>
          <text x="28" y="44" fill="#fff" fillOpacity="0.7" fontSize="13" letterSpacing="4" fontFamily="var(--font-body), sans-serif">
            MONROVIA CINEMA PLUS
          </text>
          {lines.map((line, i) => (
            <text key={i} x="28" y={h - 64 - (lines.length - 1 - i) * (fs + 2)} fill="#f8f1e4" fontSize={fs} fontFamily="var(--font-display-face), Georgia, serif">
              {line}
            </text>
          ))}
          {rating && (
            <g transform={`translate(28 ${h - 44})`}>
              <rect width={rating.length * 10 + 18} height="24" rx="5" fill="none" stroke="#fff" strokeOpacity="0.6" />
              <text x={(rating.length * 10 + 18) / 2} y="17" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" fontFamily="var(--font-body), sans-serif">
                {rating}
              </text>
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
