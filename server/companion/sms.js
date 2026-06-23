// sms.js — send Scout Companion alerts by SMS (Twilio).
//
// Live when TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER are set;
// returns a labelled simulated result otherwise (so the flow works offline and in
// dev). No SDK — uses Twilio's REST API via fetch.

const TIMEOUT_MS = 9000;

export async function sendSMS(to, body) {
  if (!to) throw new Error("`to` phone number required");
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    return { sent: false, simulated: true, to, body, note: "Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER) — message not actually sent." };
  }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
      signal: ac.signal,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Twilio ${r.status}: ${j.message || "error"}`);
    return { sent: true, simulated: false, sid: j.sid, status: j.status, to };
  } finally {
    clearTimeout(t);
  }
}
