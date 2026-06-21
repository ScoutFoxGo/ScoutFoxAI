# Scout Fox Go — Vendor Access (the safe way)

**Principle: invite, don't share.** Do not put real passwords on a shared sheet,
and never share the password to an account you own — especially email. Every
service below lets you add a collaborator by **inviting *their* email address**
with a **scoped, revocable role**. That gives the vendor what they need to work
while you keep ownership and can cut access instantly when the engagement ends.

**What to ask the vendor for:** the **email address they want invited** to each
service (often one Google account for the Google services). That's it. If a
request is instead "give me your password / your Gmail," decline — it isn't
required for any platform here.

**Before granting anything:**
- Turn on **2FA** on every account (Gmail/Google first — it's the master key).
- If any password was already shared, **reset it**.
- Grant the **least** role that works (Developer/Editor — never Owner/root).

---

## Per‑service: do this instead of sharing a password

| Service | Safe method | Role to give |
|---|---|---|
| **AWS** (acct 251424476512) | IAM → create a user **or** invite via IAM Identity Center | Least‑privilege policy; **never** root |
| **Google Cloud** | IAM & Admin → Grant access → add **vendor's email** | Editor or a specific role |
| **Firebase** | Project settings → Users and permissions → add **vendor's email** | Editor |
| **Google Play Console** | Users and permissions → Invite **vendor's email** | Limited (no financial/release unless needed) |
| **Pinecone** | Org/project → Members → invite **vendor's email** | Member |
| **Stripe** | Settings → Team → invite **vendor's email** | Developer (✅ they asked correctly) |
| **Twilio** | Issue an **API Key** (SID + secret) for the app; or add a user | API key, or limited user |
| **Squarespace** | Settings → Permissions → invite **vendor's email** | Administrator or Website Editor |
| **IONOS** | Account → user management / contract user; or delegate the domain | Scoped sub‑user |
| **Booking.com Partner Hub** | Account → user management → invite **vendor's email** | Limited |

> The checklist's notes that say *"Grant access to meghan.hotchkiss@gmail.com / info@scoutfoxgo.com"* are backwards — those are **your** accounts. You don't grant access *to* your own email; you invite **the vendor's** email *into* the project.

---

## App credentials that belong in the server, not a person

For the parts the code actually consumes, generate **API keys / service
accounts** scoped to the app and put them in environment variables on the host
(see `server/.env.example`) — not in a person's inbox:

- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` (the AI stack)
- `DUFFEL_API_KEY` / `KAYAK_API_KEY` / `PHPTRAVELS_API_KEY` / Booking.com key (inventory)
- `SCOUTFOXGO_DATA_URL` (your live data endpoint)
- Stripe, Twilio, Firebase, Pinecone keys/service accounts

These can be **rotated or revoked** without touching anyone's login, and they
keep the secret in the app where it belongs.

---

## If passwords were already written into a shared "credentials" doc

Treat every real password in that file as **exposed** — you can't un‑share a
document. Do this in order:

1. **Protect the Gmail first** (`meghan.hotchkiss@gmail.com`) — it's the master
   key to IONOS, Google Cloud, Firebase, and Play Console:
   - New unique password.
   - 2FA via an **authenticator app** (Google Authenticator/Authy), not SMS.
   - Google Account → Security → check **Recovery email/phone** and **"3rd‑party
     access"** for anything you don't recognize; remove it.
   - Gmail → Settings → **Forwarding and POP/IMAP** → confirm no unknown
     forwarding address was added.
   - Review **recent security activity / signed‑in devices**; sign out unknowns.
2. **Rotate every real password** that appeared in the doc (AWS, Squarespace,
   Google Cloud, and any others) — change them now, even if nothing looks wrong.
3. **Stop sharing the doc.** Delete shared copies. Replace it with invite‑based
   access (the table above) — that needs no password file at all.
4. **Never forward a verification / 2FA code to anyone.** A code request is the
   one instruction to refuse outright; no platform's delegated access needs it.
5. Where the app (not a person) needs access, switch to **API keys / service
   accounts in env vars** that you can rotate or revoke independently.

## Red flags to watch for

- "I need your **Gmail password** / your email login." → Never required. Decline.
- "Put all passwords on this **shared sheet**." → Use per‑service invites instead.
- Requests for **Owner/root** when Developer/Editor would do.
- A checklist that collects **your** passwords rather than asking for **their**
  email to invite.

None of this means a vendor is acting in bad faith — but invite‑based access is
the correct, lower‑risk way to grant it regardless of who's asking, and it keeps
you in control of the company's accounts.
