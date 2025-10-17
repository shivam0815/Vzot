import { useEffect, MutableRefObject } from 'react';

type Opts = {
  enabled: boolean;
  userId?: string;
  cooldownHours?: number; // 24 = once per day
  containerRef?: MutableRefObject<HTMLElement | null>;
};

const keyFor = (uid?: string) => `celebrated_v2_firecracker_${uid ?? 'anon'}`;

export function useFirstVisitCelebration({
  enabled,
  userId,
  cooldownHours = 24,
  containerRef,
}: Opts) {
  useEffect(() => {
    if (!enabled) return;

    const k = keyFor(userId);
    const last = localStorage.getItem(k);
    const now = Date.now();
    if (last && now - Number(last) < cooldownHours * 3600_000) return;

    let cleanup = () => {};

    (async () => {
      const confetti = (await import('canvas-confetti')).default;

      const host = containerRef?.current ?? document.body;
      const canvas = document.createElement('canvas');
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '9999';
      host.appendChild(canvas);

      const fire = confetti.create(canvas, { resize: true, useWorker: true });

      const timeouts: number[] = [];
      const intervals: number[] = [];

      // --- Firecracker effect ---
      // 1) Launch "rocket" trail from bottom to a random top point
      // 2) Explode with multi-burst star
      const launchFirecracker = (fromLeft: boolean, delay = 0) => {
        const tid = window.setTimeout(() => {
          const xStart = fromLeft ? 0.05 : 0.95;
          const xTarget = fromLeft ? Math.random() * 0.4 + 0.25 : Math.random() * 0.4 + 0.35;
          const yStart = 0.95;
          const yTarget = Math.random() * 0.35 + 0.1; // explode near top
          const steps = 18;
          let step = 0;

          const trailId = window.setInterval(() => {
            step++;
            const t = step / steps;
            const x = xStart + (xTarget - xStart) * t;
            const y = yStart + (yTarget - yStart) * t;

            // trail sparks (thin, fast, upward)
            fire({
              particleCount: 12,
              startVelocity: 55,
              spread: 15,
              gravity: 1.2,
              ticks: 60,
              origin: { x, y },
              scalar: 0.6,
              drift: fromLeft ? 0.2 : -0.2,
            });

            if (step >= steps) {
              clearInterval(trailId);
              // Explosion core
              fire({
                particleCount: 140,
                startVelocity: 60,
                spread: 360,
                gravity: 0.9,
                ticks: 180,
                origin: { x: xTarget, y: yTarget },
                scalar: 1.1,
              });
              // Ring and crackle (staggered mini-bursts)
              window.setTimeout(() => {
                fire({
                  particleCount: 80,
                  startVelocity: 40,
                  spread: 55,
                  gravity: 1.0,
                  ticks: 140,
                  origin: { x: xTarget, y: yTarget + 0.02 },
                  scalar: 0.9,
                });
              }, 120);
              window.setTimeout(() => {
                fire({
                  particleCount: 60,
                  startVelocity: 45,
                  spread: 75,
                  gravity: 1.05,
                  ticks: 150,
                  origin: { x: xTarget, y: yTarget - 0.015 },
                  scalar: 0.8,
                });
              }, 220);
            }
          }, 28);

          intervals.push(trailId);
        }, delay);
        timeouts.push(tid);
      };

      // Show: stagger 5–6 firecrackers from both sides
      launchFirecracker(true, 0);
      launchFirecracker(false, 220);
      launchFirecracker(true, 440);
      launchFirecracker(false, 660);
      launchFirecracker(Math.random() > 0.5, 880);
      launchFirecracker(Math.random() > 0.5, 1100);

      localStorage.setItem(k, String(now));

      cleanup = () => {
        try {
          fire.reset();
        } catch {}
        timeouts.forEach((id) => clearTimeout(id));
        intervals.forEach((id) => clearInterval(id));
        canvas.remove();
      };
    })();

    return () => cleanup();
  }, [enabled, userId, cooldownHours, containerRef]);
}
