# Credential Rotation Worklist

Because real passwords for ~10 services ended up in a shared document, treat them
all as exposed and run this list top to bottom. Order matters: the Google
account first, because it unlocks most of the others.

**One rule throughout:** never share a new password and never forward a 2FA /
verification code. Where a developer needs access, **invite their email** with a
scoped role (see `ACCESS.md`).

---

## 0. Google account FIRST — `meghan.hotchkiss@gmail.com`
This single login is the master key to IONOS, Google Cloud, Stripe, Twilio,
Booking.com, Pinecone, and Firebase. Fix it before anything else.

- [ ] myaccount.google.com → **Security → Password** → set a new unique password
- [ ] **2‑Step Verification → Authenticator app** (turn off SMS‑only if possible)
- [ ] **Security Checkup** → review **recovery email + phone**; remove anything unfamiliar
- [ ] Gmail → **Settings → Forwarding and POP/IMAP** and **Filters** → remove unknown forwarding/filters
- [ ] **Your devices** → sign out any session you don't recognize
- [ ] **Third‑party access / app passwords** → revoke anything you didn't set up

## 1. AWS — `info@scoutfoxgo.com` (acct 251424476512)
- [ ] Sign in → **reset the root password**; enable MFA on root
- [ ] Create an **IAM user/role** for the dev (least privilege) — don't share root
- [ ] Issue **access keys** only if the app needs them (rotate/revoke anytime)

## 2. Squarespace
- [ ] Reset password
- [ ] **Settings → Permissions → invite the dev's email** (Administrator/Editor)

## 3. Google Cloud — (Google login, covered by step 0)
- [ ] Confirm new Google password works
- [ ] **IAM & Admin → Grant access → add the dev's email** (specific role)
- [ ] Rotate any **service‑account keys** that were shared

## 4. Stripe — (Google login)
- [ ] Confirm access
- [ ] **Settings → Team → invite the dev's email** (Developer role)
- [ ] ⚠️ Do **not** wait for / forward the "security hold" verification code

## 5. Twilio
- [ ] Reset password
- [ ] Issue an **API key (SID + secret)** for the app; or add a scoped user
- [ ] Rotate the **Auth Token** if it was shared

## 6. Booking.com Partner Hub
- [ ] Reset password
- [ ] **User management → invite the dev's email**
- [ ] ⚠️ Do **not** forward the login verification code

## 7. Pinecone — (Google login)
- [ ] Confirm access
- [ ] **Members → invite the dev's email** to the org/project
- [ ] Rotate the **Pinecone API key** if it was shared

## 8. Firebase — (Google login)
- [ ] Confirm access
- [ ] **Project settings → Users and permissions → add the dev's email** (Editor)
- [ ] Do **not** grant via your Google password — invite their email instead

## 9. Google Play Console — `info@scoutfoxgo.com`
- [ ] Confirm access
- [ ] **Users and permissions → invite the dev's email** (limited perms)

## 10. Finish
- [ ] **Delete every shared copy** of the credentials document
- [ ] Move any app secrets into **environment variables** on the host (see `server/.env.example`)
- [ ] Confirm each dev can work via their **own invited login** — then you're done
