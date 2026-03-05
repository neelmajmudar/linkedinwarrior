"use client";

import { useEffect, useRef, useCallback } from "react";

function createWarmGradientImage(): string {
  const size = 512; // 512 is plenty for a blurred liquid texture
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size * 0.39;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.59);
  gradient.addColorStop(0, "#ede0d8");
  gradient.addColorStop(0.3, "#ddcdc4");
  gradient.addColorStop(0.55, "#e8d8cf");
  gradient.addColorStop(0.8, "#f5ede8");
  gradient.addColorStop(1, "#ffffff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return canvas.toDataURL("image/jpeg", 0.85); // JPEG ~60% smaller than PNG
}

export default function LiquidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appRef = useRef<any>(null);

  const dispose = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    try {
      // Stop the render loop
      if (app.dispose) app.dispose();
      if (app.renderer) {
        app.renderer.dispose();
        app.renderer.forceContextLoss();
      }
    } catch { /* best-effort cleanup */ }
    appRef.current = null;
  }, []);

  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;

    let cancelled = false;

    (async () => {
      const url =
        "https://cdn.jsdelivr.net/npm/threejs-components@0.0.27/build/backgrounds/liquid1.min.js";
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore – external CDN module with no type declarations
      const mod = await import(/* webpackIgnore: true */ url);
      if (cancelled) return;

      const LiquidBackgroundFn = mod.default || mod;
      const app = LiquidBackgroundFn(canvasRef.current);
      appRef.current = app;

      const textureUrl = createWarmGradientImage();
      app.loadImage(textureUrl);
      app.liquidPlane.material.metalness = 0.5;
      app.liquidPlane.material.roughness = 0.4;
      app.liquidPlane.uniforms.displacementScale.value = 4;
      app.setRain(false);
    })();

    return () => {
      cancelled = true;
      dispose();
    };
  }, [dispose]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
}
