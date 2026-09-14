/**
 * Lightweight canvas confetti generator for celebration effects
 * No external npm dependencies needed.
 */
export function triggerConfetti() {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "99999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  const colors = [
    "#f59e0b", // amber gold
    "#fbbf24", // bright gold
    "#eab308", // yellow gold
    "#ffffff", // white sparkle
    "#ec4899", // pink accent
    "#10b981", // emerald
    "#6366f1", // indigo
  ];

  interface Particle {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    vx: number;
    vy: number;
    angle: number;
    angleSpeed: number;
    decay: number;
    opacity: number;
  }

  const particles: Particle[] = [];
  const particleCount = 120;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height * 0.4,
      w: Math.random() * 10 + 6,
      h: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 16 - 8,
      angle: Math.random() * 360,
      angleSpeed: (Math.random() - 0.5) * 10,
      decay: Math.random() * 0.01 + 0.008,
      opacity: 1,
    });
  }

  let animationFrame: number;

  function render() {
    ctx?.clearRect(0, 0, width, height);

    let activeCount = 0;

    for (const p of particles) {
      if (p.opacity > 0) {
        activeCount++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.vx *= 0.98; // drag
        p.angle += p.angleSpeed;
        p.opacity -= p.decay;

        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.angle * Math.PI) / 180);
        ctx!.globalAlpha = Math.max(0, p.opacity);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
      }
    }

    if (activeCount > 0) {
      animationFrame = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(animationFrame);
      canvas.remove();
    }
  }

  render();
}
