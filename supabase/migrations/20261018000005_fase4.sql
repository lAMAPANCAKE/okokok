-- =============================================================================
-- Fase 4 — disponibilità, valutazioni post-evento, notifiche push, report margini
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Disponibilità: i giorni in cui il collaboratore NON è disponibile
-- -----------------------------------------------------------------------------
create table public.indisponibilita (
  id                uuid primary key default gen_random_uuid(),
  collaboratore_id  uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  data              date not null,
  nota              text,
  created_at        timestamptz not null default now(),
  unique (collaboratore_id, data)
);
create index indisponibilita_data on public.indisponibilita (data);

-- Avvisa chi ha creato l'evento se un collaboratore si segna indisponibile
-- in un giorno in cui ha già un turno proposto o confermato
create or replace function public.avvisa_indisponibilita()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t record;
  chi text;
begin
  select trim(nome || ' ' || cognome) into chi from public.profiles where id = new.collaboratore_id;
  for t in
    select tu.id, e.nome, e.creato_da
    from public.turni tu join public.eventi e on e.id = tu.evento_id
    where tu.collaboratore_id = new.collaboratore_id and tu.data = new.data and tu.stato in ('proposto', 'confermato')
  loop
    if t.creato_da is not null then
      perform public.notifica(t.creato_da, 'indisponibilita',
        coalesce(chi, 'Un collaboratore') || ' non è più disponibile',
        to_char(new.data, 'DD/MM') || ' · ' || t.nome || coalesce(' · ' || new.nota, ''),
        '/eventi', 'ind:' || new.id || ':' || t.id);
    end if;
  end loop;
  return new;
end $$;

create trigger indisponibilita_avviso after insert on public.indisponibilita
  for each row execute function public.avvisa_indisponibilita();

-- -----------------------------------------------------------------------------
-- Valutazioni post-evento (uso interno dello staff)
-- -----------------------------------------------------------------------------
create table public.valutazioni (
  id                uuid primary key default gen_random_uuid(),
  evento_id         uuid not null references public.eventi (id) on delete cascade,
  collaboratore_id  uuid not null references public.profiles (id) on delete cascade,
  punteggio         smallint not null check (punteggio between 1 and 5),
  note              text,
  valutato_da       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (evento_id, collaboratore_id)
);
create index valutazioni_collaboratore on public.valutazioni (collaboratore_id);
create trigger valutazioni_updated_at before update on public.valutazioni
  for each row execute function public.set_updated_at();

-- Si valuta solo chi ha davvero lavorato all'evento
create or replace function public.valutazione_valida()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.turni
    where evento_id = new.evento_id and collaboratore_id = new.collaboratore_id and stato in ('confermato', 'completato')
  ) then
    raise exception 'Si può valutare solo chi ha lavorato all''evento' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger valutazioni_valida before insert or update on public.valutazioni
  for each row execute function public.valutazione_valida();

create view public.valutazioni_medie with (security_invoker = true) as
select collaboratore_id,
       round(avg(punteggio), 1) as media,
       count(*)::int as valutazioni,
       max(created_at) as ultima
from public.valutazioni
group by collaboratore_id;

-- -----------------------------------------------------------------------------
-- Notifiche push (Web Push): iscrizioni per dispositivo
-- -----------------------------------------------------------------------------
create table public.push_iscrizioni (
  id          uuid primary key default gen_random_uuid(),
  utente_id   uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  dispositivo text,
  created_at  timestamptz not null default now()
);
create index push_iscrizioni_utente on public.push_iscrizioni (utente_id);

-- A ogni notifica in-app corrisponde un push, se configurato:
-- servono pg_net e due segreti nel Vault ('push_url' e 'push_secret', vedi README).
-- Senza configurazione il trigger non fa nulla e le notifiche restano solo in-app.
create or replace function public.invia_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  url text;
  segreto text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regproc('net.http_post') is null then
    return new;
  end if;
  if not exists (select 1 from public.push_iscrizioni where utente_id = new.utente_id) then
    return new;
  end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'push_url'$q$ into url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'push_secret'$q$ into segreto;
  if url is null or segreto is null then
    return new;
  end if;
  execute $q$select net.http_post(url := $1, body := $2, headers := $3)$q$
    using url,
          jsonb_build_object('utente_id', new.utente_id, 'titolo', new.titolo, 'testo', new.testo, 'link', new.link, 'id', new.id),
          jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', segreto);
  return new;
exception when others then
  -- Un problema del push non deve mai impedire la notifica in-app
  raise warning 'invio push non riuscito: %', sqlerrm;
  return new;
end $$;

create trigger notifiche_push after insert on public.notifiche
  for each row execute function public.invia_push();

-- -----------------------------------------------------------------------------
-- Report economico per evento: ricavo dal preventivo accettato,
-- costi reali (compensi registrati + rimborsi approvati) e margine
-- -----------------------------------------------------------------------------
create view public.report_eventi with (security_invoker = true) as
select
  e.id as evento_id,
  e.nome,
  e.data,
  e.stato,
  e.azienda_id,
  p.id as preventivo_id,
  p.numero as preventivo_numero,
  coalesce(pt.imponibile, 0) as ricavo,
  coalesce(pt.costo, 0) as costo_preventivato,
  coalesce((select sum(t.compenso_lordo) from public.turni t where t.evento_id = e.id and t.stato = 'completato'), 0) as costo_personale,
  coalesce((select sum(t.ore_totali) from public.turni t where t.evento_id = e.id and t.stato = 'completato'), 0) as ore_lavorate,
  coalesce((select sum(r.importo) from public.rimborsi r where r.evento_id = e.id and r.stato in ('approvato', 'rimborsato')), 0) as costo_rimborsi,
  (select count(*) from public.turni t where t.evento_id = e.id and t.stato = 'confermato')::int as turni_senza_ore
from public.eventi e
left join lateral (
  select pr.id, pr.numero from public.preventivi pr
  where pr.evento_id = e.id and pr.stato = 'accettato'
  order by pr.data_esito desc nulls last limit 1
) p on true
left join public.preventivi_totali pt on pt.preventivo_id = p.id;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.indisponibilita enable row level security;
alter table public.valutazioni     enable row level security;
alter table public.push_iscrizioni enable row level security;

-- indisponibilità: ognuno gestisce le proprie, lo staff le legge per assegnare i turni
create policy indisponibilita_select on public.indisponibilita for select to authenticated
  using (collaboratore_id = auth.uid() or public.is_staff());
create policy indisponibilita_insert on public.indisponibilita for insert to authenticated
  with check (collaboratore_id = auth.uid());
create policy indisponibilita_update on public.indisponibilita for update to authenticated
  using (collaboratore_id = auth.uid()) with check (collaboratore_id = auth.uid());
create policy indisponibilita_delete on public.indisponibilita for delete to authenticated
  using (collaboratore_id = auth.uid());

-- valutazioni: solo staff (il collaboratore non vede i giudizi)
create policy valutazioni_staff on public.valutazioni for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- push: ognuno gestisce i propri dispositivi
create policy push_proprie on public.push_iscrizioni for all to authenticated
  using (utente_id = auth.uid()) with check (utente_id = auth.uid());

revoke all on public.indisponibilita, public.valutazioni, public.push_iscrizioni from anon;
