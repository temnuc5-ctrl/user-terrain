/**
 * Worker Cloudflare HSELY — stockage des photos dans R2.
 *
 *   POST /upload   corps = image JPEG/PNG/WebP, en-têtes X-Secteur / X-Unite
 *   GET  /photo/*  renvoie l'image depuis R2
 *   GET  /health   vérification de déploiement
 *
 * Le bucket R2 reste privé : aucune URL R2 publique n'est nécessaire, et
 * l'egress passe par le Worker (gratuit dans le quota Workers).
 */

const CORS_MAX_AGE = '86400';
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function cors(env, request) {
  const origine = request.headers.get('Origin') || '';
  // Liste séparée par des virgules : site Netlify + APK Capacitor (https://localhost).
  const autorisees = String(env.ALLOWED_ORIGIN || '*')
    .split(',')
    .map((valeur) => valeur.trim())
    .filter(Boolean);
  const valeur = autorisees.includes('*')
    ? '*'
    : autorisees.includes(origine)
      ? origine
      : autorisees[0] || '*';
  return {
    'Access-Control-Allow-Origin': valeur,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-File-Name, X-Secteur, X-Unite',
    'Access-Control-Max-Age': CORS_MAX_AGE,
    'Access-Control-Expose-Headers': 'Content-Length, ETag',
    Vary: 'Origin',
  };
}

function json(corps, headers, status = 200) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

const nettoyer = (valeur) =>
  String(valeur || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'inconnu';

function autorise(request, env) {
  if (!env.APP_TOKEN) return true;
  const entete = request.headers.get('Authorization') || '';
  return entete === `Bearer ${env.APP_TOKEN}`;
}

async function upload(request, env, headers) {
  if (!autorise(request, env)) return json({ error: 'unauthorized' }, headers, 401);

  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  const extension = TYPES[type];
  if (!extension) return json({ error: 'type_non_autorise', types: Object.keys(TYPES) }, headers, 415);

  const annonce = Number(request.headers.get('Content-Length') || 0);
  if (annonce > MAX_BYTES) return json({ error: 'fichier_trop_lourd', max: MAX_BYTES }, headers, 413);

  const corps = await request.arrayBuffer();
  if (!corps.byteLength) return json({ error: 'fichier_vide' }, headers, 400);
  if (corps.byteLength > MAX_BYTES) return json({ error: 'fichier_trop_lourd', max: MAX_BYTES }, headers, 413);

  const secteur = nettoyer(decodeURIComponent(request.headers.get('X-Secteur') || ''));
  const unite = nettoyer(decodeURIComponent(request.headers.get('X-Unite') || ''));
  const nom = nettoyer(decodeURIComponent(request.headers.get('X-File-Name') || 'photo').replace(/\.[^.]+$/, ''));
  const cle = `${secteur}/${unite}/${Date.now()}-${crypto.randomUUID()}-${nom}.${extension}`;

  await env.PHOTOS.put(cle, corps, {
    httpMetadata: {
      contentType: type,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, '');
  return json(
    { url: `${base}/photo/${cle}`, key: cle, size: corps.byteLength },
    headers,
    201,
  );
}

async function photo(url, env, headers) {
  const cle = decodeURIComponent(url.pathname.slice('/photo/'.length));
  if (!cle) return new Response('Not found', { status: 404, headers });

  const objet = await env.PHOTOS.get(cle);
  if (!objet) return new Response('Not found', { status: 404, headers });

  const entetes = new Headers(headers);
  objet.writeHttpMetadata(entetes);
  entetes.set('Cache-Control', 'public, max-age=31536000, immutable');
  entetes.set('ETag', objet.httpEtag);
  return new Response(objet.body, { headers: entetes });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = cors(env, request);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    try {
      if (url.pathname === '/health') {
        return json({ ok: true, service: 'hsely-photos', bucket: env.PHOTOS ? 'ok' : 'absent' }, headers);
      }
      if (url.pathname === '/upload' && request.method === 'POST') {
        return await upload(request, env, headers);
      }
      if (request.method === 'GET' && url.pathname.startsWith('/photo/')) {
        return await photo(url, env, headers);
      }
      return json({ error: 'not_found' }, headers, 404);
    } catch (erreur) {
      return json({ error: 'worker_error', message: String(erreur?.message || erreur) }, headers, 500);
    }
  },
};
