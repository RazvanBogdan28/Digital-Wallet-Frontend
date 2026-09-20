import { useMemo } from 'react';

// Banknote-style security print: nested petal rosettes (hypotrochoids) plus interlaced
// wave bands. Everything is generated from a seed, so each wallet gets its own pattern.
const PETALS = [7, 9, 11, 13];

const CONFIG = {
  note: {
    w: 400, h: 200, cx: 314, cy: 100, radius: 92, count: 13, steps: 420, stroke: 0.55,
    waves: { y0: 116, spread: 72, count: 14, amp: 5, freq: 0.045, phase: 0.32 },
  },
  art: {
    w: 600, h: 900, cx: 300, cy: 330, radius: 270, count: 16, steps: 520, stroke: 0.7,
    waves: { y0: 690, spread: 210, count: 24, amp: 14, freq: 0.02, phase: 0.28 },
  },
};

function rosette(cfg, seed) {
  const petals = PETALS[Math.abs(seed) % PETALS.length];
  const a = petals - 1; // distance between the two circles that roll against each other
  const unit = cfg.radius / (2 * a);
  const curves = [];

  for (let j = 0; j < cfg.count; j++) {
    const d = a * (0.3 + 0.7 * (j / (cfg.count - 1)));
    const twist = j * 0.11;
    let path = '';
    for (let i = 0; i <= cfg.steps; i++) {
      const t = (i / cfg.steps) * Math.PI * 2;
      const x = a * Math.cos(t) + d * Math.cos(a * t);
      const y = a * Math.sin(t) - d * Math.sin(a * t);
      const rx = x * Math.cos(twist) - y * Math.sin(twist);
      const ry = x * Math.sin(twist) + y * Math.cos(twist);
      path += `${i ? 'L' : 'M'}${(cfg.cx + rx * unit).toFixed(1)} ${(cfg.cy + ry * unit).toFixed(1)}`;
    }
    curves.push(path);
  }
  return curves;
}

function waves(cfg) {
  const { y0, spread, count, amp, freq, phase } = cfg.waves;
  const bands = [];
  for (let i = 0; i < count; i++) {
    const base = y0 + i * (spread / count);
    let path = '';
    for (let x = 0; x <= cfg.w; x += 5) {
      const y =
        base + amp * Math.sin(x * freq + i * phase) + amp * 0.5 * Math.sin(x * freq * 2.3 - i * phase * 1.7);
      path += `${x ? 'L' : 'M'}${x} ${y.toFixed(1)}`;
    }
    bands.push(path);
  }
  return bands;
}

export default function Guilloche({ variant = 'note', seed = 1, className = '', style }) {
  const cfg = CONFIG[variant];
  const paths = useMemo(() => [...rosette(cfg, seed), ...waves(cfg)], [cfg, seed]);

  return (
    <svg
      className={`guilloche draw ${className}`.trim()}
      style={style}
      viewBox={`0 0 ${cfg.w} ${cfg.h}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={cfg.stroke}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} pathLength="1" style={{ '--i': i }} />
      ))}
    </svg>
  );
}
