-- =============================================================================
-- Fase 1 — sicurezza: ruoli, Row Level Security, registrazione su invito, storage
-- =============================================================================

-- Funzioni di ruolo. security definer evita la ricorsione delle policy su profiles.
create or replace function public.ruolo_corrente()
returns public.ruolo_utente language sql stable security definer set search_path = public as $$
  select ruolo from public.profiles where id = auth.uid() and attivo
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.ruolo_corrente() in ('responsabile', 'admin'), false)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.ruolo_corrente() = 'admin', false)
$$;

-- Un utente non admin non può cambiarsi ruolo, tariffa, stato o email.
-- auth.uid() nullo = SQL editor / service role (es. promozione del primo admin).
create or replace function public.proteggi_campi_profilo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.ruolo is distinct from old.ruolo
       or new.tariffa_oraria is distinct from old.tariffa_oraria
       or new.attivo is distinct from old.attivo
       or new.email is distinct from old.email then
      raise exception 'Solo un amministratore può modificare ruolo, tariffa, stato o email'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_proteggi before update on public.profiles
  for each row execute function public.proteggi_campi_profilo();

-- Alla creazione di un utente Auth: profilo con ruolo e tariffa presi dall'invito.
-- Senza invito l'utente resta disattivato finché l'admin non lo abilita.
create or replace function public.gestisci_nuovo_utente()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inv public.inviti;
begin
  select * into inv
  from public.inviti
  where lower(email) = lower(new.email) and accettato_il is null
  order by creato_il desc
  limit 1;

  insert into public.profiles (id, email, ruolo, tariffa_oraria, attivo)
  values (
    new.id,
    new.email,
    coalesce(inv.ruolo, 'collaboratore'),
    coalesce(inv.tariffa_oraria, 0),
    inv.id is not null
  );
  insert into public.profili_privati (id) values (new.id);

  if inv.id is not null then
    update public.inviti set accettato_il = now() where id = inv.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.gestisci_nuovo_utente();

-- Il collaboratore conferma o rifiuta un proprio turno proposto.
create or replace function public.rispondi_turno(p_turno_id uuid, p_accetta boolean, p_motivo text default null)
returns public.turni language plpgsql security definer set search_path = public as $$
declare
  t public.turni;
begin
  select * into t from public.turni where id = p_turno_id for update;
  if not found or t.collaboratore_id <> auth.uid() then
    raise exception 'Turno non trovato' using errcode = 'P0002';
  end if;
  if t.stato <> 'proposto' then
    raise exception 'Hai già risposto a questo turno: per cambiare contatta il responsabile'
      using errcode = '22023';
  end if;

  update public.turni
  set stato = case when p_accetta then 'confermato'::public.stato_turno else 'rifiutato'::public.stato_turno end,
      motivo_rifiuto = case when p_accetta then null else nullif(trim(p_motivo), '') end,
      risposto_il = now()
  where id = p_turno_id
  returning * into t;
  return t;
end $$;

revoke execute on function public.rispondi_turno(uuid, boolean, text) from public, anon;
grant execute on function public.rispondi_turno(uuid, boolean, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.profili_privati enable row level security;
alter table public.inviti          enable row level security;
alter table public.impostazioni    enable row level security;
alter table public.eventi          enable row level security;
alter table public.turni           enable row level security;
alter table public.audit_log       enable row level security;

-- profiles: ognuno vede sé stesso; responsabili e admin vedono il roster
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- profili_privati: solo proprietario e admin (IBAN, codice fiscale, ecc.)
create policy privati_select on public.profili_privati for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy privati_update on public.profili_privati for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- inviti: solo admin (la creazione passa dalla Edge Function invita-utente)
create policy inviti_admin on public.inviti for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- impostazioni: lettura a tutti gli utenti autenticati, modifica solo admin
create policy impostazioni_select on public.impostazioni for select to authenticated using (true);
create policy impostazioni_update on public.impostazioni for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- eventi: lo staff gestisce; il collaboratore vede solo gli eventi in cui ha un turno
create policy eventi_select on public.eventi for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.turni t where t.evento_id = eventi.id and t.collaboratore_id = auth.uid())
  );
create policy eventi_insert on public.eventi for insert to authenticated with check (public.is_staff());
create policy eventi_update on public.eventi for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy eventi_delete on public.eventi for delete to authenticated using (public.is_staff());

-- turni: il collaboratore legge i propri (risponde via rispondi_turno), lo staff gestisce
create policy turni_select on public.turni for select to authenticated
  using (collaboratore_id = auth.uid() or public.is_staff());
create policy turni_insert on public.turni for insert to authenticated with check (public.is_staff());
create policy turni_update on public.turni for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy turni_delete on public.turni for delete to authenticated using (public.is_staff());

-- audit_log: sola lettura per l'admin; scrive solo il trigger
create policy audit_admin on public.audit_log for select to authenticated using (public.is_admin());

-- Niente accesso anonimo ai dati
revoke all on all tables in schema public from anon;

-- -----------------------------------------------------------------------------
-- Storage: foto profilo in bucket privato, cartella = id utente
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-profilo', 'foto-profilo', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy foto_lettura on storage.objects for select to authenticated
  using (bucket_id = 'foto-profilo'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
create policy foto_caricamento on storage.objects for insert to authenticated
  with check (bucket_id = 'foto-profilo' and (storage.foldername(name))[1] = auth.uid()::text);
create policy foto_modifica on storage.objects for update to authenticated
  using (bucket_id = 'foto-profilo' and (storage.foldername(name))[1] = auth.uid()::text);
create policy foto_eliminazione on storage.objects for delete to authenticated
  using (bucket_id = 'foto-profilo' and (storage.foldername(name))[1] = auth.uid()::text);
