import { useEffect, MutableRefObject } from 'react';

type Opts = {
  enabled: boolean;
  userId?: string;
  cooldownHours?: number; // 24 = once per day
  containerRef?: MutableRefObject<HTMLElement | null>;
};

const keyFor = (uid?: string) => `celebrated_v1_${uid ?? 'anon'}`;

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

      const burst = (x: number, y: number, scalar = 1) =>
        fire({
          particleCount: Math.floor(180 * scalar),
          spread: 70,
          startVelocity: 55,
          decay: 0.9,
          gravity: 1.1,
          ticks: 200,
          origin: { x, y },
          scalar,
        });

      const comet = (fromLeft = true) =>
        fire({
          particleCount: 120,
          spread: 60,
          startVelocity: 70,
          gravity: 0.9,
          drift: fromLeft ? 0.6 : -0.6,
          origin: { x: fromLeft ? 0 : 1, y: 0.2 },
          ticks: 180,
        });

      // sequence
      burst(0.25, 0.6, 0.9);
      burst(0.75, 0.6, 0.9);
      setTimeout(() => comet(true), 350);
      setTimeout(() => comet(false), 650);
      setTimeout(() => burst(0.5, 0.4, 1.2), 900);

      localStorage.setItem(k, String(now));

      cleanup = () => {
        try { fire.reset(); } catch {}
        canvas.remove();
      };
    })();

    return () => cleanup();
  }, [enabled, userId, cooldownHours, containerRef]);
}
