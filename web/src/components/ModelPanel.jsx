import { useState } from "react";
import { renderMarkdown } from "../lib/markdown.js";

// One model's response card. Collapsed by default (header + 2-line preview)
// to keep long answers from making the page feel slow — click to expand.
// Carries a star rating and a per-model share button, like the Base44 build.
export default function ModelPanel({ model, result, loading, comparisonId, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [stars, setStars] = useState(0);
  const [copied, setCopied] = useState(false);

  const share = async (e) => {
    e.stopPropagation();
    if (!comparisonId) return;
    const url = `${window.location.origin}/share/${comparisonId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50"
      >
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: model.color }} />
        <span className="font-semibold">{model.name}</span>
        {result?.ms != null && (
          <span className="text-xs text-stone-400">{(result.ms / 1000).toFixed(1)}s</span>
        )}
        {result?.mocked && (
          <span className="text-[10px] uppercase tracking-wide rounded bg-amber-100 text-amber-700 px-1.5 py-0.5">
            simulated
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {result && !loading && comparisonId && (
            <span
              onClick={share}
              className="text-xs text-stone-500 hover:text-fox cursor-pointer"
              title="Copy share link"
            >
              {copied ? "✓ copied" : "↗ share"}
            </span>
          )}
          <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </span>
      </button>

      <div className="px-4 pb-4">
        {loading && !result ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-stone-100 rounded w-11/12" />
            <div className="h-3 bg-stone-100 rounded w-4/5" />
            <div className="h-3 bg-stone-100 rounded w-2/3" />
          </div>
        ) : result?.error ? (
          <p className="text-sm text-red-600">⚠ {result.error}</p>
        ) : open ? (
          <>
            <div
              className="answer text-sm text-stone-800"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(result?.text || "") }}
            />
            <div className="mt-3 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setStars(n)}
                  className={n <= stars ? "text-fox" : "text-stone-300"}
                  aria-label={`Rate ${n} stars`}
                >
                  ★
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-stone-500 line-clamp-2">
            {(result?.text || "").replace(/[*#`]/g, "").slice(0, 160)}…
          </p>
        )}
      </div>
    </div>
  );
}
