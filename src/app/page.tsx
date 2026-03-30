import { Hero } from "@/components/landing/Hero";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden"
      style={{ background: 'var(--bg-base)' }}>
      {/* Warm dot grid */}
      <div className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #E8E1D9 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 60%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 60%, transparent 100%)',
          opacity: 0.6,
        }}
      />
      <div className="relative z-10 w-full max-w-7xl px-4">
        <Hero />
      </div>
    </main>
  );
}