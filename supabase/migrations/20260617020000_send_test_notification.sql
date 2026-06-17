-- Bouton "Tester maintenant" : insère une notif de test pour l'utilisateur courant,
-- sans condition ni anti-doublon (permet de rejouer un rappel à volonté).
create or replace function public.send_test_notification()
returns void
language plpgsql
security definer
as $$
begin
  insert into public.notification_queue (user_id, title, body, url, type)
  values (auth.uid(), 'Test', 'Notification de test ✅', '/', 'test');
end;
$$;

grant execute on function public.send_test_notification() to authenticated;
