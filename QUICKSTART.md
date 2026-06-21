# Show ScoutFoxGo to people — Quickstart

The demo page is `/demo.html` (Ask Scout, Scout Modes, Scout Harmony, Destination
compare). Two ways to show it.

## A) On your own computer (in person) — ~3 minutes, no accounts

```bash
git pull
git checkout claude/self-function-program-75faiq
cd server
npm install
npm start
```

Open **http://localhost:8787/demo.html** and click through it. Runs in demo mode
(sample data + simulated AI) — perfect for showing the concept.

## B) A shareable link (people open it themselves) — ~10 minutes, on Render

1. Go to **render.com** → sign in with GitHub.
2. **New → Blueprint** → pick this repo and the branch
   `claude/self-function-program-75faiq`. It reads `render.yaml`.
3. Click **Apply / Create**. Wait for the build (a few minutes).
4. You get a URL like `https://scoutfoxai.onrender.com`. Share:
   **`https://scoutfoxai.onrender.com/demo.html`**

That link works for anyone, anywhere — still demo mode until you add keys.

### Make it real (optional, when ready)
In Render → your service → **Environment**, add:
- `ANTHROPIC_API_KEY` — real Claude answers
- `SCOUTFOXGO_DATA_URL` — your live families/trips
- `LIVE_ONLY=true` — refuse to show any placeholder data
- (later) Duffel/Stripe keys for real flight search + booking

### Your own domain (optional)
Render → **Settings → Custom Domains** → add `api.scoutfox.ai`, then add the
CNAME it gives you at your DNS (IONOS). See `DEPLOY.md`.

## What to tell people while demoing
- "It returns **one confident recommendation**, not a list — with a reason and a
  confidence score."
- "**Modes** re‑plan the same place for Mom, Dad, or Grandparent."
- "**Harmony** decides for a whole group and shows who's hardest to please."
- Honest note: data + AI are simulated in demo mode, and flights are *recommended*
  not yet *bookable*.
