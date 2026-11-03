"use client";

/** Ráfaga de confeti (azul, naranja y blanco) sin dependencias. Respeta "reducir movimiento". */
export function fireConfetti(origin?: { x: number; y: number }) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  Object.assign(c.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "100" });
  c.width = window.innerWidth; c.height = window.innerHeight;
  document.body.appendChild(c);
  const g = c.getContext("2d")!;
  const ox = origin?.x ?? c.width / 2, oy = origin?.y ?? c.height * 0.35;
  const colors = ["#1b4fd8", "#4f8cff", "#ff6a00", "#ffa14d", "#ffffff", "#9bbcff"];
  const ps = Array.from({ length: 110 }, () => {
    const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 9;
    return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0], life: 1 };
  });
  let t0 = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(2, (now - t0) / 16.7); t0 = now;
    g.clearRect(0, 0, c.width, c.height);
    let alive = 0;
    for (const p of ps) {
      p.vy += 0.28 * dt; p.vx *= 0.992; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= 0.0075 * dt;
      if (p.life <= 0 || p.y > c.height + 20) continue;
      alive++;
      g.save(); g.globalAlpha = Math.max(0, p.life); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore();
    }
    alive ? requestAnimationFrame(tick) : c.remove();
  };
  requestAnimationFrame(tick);
}
