import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { loadComparison } from "../lib/api.js";
import ModelPanel from "../components/ModelPanel.jsx";
import SynthesisPanel from "../components/SynthesisPanel.jsx";

// Read-only view of a saved comparison, reachable via the per-card share links.
export default function Shared() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadComparison(id).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <p className="text-stone-600">This comparison couldn't be found.</p>
        <Link to="/" className="text-fox underline">Start a new comparison →</Link>
      </div>
    );
  }
  if (!data) return <div className="p-8 text-stone-400">Loading…</div>;

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-3">
          <span className="text-2xl">🦊</span>
          <h1 className="text-lg font-bold">ScoutFoxAI — shared comparison</h1>
          <Link to="/" className="ml-auto text-sm text-fox underline">New comparison →</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <p className="text-sm text-stone-600">
          <span className="font-medium">Prompt:</span> {data.prompt}
        </p>
        <div className="space-y-3">
          {(data.models || []).map((name, i) => {
            const key = Object.keys(data.responses || {})[i];
            return (
              <ModelPanel
                key={key || i}
                model={{ name, color: "#E8662A" }}
                result={data.responses?.[key]}
                defaultOpen
              />
            );
          })}
        </div>
        {data.synthesis && <SynthesisPanel text={data.synthesis} />}
      </main>
    </div>
  );
}
