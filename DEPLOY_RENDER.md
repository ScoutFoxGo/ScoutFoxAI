# Deploy ScoutFoxAI live (Render) — and why not Netlify

## The one thing to understand
- **GitHub** = where the code lives (version control). Pushing code there does **not**
  make a website. ✅ Already done — everything is on `ScoutFoxGo/ScoutFoxAI`.
- **A host** = what *builds and runs* the code and gives you a live URL. ⬅️ This is
  the missing step.

ScoutFoxAI is a **Node/Express server** (the brain, the assistant, the LMS, the live
tracker, the API). That needs a **Node host**.

## Why not Netlify
Netlify hosts **static files** (HTML/JS) and small serverless functions — it can't
run a always-on Node server. So the live tracker, the Scout brain, and the `/api`
can't run on Netlify. (Your `comforting-gumption-c3bb8b` site is a static deploy,
not connected to this repo.) Use Render for the app; you can keep a static Netlify
page as a marketing/landing snapshot if you like.

## Deploy to Render (≈5 minutes)
1. Go to **https://render.com** and sign in **with GitHub** (so it can see the repo).
2. **New → Blueprint.**
3. Pick the **`ScoutFoxGo/ScoutFoxAI`** repository. Render reads `render.yaml`
   automatically — one web service, build `npm run build`, start `npm start`.
4. Click **Apply / Create**. First build takes a few minutes.
5. You get a live URL like **`https://scoutfoxai.onrender.com`**. That's everything:
   - `…/assistant.html` — the planner
   - `…/tracker.html` — the **live** project tracker
   - `…/demo.html`, `…/checkout.html`, `…/plan.html`
   - `…/api/health`, `…/api/status`, `…/api/brain`

## Turn on the live integrations
In the Render dashboard → your service → **Environment** tab, add the keys from
`server/.env.example` (Render env vars override the file):

- `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` (or `LOCAL_LLM_URL`) — the brain
- `DUFFEL_API_KEY`, `STRIPE_SECRET_KEY` (test), `GOOGLE_PLACES_API_KEY`,
  `OPENWEATHER_API_KEY`, `NPS_API_KEY`, `BOOKING_*`, `EXPEDIA_*` — as you get them

After it deploys, verify:
```
curl https://<your-render-url>/api/status     # what's live vs mock
curl https://<your-render-url>/api/selftest    # pings Anthropic/Duffel/Stripe
```

## Keep the tracker's data across deploys (optional)
The tracker/saved data is in the JSON store. To persist it across restarts, add a
disk in `render.yaml` (there's a commented block in the file) or move the store to a
database later. Without it, the board re-seeds from the roadmap on each deploy.

## Custom domain
Render → your service → **Settings → Custom Domains** → add `api.scoutfox.ai` (or
`scoutfoxai.com`) and follow the DNS instructions. Keep `scoutfoxgo.com` for the
separate marketing site.

## Auto-deploy
Once connected, **every push to `main` auto-deploys.** So when I push an update to
GitHub, Render rebuilds and your live site updates automatically — *that's* the link
that makes "push to GitHub = it goes live" actually true.
