"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

export default function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particlesRef.current = [];
      const spacing = 50; // Closer particles for denser network
      const cols = Math.ceil(canvas.width / spacing);
      const rows = Math.ceil(canvas.height / spacing);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing + (Math.random() - 0.5) * 15;
          const y = j * spacing + (Math.random() - 0.5) * 15;

          particlesRef.current.push({
            x,
            y,
            baseX: x,
            baseY: y,
            vx: 0,
            vy: 0,
            size: 0.8 + Math.random() * 1.2,
            opacity: 0.05 + Math.random() * 0.1,
          });
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    resize();

    let time = 0;

    const draw = () => {
      time += 0.008;

      // Deep black background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Mouse interaction - smoother, less bouncy
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 180;

        if (distance < maxDistance) {
          // Gentler repulsion
          const force = (1 - distance / maxDistance) * 0.3;
          p.vx += (dx / distance) * force;
          p.vy += (dy / distance) * force;
        }

        // Very gentle return to base position (less spring effect)
        const returnForce = 0.02;
        p.vx += (p.baseX - p.x) * returnForce;
        p.vy += (p.baseY - p.y) * returnForce;

        // Heavy damping to reduce bounce
        p.vx *= 0.85;
        p.vy *= 0.85;

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Very subtle breathing
        const breath = Math.sin(time + i * 0.05) * 0.15 + 0.85;

        // Draw particle
        const activeOpacity =
          distance < maxDistance
            ? p.opacity + (1 - distance / maxDistance) * 0.3
            : p.opacity;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * breath, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${activeOpacity * breath})`;
        ctx.shadowBlur = distance < maxDistance ? 8 : 0;
        ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw connections to nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < 100) {
            const opacity = (1 - dist2 / 100) * 0.05;

            // Highlight connections near mouse
            const midX = (p.x + p2.x) / 2;
            const midY = (p.y + p2.y) / 2;
            const dmx = midX - mouse.x;
            const dmy = midY - mouse.y;
            const distMouse = Math.sqrt(dmx * dmx + dmy * dmy);

            const lineOpacity =
              distMouse < maxDistance
                ? opacity + (1 - distMouse / maxDistance) * 0.15
                : opacity;

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`;
            ctx.lineWidth = distMouse < maxDistance ? 1 : 0.5;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
