import Header from "./components/Header";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold mb-2">Haydos FX Dashboard (Preview)</h1>
        <p className="text-neutral-300 mb-6">
          COT + free news feed coming soon. Early build.
        </p>
        <a
          href="/cot"
          className="inline-block rounded bg-white/10 px-4 py-2 hover:bg-white/20"
        >
          Open COT Dashboard
        </a>
      </div>
    </main>
  );
}
