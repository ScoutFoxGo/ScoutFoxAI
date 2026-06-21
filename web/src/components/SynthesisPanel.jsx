import { renderMarkdown } from "../lib/markdown.js";

// The synthesis: a Claude pass that reads every model's answer and reports
// areas of agreement, key differences, and a final take.
export default function SynthesisPanel({ text, loading }) {
  return (
    <div className="rounded-xl border border-fox/30 bg-fox-light/40 p-5">
      <h3 className="font-semibold text-fox-dark flex items-center gap-2">
        🦊 Synthesis
      </h3>
      {loading ? (
        <p className="text-sm text-stone-500 mt-2">Comparing all responses…</p>
      ) : (
        <div
          className="answer text-sm text-stone-800 mt-2"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(text || "") }}
        />
      )}
    </div>
  );
}
