import { useEffect, useRef } from 'react';

export default function DotBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Smaller spacing for more dots
    const spacing = 20;
    const rows = Math.ceil(canvas.height / spacing) + 4;
    const cols = Math.ceil(canvas.width / spacing) + 4;

    // Create dots with initial positions and phases
    const dots = Array.from({ length: rows * cols }, (_, i) => ({
      x: (i % cols) * spacing - spacing * 2,
      y: Math.floor(i / cols) * spacing - spacing * 2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.01
    }));

    function animate(time: number) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear instead of filling black

      // Draw dots with wave effect
      dots.forEach(dot => {
        // Update position with wave motion
        const xOffset = Math.sin(time * 0.001 + dot.phase) * 2;
        const yOffset = Math.cos(time * 0.001 + dot.phase) * 2;

        dot.x += dot.speed;
        if (dot.x > canvas.width + spacing * 2) {
          dot.x = -spacing * 2;
        }

        // Draw dot with subtle glow
        const x = dot.x + xOffset;
        const y = dot.y + yOffset;

        // Glow effect
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 4);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Main dot
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
      });

      requestAnimationFrame(animate);
    }

    const animationFrame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
    />
  );
}