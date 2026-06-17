# Notifications push via n8n (avec payload chiffré)

Architecture en file d'attente (outbox) :
- `notification_queue` = notifs à envoyer (titre, body, url, type, user_id).
- Événements (nouvelle semaine, messages…) → insèrent une ligne depuis l'app.
- Rappels conditionnels (Hooper, pesée…) → `enqueue_due_reminders()` les insère.
- n8n vide la file (`claim_pending_notifications()`), chiffre le payload, envoie.

## Prérequis n8n
Variable d'environnement du service n8n (Coolify) :
```
NODE_FUNCTION_ALLOW_BUILTIN=crypto,https
```
(puis redémarrer n8n)

## Migrations à exécuter (SQL Editor)
- `20260616000000_push_notifications.sql` (tables abonnements + préférences)
- `20260617000000_notification_queue.sql` (file + RPC `claim_pending_notifications` + `enqueue_due_reminders`)

## Workflow n8n (4 nœuds)

### 1. Schedule Trigger — Every Minute

### 2. HTTP Request — alimenter la file (rappels conditionnels)
- POST `https://supabasekong.cdocoaching.com/rest/v1/rpc/enqueue_due_reminders`
- Headers : `apikey` + `Authorization: Bearer <SERVICE_ROLE_KEY>` + `Content-Type: application/json`
- Body JSON : `{}`

### 3. HTTP Request — vider la file
- POST `https://supabasekong.cdocoaching.com/rest/v1/rpc/claim_pending_notifications`
- Mêmes headers. Body JSON : `{}`
- Renvoie : `[{ id, endpoint, p256dh, auth, title, body, url }, ...]`

### 4. Code — chiffrer (aes128gcm) + signer VAPID + envoyer
Mode *Run Once for All Items*. Remplace `SUBJECT` par ton email.

```js
const crypto = require('crypto');
const https = require('https');

const VAPID_PUBLIC  = 'BKGnX_WagdGtmaye8AXAQqEHBfFG933E9EEnNJFGOxkS1xPO2g59EUfYYYnnH5lXZAiJCGyIX9j8-UV_4UtRN_U';
const VAPID_PRIVATE = 'QW3kXWwNI7MmnHbPyTu-Ywh0eEASkXy-JC46Ga0I1SY';
const SUBJECT       = 'mailto:dolleycorentin2@gmail.com';

const b64urlToBuf = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const bufToB64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

const pub = b64urlToBuf(VAPID_PUBLIC);
const jwk = { kty: 'EC', crv: 'P-256', x: bufToB64url(pub.subarray(1, 33)), y: bufToB64url(pub.subarray(33, 65)), d: bufToB64url(b64urlToBuf(VAPID_PRIVATE)) };
const vapidKey = crypto.createPrivateKey({ key: jwk, format: 'jwk' });

function vapidHeader(origin) {
  const enc = (o) => bufToB64url(Buffer.from(JSON.stringify(o)));
  const si = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud: origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT });
  const sig = crypto.sign('sha256', Buffer.from(si), { key: vapidKey, dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + si + '.' + bufToB64url(sig) + ', k=' + VAPID_PUBLIC;
}

function encrypt(p256dh, auth, plaintext) {
  const uaPub = b64urlToBuf(p256dh);
  const authSecret = b64urlToBuf(auth);
  const payload = Buffer.from(plaintext, 'utf8');
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPub);
  const salt = crypto.randomBytes(16);
  const prkKey = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]);
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const record = Buffer.concat([payload, Buffer.from([2])]);
  const ct = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.concat([salt, Buffer.from([0, 0, 0x10, 0]), Buffer.from([asPub.length]), asPub]);
  return Buffer.concat([header, ct]);
}

function send(endpoint, headers, body) {
  return new Promise((resolve) => {
    const m = endpoint.match(/^https:\/\/([^\/]+)(\/.*)$/);
    const req = https.request({ hostname: m[1], path: m[2], method: 'POST', headers }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', () => resolve(-1));
    if (body) req.write(body);
    req.end();
  });
}

const out = [];
for (const item of $input.all()) {
  const j = item.json;
  if (!j.endpoint) continue;
  const origin = j.endpoint.match(/^(https?:\/\/[^\/]+)/)[1];
  const payload = JSON.stringify({ title: j.title, body: j.body, url: j.url });
  const body = encrypt(j.p256dh, j.auth, payload);
  const headers = {
    'Authorization': vapidHeader(origin),
    'Content-Encoding': 'aes128gcm',
    'Content-Length': body.length,
    'TTL': '86400',
  };
  const status = await send(j.endpoint, headers, body);
  out.push({ json: { id: j.id, status, dead: status === 404 || status === 410 } });
}
return out;
```

`status` attendu : **201**. La notif affiche alors `title` + `body` et ouvre `url` au clic.

## Test
1. Migrations exécutées + `NODE_FUNCTION_ALLOW_BUILTIN=crypto,https` + n8n redémarré.
2. Côté app : rappels activés, heure passée, questionnaire NON rempli, `last_sent_at = null`.
3. Execute Workflow → nœud 4 doit renvoyer `status: 201` et la notif arrive avec son vrai texte.
