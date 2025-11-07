// src/components/Layout/AuroraBG.tsx
import React from 'react';

type Preset = 'teal' | 'blue' | 'purple';
export default function AuroraBG({ preset = 'teal' }: { preset?: Preset }) {
  // colors tuned to your screenshot (teal/emerald)
  const blobs =
    preset === 'teal'
      ? [
          'from-[#00f5b0]', // top-left
          'from-[#00d4ff]', // right
          'from-[#0ea5e9]', // bottom-right
          'from-[#34d399]', // bottom-left
        ]
      : preset === 'blue'
      ? ['from-[#60a5fa]','from-[#22d3ee]','from-[#818cf8]','from-[#38bdf8]']
      : ['from-[#a78bfa]','from-[#22d3ee]','from-[#f472b6]','from-[#60a5fa]'];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* soft vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_10%,rgba(255,255,255,0.08),rgba(0,0,0,0.78))]" />
      {/* glow blobs */}
      <div className={`absolute -top-28 -left-24 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-50 bg-[radial-gradient(closest-side,var(--tw-gradient-from),transparent)] ${blobs[0]}`} />
      <div className={`absolute top-6 right-10 h-[22rem] w-[22rem] rounded-full blur-3xl opacity-45 bg-[radial-gradient(closest-side,var(--tw-gradient-from),transparent)] ${blobs[1]}`} />
      <div className={`absolute bottom-24 right-1/4 h-[26rem] w-[26rem] rounded-full blur-3xl opacity-35 bg-[radial-gradient(closest-side,var(--tw-gradient-from),transparent)] ${blobs[2]}`} />
      <div className={`absolute -bottom-20 -left-10 h-[22rem] w-[22rem] rounded-full blur-3xl opacity-30 bg-[radial-gradient(closest-side,var(--tw-gradient-from),transparent)] ${blobs[3]}`} />
      {/* film grain */}
      <div className="absolute inset-0 mix-blend-soft-light opacity-[0.08] [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%22240%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22240%22 height=%22240%22 filter=%22url(%23n)%22 opacity=%220.35%22/></svg>')]" />
    </div>
  );
}
