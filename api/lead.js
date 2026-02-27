export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {}
  }

  // Honeypot: wenn ausgefüllt -> Spam, still ok antworten
  if (body.website) return res.status(200).json({ ok: true });

  const type = (body.type || "").trim();
  const email = (body.email || "").trim();
  const message = (body.message || "").trim();

  if (!type || !email || (type === "contact" && !message)) {
    return res.status(400).json({ ok: false, error: "Missing fields" });
  }

  const SCRIPT_URL = process.env.GS_SCRIPT_URL;   // .../exec
  const SECRET_KEY = process.env.GS_SECRET_KEY;   // neuer Secret

  if (!SCRIPT_URL || !SECRET_KEY) {
    return res.status(500).json({ ok: false, error: "Server not configured" });
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "";
  const ua = req.headers["user-agent"] || "";

  const payload = new URLSearchParams({
    key: SECRET_KEY,
    type,
    barname: (body.barname || "").trim(),
    location: (body.location || "").trim(),
    email,
    phone: (body.phone || "").trim(),
    region: (body.region || "Zürich").trim(),
    pilot: (body.pilot || "").trim(),
    message,
    ip,
    ua,
  });

  const r = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });

  const text = await r.text();
  if (!r.ok || text.includes("Unauthorized") || text.includes("RateLimited")) {
    return res.status(502).json({ ok: false, error: "Upstream blocked", detail: text });
  }

  return res.status(200).json({ ok: true });
}