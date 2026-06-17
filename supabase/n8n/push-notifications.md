# Notifications push via n8n

L'envoi des rappels tourne dans **n8n** (pas dans une Edge Function). Pas de module à
installer ni de docker-compose à éditer : la seule "magie" (signature VAPID) est faite
en JavaScript natif dans un nœud Code, et on envoie **sans payload** (le texte de la
notification est défini dans `public/service-worker.js`).

## Prérequis (déjà en place côté code)

- Tables `push_subscriptions` + `notification_preferences` (migration `20260616000000_push_notifications.sql`).
- RPC `claim_due_push_subscriptions()` (migration `20260616010000_claim_due_push.sql`) — à exécuter dans le SQL Editor.
- Service worker avec écouteurs `push` / `notificationclick`.
- Front : carte "Rappels & notifications" dans le profil athlète.

## Le workflow n8n (3 nœuds)

### 1. Schedule Trigger
- Mode : *Every Minute* (ou toutes les 5 min, suffisant pour un rappel quotidien).

### 2. HTTP Request — réclamer les envois dûs
Appelle la RPC via PostgREST (utilise la clé **service_role**, pas l'anon).

- Method : `POST`
- URL : `https://supabasekong.cdocoaching.com/rest/v1/rpc/claim_due_push_subscriptions`
- Headers :
  - `apikey` : `<SERVICE_ROLE_KEY>`
  - `Authorization` : `Bearer <SERVICE_ROLE_KEY>`
  - `Content-Type` : `application/json`
- Body : `{}` (JSON)

Réponse = tableau d'abonnements dûs : `[{ endpoint, p256dh, auth, user_id }, ...]`.
(La RPC a déjà marqué ces utilisateurs comme "envoyés aujourd'hui".)

### 3. Code — signer VAPID et envoyer
Mode : *Run Once for All Items*. Colle ce code (remplace le SUBJECT par ton email) :

```js
const crypto = require('crypto');

// Clés VAPID (la publique est aussi dans src/lib/pushNotifications.ts)
const VAPID_PUBLIC  = 'BKGnX_WagdGtmaye8AXAQqEHBfFG933E9EEnNJFGOxkS1xPO2g59EUfYYYnnH5lXZAiJCGyIX9j8-UV_4UtRN_U';
const VAPID_PRIVATE = 'QW3kXWwNI7MmnHbPyTu-Ywh0eEASkXy-JC46Ga0I1SY'; // SECRET — ne le mets que dans n8n
const SUBJECT       = 'mailto:dolleycorentin2@gmail.com';

const b64urlToBuf = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const bufToB64url = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Construit la clé privée EC (JWK) à partir de la clé publique (point 0x04||x||y) + d
const pub = b64urlToBuf(VAPID_PUBLIC);
const jwk = {
  kty: 'EC', crv: 'P-256',
  x: bufToB64url(pub.subarray(1, 33)),
  y: bufToB64url(pub.subarray(33, 65)),
  d: bufToB64url(b64urlToBuf(VAPID_PRIVATE)),
};
const privateKey = crypto.createPrivateKey({ key: jwk, format: 'jwk' });

function vapidHeader(endpoint) {
  const aud = new URL(endpoint).origin;
  const enc = (o) => bufToB64url(Buffer.from(JSON.stringify(o)));
  const signingInput = enc({ typ: 'JWT', alg: 'ES256' }) + '.' +
    enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT });
  // ieee-p1363 → signature brute R||S (format attendu par JWS ES256)
  const sig = crypto.sign('sha256', Buffer.from(signingInput),
    { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${signingInput}.${bufToB64url(sig)}, k=${VAPID_PUBLIC}`;
}

const out = [];
for (const item of $input.all()) {
  const sub = item.json;
  if (!sub.endpoint) continue;
  let status = 0;
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': vapidHeader(sub.endpoint),
        'TTL': '86400',
        'Content-Length': '0',
      },
    });
    status = res.status; // 201 = OK ; 404/410 = abonnement mort
  } catch (e) {
    status = -1;
  }
  out.push({ json: { endpoint: sub.endpoint, status, dead: status === 404 || status === 410 } });
}
return out;
```

### 4. (Optionnel) HTTP Request — nettoyer les abonnements morts
Pour supprimer les endpoints expirés (status 404/410). Ajoute un *IF* (`dead == true`)
puis un HTTP Request par item :

- Method : `DELETE`
- URL : `https://supabasekong.cdocoaching.com/rest/v1/push_subscriptions?endpoint=eq.{{ encodeURIComponent($json.endpoint) }}`
- Headers : `apikey` + `Authorization: Bearer <SERVICE_ROLE_KEY>`

## Test

1. Exécute les deux migrations dans le SQL Editor.
2. Déploie l'app (le SW ne s'active qu'en prod), va sur Profil → "Activer les rappels",
   choisis une heure dans 1-2 min.
3. Lance le workflow n8n manuellement (bouton *Execute Workflow*) : le nœud Code doit
   renvoyer `status: 201`, et la notification doit apparaître.
4. Active le Schedule Trigger une fois que ça marche.

## Limite connue

Sans payload, toutes les notifications affichent le même texte (défini dans le SW).
C'est suffisant pour un rappel quotidien. Pour des messages différents par type
(Hooper / séance / etc.), il faudra chiffrer le payload → on ajoutera alors le module
`web-push` côté n8n.
