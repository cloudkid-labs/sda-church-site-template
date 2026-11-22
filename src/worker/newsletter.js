const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

async function verifyToken(token, secret, remoteIp, hostnames) {
  if (!token || token.length > 2048 || !secret || hostnames.length === 0) return false;
  try {
    const body = new FormData();
    body.set('secret', secret);
    body.set('response', token);
    if (remoteIp) body.set('remoteip', remoteIp);
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true
      && result.action === 'newsletter'
      && typeof result.hostname === 'string'
      && hostnames.includes(result.hostname);
  } catch {
    return false;
  }
}

export async function handleNewsletter(request, env) {
  const listId = Number(env.NEWSLETTER_LIST_ID);
  const configured = Boolean(
    env.BREVO_API_KEY
    && Number.isSafeInteger(listId)
    && listId > 0
    && env.TURNSTILE_SECRET_KEY
    && env.TURNSTILE_HOSTNAMES
    && env.NEWSLETTER_RATE_LIMITER,
  );
  if (request.method === 'GET') return json({ enabled: configured });
  if (request.method !== 'POST') return json({ ok: false }, 405);
  if (!configured) return json({ ok: false }, 503);

  const ip = request.headers.get('cf-connecting-ip');
  if (!ip) return json({ ok: false }, 400);
  try {
    if (!(await env.NEWSLETTER_RATE_LIMITER.limit({ key: ip })).success) return json({ ok: false }, 429);
  } catch {
    return json({ ok: false }, 503);
  }

  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ ok: false }, 400);
  const raw = await request.text();
  if (raw.length > 4096) return json({ ok: false }, 400);
  let payload;
  try { payload = JSON.parse(raw); } catch { return json({ ok: false }, 400); }
  if (!payload || typeof payload.email !== 'string' || typeof payload.token !== 'string' || payload.consent !== true) {
    return json({ ok: false }, 400);
  }
  const email = payload.email.trim();
  if (email.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return json({ ok: false }, 400);

  const hostnames = env.TURNSTILE_HOSTNAMES.split(',').map((host) => host.trim()).filter(Boolean);
  if (!await verifyToken(payload.token, env.TURNSTILE_SECRET_KEY, ip, hostnames)) return json({ ok: false }, 400);
  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ email, listIds: [listId], updateEnabled: true }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return json({ ok: false }, 502);
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 502);
  }
}
