import { useState } from "react";

// Prompt input + the Fast/Advanced tier toggle + template save/insert.
export default function PromptBar({ onSubmit, busy, tier, setTier, onSaveTemplate }) {
  const [value, setValue] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || busy) return;
    onSubmit(text);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
        }}
        rows={3}
        placeholder="Ask anything — every model answers, then ScoutFox synthesizes and judges. (⌘/Ctrl+Enter to send)"
        className="w-full resize-none rounded-xl border border-stone-300 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-fox/40"
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-stone-300 overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setTier("fast")}
            className={`px-3 py-1.5 ${tier === "fast" ? "bg-fox text-white" : "bg-white text-stone-600"}`}
          >
            ⚡ Fast
          </button>
          <button
            type="button"
            onClick={() => setTier("advanced")}
            className={`px-3 py-1.5 ${tier === "advanced" ? "bg-fox text-white" : "bg-white text-stone-600"}`}
          >
            Pro
          </button>
        </div>

        {value.trim() && (
          <button
            type="button"
            onClick={() => onSaveTemplate(value.trim())}
            className="text-sm text-stone-500 hover:text-fox"
            title="Save as template"
          >
            🔖 Save template
          </button>
        )}

        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="ml-auto rounded-xl bg-fox px-5 py-2 text-sm font-semibold text-white hover:bg-fox-dark disabled:opacity-40"
        >
          {busy ? "Comparing…" : "Compare"}
        </button>
      </div>
    </form>
  );
}
