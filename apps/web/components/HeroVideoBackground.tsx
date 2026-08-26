/**
 * Fondo del hero: video en loop silencioso. Sin controles ni sonido — es
 * ambientación, no contenido que el usuario deba operar. `playsInline` es
 * lo que evita que iOS lo abra a pantalla completa en vez de reproducirlo
 * como fondo.
 */
export function HeroVideoBackground() {
  return (
    <>
      <video
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
