"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo del hero: video en loop silencioso con un parallax sutil (se mueve
 * más lento que el scroll, como si estuviera "detrás" del contenido). Sin
 * controles ni sonido — es ambientación, no contenido que el usuario deba
 * operar. `playsInline` es lo que evita que iOS lo abra a pantalla completa
 * en vez de reproducirlo como fondo.
 */
export function HeroVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        // Se mueve a una fracción del scroll y se frena apenas el hero sale
        // de pantalla, para no arrastrar el video más allá de donde se lo ve.
        const offset = Math.min(window.scrollY, window.innerHeight) * 0.18;
        video.style.transform = `translate3d(0, ${offset}px, 0) scale(1.08)`;
        ticking = false;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        className="hero-video-bg"
        src="/hero/skin-macro.mp4"
        poster="/hero/poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <div className="hero-video-overlay" aria-hidden="true" />
    </>
  );
}
