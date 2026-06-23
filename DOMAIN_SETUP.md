# Get scoutfoxai.com live (custom domain)

Do this **after** the app is deployed (see `DEPLOY_RENDER.md`). Deploying gives you
a working `https://scoutfoxai.onrender.com` first; the custom domain just maps your
own name onto it.

## Order of operations
1. App must be deployed and live on Render (`…onrender.com` works).
2. Tell Render about your domain → it gives you DNS records.
3. Add those records at your domain registrar.
4. SSL auto-issues → `https://scoutfoxai.com` is live.

## Step 1 — Add the domain in Render
Render → your `scoutfoxai` service → **Settings → Custom Domains → Add Custom Domain**
- Add **`scoutfoxai.com`** (root/apex)
- Add **`www.scoutfoxai.com`** (Render will redirect one to the other)

Render then displays the **exact records to create**, typically:
- Root `scoutfoxai.com` → an **A record** to a Render IP (Render shows the value), or
  an **ALIAS/ANAME** to `scoutfoxai.onrender.com` if your registrar supports it.
- `www` → a **CNAME** to `scoutfoxai.onrender.com`.

Use the values Render shows you — they're authoritative.

## Step 2 — Add the records at your registrar
Log into wherever **scoutfoxai.com** is registered and open its **DNS** settings.

### If it's at IONOS
- Domains → `scoutfoxai.com` → **DNS**.
- Add the **A record** (host `@`) with the IP Render gave you.
- Add a **CNAME** (host `www`) pointing to `scoutfoxai.onrender.com`.
- Save. (IONOS supports ALIAS-style records too; if Render offers an ANAME/ALIAS for
  the apex, prefer that over the A record.)

### If it's at Squarespace (domains)
- Settings → Domains → `scoutfoxai.com` → **DNS Settings**.
- Add the **A record** (host `@`) → Render's IP.
- Add the **CNAME** (host `www`) → `scoutfoxai.onrender.com`.
- Remove any conflicting default A/CNAME records Squarespace parked there.

> Not sure which registrar holds it? Check your domain receipts/emails, or run
> `whois scoutfoxai.com` — the "Registrar" line tells you.

## Step 3 — Wait + verify
- DNS propagation: usually minutes, up to a few hours.
- Render auto-provisions a free SSL cert once it sees the records → the domain flips
  to "Certificate issued."
- Verify: open **https://scoutfoxai.com/api/status** and **https://scoutfoxai.com/assistant.html**.

## Step 4 — Lock in CORS
Render → Environment → set:
```
ALLOWED_ORIGINS=https://scoutfoxai.com,https://www.scoutfoxai.com
```
Save (auto-redeploys). This is what lets your front-end / other sites call the API
cross-domain safely.

## Two-domain note
- **scoutfoxai.com** → this AI backend/app (what you're setting up here).
- **scoutfoxgo.com** → the separate marketing/consumer site (keep it on its own host;
  it can call this API once `ALLOWED_ORIGINS` includes it).

You can also use **`api.scoutfox.ai`** for the API and keep `scoutfoxai.com` for a
landing page — same steps, just a `CNAME` for `api` → `scoutfoxai.onrender.com`.
