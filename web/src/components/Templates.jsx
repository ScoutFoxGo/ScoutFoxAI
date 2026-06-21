// Template library — saved prompts stored in localStorage so you can reuse a
// favorite prompt instead of retyping it. Click to insert; × to delete.
export default function Templates({ templates, onUse, onDelete }) {
  if (!templates.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {templates.map((t, i) => (
        <span
          key={i}
          className="group inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700"
        >
          <button onClick={() => onUse(t)} className="hover:text-fox" title={t}>
            {t.slice(0, 40)}{t.length > 40 ? "…" : ""}
          </button>
          <button
            onClick={() => onDelete(i)}
            className="text-stone-300 group-hover:text-red-500"
            aria-label="Delete template"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
