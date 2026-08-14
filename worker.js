const MODEL = 'gemini-2.5-flash';
const MAX_DAILY = 3;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function visitorKey(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const bytes = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function generate(request, env) {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  if (!env.GEMINI_API_KEY) return json({ error: 'La clé Gemini n’est pas configurée.' }, 500);
  if (!env.RATE_LIMIT) return json({ error: 'Le compteur quotidien n’est pas configuré.' }, 500);

  let input;
  try { input = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const topic = String(input.topic || '').trim();
  if (topic.length < 5 || topic.length > 1000) return json({ error: 'Décrivez un sujet entre 5 et 1000 caractères.' }, 400);

  const key = `daily:${new Date().toISOString().slice(0, 10)}:${await visitorKey(request)}`;
  const used = Number(await env.RATE_LIMIT.get(key) || 0);
  if (used >= MAX_DAILY) return json({ error: 'Vous avez atteint vos 3 générations gratuites pour aujourd’hui. Revenez demain.' }, 429);

  const prompt = `Tu es un expert du marketing digital pour l’Algérie et le Maghreb. Crée une publication prête à publier.
Plateforme : ${input.platform || 'Facebook'}
Langue : ${input.language || 'français'}
Type : ${input.type || 'Conseil pratique'}
Ton : ${input.tone || 'Simple et naturel'}
Sujet ou produit : ${topic}
Public cible : ${input.audience || 'public francophone en Algérie'}

Règles : écris un texte naturel, utile et précis. N’invente aucun prix, résultat, adresse ou promotion. Ajoute une accroche, le corps du texte, un appel à l’action et 5 hashtags pertinents. N’explique pas ta méthode et ne mets pas de balises Markdown inutiles.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
  });
  if (!response.ok) return json({ error: 'Gemini est temporairement indisponible. Réessayez dans quelques instants.' }, 502);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!text) return json({ error: 'Gemini n’a pas retourné de contenu.' }, 502);

  await env.RATE_LIMIT.put(key, String(used + 1), { expirationTtl: 172800 });
  return json({ text, remaining: MAX_DAILY - used - 1 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/generer-contenu') return generate(request, env);
    return env.ASSETS.fetch(request);
  }
};
