-- Un même appareil (endpoint) peut servir à plusieurs comptes sur le même
-- téléphone (ex. coach + sportif). On passe la clé unique de (endpoint) à
-- (user_id, endpoint) pour que chaque compte ait sa propre ligne.
alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_key;
alter table public.push_subscriptions
  add constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint);
