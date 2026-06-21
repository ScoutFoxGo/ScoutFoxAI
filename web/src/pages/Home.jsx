import { useEffect, useState } from "react";
import { invokeLLM, saveComparison, health } from "../lib/api.js";
import { TIERS, META_MODEL } from "../lib/models.js";
import PromptBar from "../components/PromptBar.jsx";
import Templates from "../components/Templates.jsx";
import ModelPanel from "../components/ModelPanel.jsx";
import SynthesisPanel from "../components/SynthesisPanel.jsx";
import AIJudge from "../components/AIJudge.jsx";

const TEMPLATES_KEY = "scoutfox_templates";

export default function Home() {
  const [tier, setTier] = useState("fast");
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState({}); // { [modelKey]: {text, ms, mocked, error} }
  const [synthesis, setSynthesis] = useState("");
  const [judge, setJudge] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | answering | synthesizing | judging | done
  const [comparisonId, setComparisonId] = useState(null);
  const [view, setView] = useState("stacked"); // stacked | grid
  const [templates, setTemplates] = useState([]);
  const [live, setLive] = useState(null);

  useEffect(() => {
    setTemplates(JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "[]"));
    health().then((h) => setLive(h.anthropic)).catch(() => setLive(false));
  }, []);

  const saveTemplate = (text) => {
    const next = [...new Set([text, ...templates])].slice(0, 20);
    setTemplates(next);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  };
  const deleteTemplate = (i) => {
    const next = templates.filter((_, idx) => idx !== i);
    setTemplates(next);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  };

  // The engine. Mirrors Base44's Home.jsx ask():
  //   1. fan out to every model in parallel (UI streams in as each returns)
  //   2. synthesize all answers
  //   3. persist the comparison
  //   4. run the AI judge
  async function ask(text) {
    const models = TIERS[tier].models;
    setBusy(true);
    setPrompt(text);
    setResults({});
    setSynthesis("");
    setJudge("");
    setComparisonId(null);
    setPhase("answering");

    // 1) Parallel model calls — allSettled so one failure doesn't sink the
    // rest. Collect answers into a local map (not state) so the synthesis/judge
    // steps don't race React's async setState. The UI streams in as each lands.
    const answers = {};
    await Promise.allSettled(
      models.map(async (m) => {
        try {
          answers[m.key] = await invokeLLM({ modelKey: m.key, prompt: text });
        } catch (err) {
          answers[m.key] = { error: err.message };
        }
        setResults((prev) => ({ ...prev, [m.key]: answers[m.key] }));
      })
    );

    const transcript = models
      .map((m) => `### ${m.name}\n${answers[m.key]?.text || "(no answer)"}`)
      .join("\n\n");

    // 2) Synthesis
    setPhase("synthesizing");
    let synthesisText = "";
    try {
      const s = await invokeLLM({
        modelKey: META_MODEL,
        prompt:
          `A user asked: "${text}"\n\nHere are answers from several AI models:\n\n${transcript}\n\n` +
          `Write a concise synthesis with three short sections: ` +
          `**Areas of agreement**, **Key differences**, and **Final take**.`,
      });
      synthesisText = s.text;
      setSynthesis(synthesisText);
    } catch {
      setSynthesis("_Synthesis unavailable._");
    }

    // 3) Persist (so each card can produce a share link)
    let savedId = null;
    try {
      const saved = await saveComparison({
        prompt: text,
        tier,
        models: models.map((m) => m.name),
        responses: answers,
        synthesis: synthesisText,
      });
      savedId = saved.id;
      setComparisonId(savedId);
    } catch {
      /* sharing just won't be available */
    }

    // 4) AI judge
    setPhase("judging");
    try {
      const j = await invokeLLM({
        modelKey: META_MODEL,
        prompt:
          `You are an impartial judge. The user asked: "${text}"\n\n${transcript}\n\n` +
          `Score each model on accuracy, completeness, clarity, and actionability. ` +
          `Then give: a one-line **Winner**, a one-sentence reason, and a **Consensus** ` +
          `(0-100) for how much the models agreed.`,
      });
      setJudge(j.text);
    } catch {
      setJudge("_Judge unavailable._");
    }

    setPhase("done");
    setBusy(false);
  }

  const models = TIERS[tier].models;
  const started = phase !== "idle";

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-3">
          <span className="text-2xl">🦊</span>
          <div>
            <h1 className="text-lg font-bold leading-tight">ScoutFoxAI</h1>
            <p className="text-xs text-stone-500">Compare AI Platforms — ask once, compare every model</p>
          </div>
          <span
            className={`ml-auto text-xs rounded-full px-2.5 py-1 ${
              live ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}
            title={live ? "Live Claude responses" : "Mock responses — set ANTHROPIC_API_KEY on the server"}
          >
            {live == null ? "…" : live ? "● live Claude" : "● mock mode"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        <PromptBar
          onSubmit={ask}
          busy={busy}
          tier={tier}
          setTier={setTier}
          onSaveTemplate={saveTemplate}
        />
        <Templates templates={templates} onUse={ask} onDelete={deleteTemplate} />

        {started && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-stone-500">
                <span className="font-medium text-stone-700">Prompt:</span> {prompt}
              </p>
              <div className="inline-flex rounded-lg border border-stone-300 overflow-hidden text-xs">
                <button
                  onClick={() => setView("stacked")}
                  className={`px-2.5 py-1 ${view === "stacked" ? "bg-stone-800 text-white" : "bg-white"}`}
                >
                  ▤ Stacked
                </button>
                <button
                  onClick={() => setView("grid")}
                  className={`px-2.5 py-1 ${view === "grid" ? "bg-stone-800 text-white" : "bg-white"}`}
                >
                  ▦ Side by side
                </button>
              </div>
            </div>

            <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>
              {models.map((m) => (
                <ModelPanel
                  key={m.key}
                  model={m}
                  result={results[m.key]}
                  loading={busy && !results[m.key]}
                  comparisonId={comparisonId}
                  defaultOpen={view === "grid"}
                />
              ))}
            </div>

            {(phase === "synthesizing" || synthesis) && (
              <SynthesisPanel text={synthesis} loading={phase === "synthesizing"} />
            )}
            {(phase === "judging" || judge) && (
              <AIJudge text={judge} loading={phase === "judging"} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
