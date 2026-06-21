import { renderMarkdown } from "../lib/markdown.js";

// The AI judge: scores each model and names a winner + consensus.
export default function AIJudge({ text, loading }) {
  return (
    <div className="rounded-xl border border-stone-300 bg-stone-900 text-stone-100 p-5">
      <h3 className="font-semibold flex items-center gap-2">⚖️ AI Judge</h3>
      {loading ? (
        <p className="text-sm text-stone-400 mt-2">Scoring responses…</p>
      ) : (
        <div
          className="answer text-sm mt-2 [&_strong]:text-fox"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(text || "") }}
        />
      )}
    </div>
  );
}
