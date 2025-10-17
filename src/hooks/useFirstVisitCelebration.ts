// /hooks/useFirstVisitCelebration.ts
import { useEffect, MutableRefObject } from 'react';

type Opts = {
  enabled: boolean;
  userId?: string;
  cooldownHours?: number; // 24 = once per day
  containerRef?: MutableRefObject<HTMLElement | null>;
  message?: string; // optional overlay text
};

const keyFor = (uid?: string) => `celebrated_v3_firecracker_plus_${uid ?? 'anon'}`;

export function useFirstVisitCelebration({
  enabled,
  userId,
  cooldownHours = 24,
  containerRef,
  message = '🎉 Welcome to Nakoda Mobile!',
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

      // Canvas
      const canvas = document.createElement('canvas');
      Object.assign(canvas.style, {
        position: 'fixed',
        inset: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '9999',
      } as CSSStyleDeclaration);
      host.appendChild(canvas);

      const fire = confetti.create(canvas, { resize: true, useWorker: true });

      // --- 1) Multi-color palette
      const COLORS = ['#ff0040', '#ff7a00', '#ffd400', '#27d17f', '#00c6ff', '#8a2be2'];

      // Sound helper (2) sound sync
      const playPop = () => {
        try {
          // Put a small file at: /public/sfx/firecracker.mp3
          new Audio('/sfx/firecracker.mp3').play().catch(() => {});
        } catch {}
      };

      // Optional text overlay (6)
      const msg = document.createElement('div');
      msg.textContent = message;
      msg.style.position = 'fixed';
      msg.style.top = '38%';
      msg.style.left = '50%';
      msg.style.transform = 'translateX(-50%)';
      msg.style.fontSize = '2rem';
      msg.style.fontWeight = '700';
      msg.style.color = '#fff';
      msg.style.textShadow = '0 2px 12px rgba(0,0,0,0.6)';
      msg.style.zIndex = '10000';
      msg.style.opacity = '0';
      msg.style.animation = 'celeFade 3.6s ease 0.3s forwards';
      host.appendChild(msg);

      // Inject keyframes once
      const styleId = 'celebration-keyframes';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @keyframes celeFade {
            0% { opacity: 0; transform: translateX(-50%) translateY(6px); }
            10% { opacity: 1; transform: translateX(-50%) translateY(0); }
            70% { opacity: 1; }
            100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          }`;
        document.head.appendChild(style);
      }

      const timeouts: number[] = [];
      const intervals: number[] = [];

      // Trail + explosion with enhancements: (3) trails & glow, (4) variable heights, (1) colors, (2) sound
      const launchFirecracker = (fromLeft: boolean, delay = 0) => {
        const tid = window.setTimeout(() => {
          const xStart = fromLeft ? 0.04 : 0.96;
          const xTarget = fromLeft
            ? Math.random() * 0.42 + 0.22
            : Math.random() * 0.42 + 0.36;
          // variable heights (0.07–0.28)
          const yTarget = Math.random() * 0.21 + 0.07;
          const yStart = 0.96;
          const steps = 20;
          let step = 0;

          const trailId = window.setInterval(() => {
            step++;
            const t = step / steps;
            const ease = (u: number) => 1 - Math.pow(1 - u, 2); // ease-out
            const x = xStart + (xTarget - xStart) * ease(t);
            const y = yStart + (yTarget - yStart) * ease(t);

            // small trail sparks (glow)
            fire({
              particleCount: 10,
              startVelocity: 60,
              spread: 12,
              gravity: 1.3,
              ticks: 50,
              origin: { x, y },
              scalar: 0.5,
              drift: fromLeft ? 0.25 : -0.25,
              colors: COLORS, // multi-color trail
              shapes: ['circle'],
            });

            // occasional brighter flare
            if (step % 5 === 0) {
              fire({
                particleCount: 6,
                startVelocity: 70,
                spread: 18,
                gravity: 1.2,
                ticks: 60,
                origin: { x, y },
                scalar: 0.6,
                colors: COLORS,
              });
            }

            if (step >= steps) {
              clearInterval(trailId);

              // Explosion core
              playPop();
              fire({
                particleCount: 140,
                startVelocity: 62,
                spread: 360,
                gravity: 0.95,
                ticks: 190,
                origin: { x: xTarget, y: yTarget },
                scalar: 1.1,
                colors: COLORS,
                shapes: ['circle', 'square'],
              });

              // Ring
              const ringDelay = window.setTimeout(() => {
                playPop();
                fire({
                  particleCount: 90,
                  startVelocity: 42,
                  spread: 70,
                  gravity: 1.0,
                  ticks: 150,
                  origin: { x: xTarget, y: yTarget + 0.02 },
                  scalar: 0.9,
                  colors: COLORS,
                });
              }, 120);
              timeouts.push(ringDelay);

              // Crackle
              const crackleDelay = window.setTimeout(() => {
                fire({
                  particleCount: 70,
                  startVelocity: 48,
                  spread: 85,
                  gravity: 1.05,
                  ticks: 160,
                  origin: { x: xTarget, y: yTarget - 0.015 },
                  scalar: 0.85,
                  colors: COLORS,
                });
              }, 230);
              timeouts.push(crackleDelay);
            }
          }, 26);

          intervals.push(trailId);
        }, delay);
        timeouts.push(tid);
      };

      // Sequence: staggered launches from both sides
      launchFirecracker(true, 0);
      launchFirecracker(false, 220);
      launchFirecracker(true, 440);
      launchFirecracker(false, 660);
      launchFirecracker(Math.random() > 0.5, 880);
      launchFirecracker(Math.random() > 0.5, 1100);

      // (5) Finale burst
      const finaleDelay = window.setTimeout(() => {
        playPop();
        fire({
          particleCount: 320,
          startVelocity: 80,
          spread: 360,
          gravity: 0.9,
          ticks: 200,
          origin: { x: 0.5, y: 0.28 },
          scalar: 1.35,
          colors: COLORS,
          shapes: ['circle', 'square'],
        });
        // Finale shimmer
        const shimmerId = window.setInterval(() => {
          fire({
            particleCount: 24,
            startVelocity: 35,
            spread: 45,
            gravity: 1.0,
            ticks: 120,
            origin: { x: 0.5 + (Math.random() - 0.5) * 0.12, y: 0.28 + (Math.random() - 0.5) * 0.06 },
            scalar: 0.75,
            colors: COLORS,
          });
        }, 90);
        intervals.push(shimmerId);

        // stop shimmer after ~1.2s
        const stopShimmer = window.setTimeout(() => clearInterval(shimmerId), 1200);
        timeouts.push(stopShimmer);
      }, 1500);
      timeouts.push(finaleDelay);

      localStorage.setItem(k, String(now));

      cleanup = () => {
        try {
          fire.reset();
        } catch {}
        timeouts.forEach((id) => clearTimeout(id));
        intervals.forEach((id) => clearInterval(id));
        canvas.remove();
        msg.remove();
      };
    })();

    return () => cleanup();
  }, [enabled, userId, cooldownHours, containerRef, message]);
}
