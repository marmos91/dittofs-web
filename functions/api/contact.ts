/*
 * Cloudflare Pages Function backing the PRO contact form.
 *
 * POST /api/contact  { name, email, company?, message, turnstileToken? }
 *
 * Verifies the Cloudflare Turnstile token (when configured) and delivers the
 * message by email via Resend. All secrets come from Pages environment vars:
 *   RESEND_API_KEY     - Resend API key (required to actually send)
 *   CONTACT_TO_EMAIL   - destination inbox (e.g. sales@…)
 *   CONTACT_FROM_EMAIL - verified Resend sender (defaults to onboarding@resend.dev)
 *   TURNSTILE_SECRET   - Turnstile secret; if unset, verification is skipped
 */

interface Env {
  RESEND_API_KEY?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
  TURNSTILE_SECRET?: string;
}

interface Payload {
  name?: string;
  email?: string;
  company?: string;
  message?: string;
  turnstileToken?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string | null,
): Promise<boolean> {
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim();
  const company = (payload.company || "").trim();
  const message = (payload.message || "").trim();

  if (!name || !email || !message) {
    return json({ error: "Name, email, and message are required." }, 400);
  }
  if (!isEmail(email)) {
    return json({ error: "Please provide a valid email address." }, 400);
  }
  if (message.length > 5000) {
    return json({ error: "Message is too long." }, 400);
  }

  // Bot check.
  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(
      env.TURNSTILE_SECRET,
      payload.turnstileToken || "",
      request.headers.get("CF-Connecting-IP"),
    );
    if (!ok) return json({ error: "Verification failed. Please try again." }, 400);
  }

  if (!env.RESEND_API_KEY || !env.CONTACT_TO_EMAIL) {
    // Misconfigured deployment: do not pretend it was delivered.
    return json(
      { error: "Contact form is not configured. Please email us directly." },
      500,
    );
  }

  const subject = `DittoFS PRO enquiry from ${name}${company ? ` (${company})` : ""}`;
  const text = [
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Company: ${company || "-"}`,
    "",
    message,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM_EMAIL || "DittoFS <onboarding@resend.dev>",
      to: [env.CONTACT_TO_EMAIL],
      reply_to: email,
      subject,
      text,
    }),
  });

  if (!res.ok) {
    return json({ error: "Could not send your message. Please try again." }, 502);
  }

  return json({ ok: true });
};
