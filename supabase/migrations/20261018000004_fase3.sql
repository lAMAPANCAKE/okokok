-- =============================================================================
-- Fase 3 — CRM aziende e follow-up, preventivi con voci e margini, sopralluoghi
-- Tutto riservato a responsabili e admin.
-- =============================================================================

create type public.stato_pipeline as enum ('da_contattare', 'contattato', 'in_trattativa', 'cliente_attivo', 'perso');
create type public.stato_preventivo as enum ('bozza', 'inviato', 'accettato', 'rifiutato', 'perso');
create type public.tipo_voce as enum ('personale', 'servizio', 'altro');

-- Dati dell'azienda che emette i preventivi (vuoti finché l'admin non li compila)
alter table public.impostazioni
  add column ragione_sociale            text,
  add column indirizzo_sede             text,
  add column partita_iva                text,
  add column email_commerciale          text,
  add column telefono_commerciale       text,
  add column condizioni_preventivo      text,
  add column iva_predefinita            numeric(5,2) not null default 22 check (iva_predefinita >= 0),
  add column validita_preventivo_giorni integer not null default 30 check (validita_preventivo_giorni > 0);

-- -----------------------------------------------------------------------------
-- CRM aziende
-- -----------------------------------------------------------------------------
create table public.aziende (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(trim(nome)) > 0),
  settore         text,
  referente       text,
  ruolo_referente text,
  email           text,
  telefono        text,
  indirizzo       text,
  partita_iva     text,
  note            text,
  stato_pipeline  public.stato_pipeline not null default 'da_contattare',
  responsabile_id uuid references public.profiles (id) on delete set null default auth.uid(),
  creato_da       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index aziende_nome on public.aziende (lower(nome));
create index aziende_stato on public.aziende (stato_pipeline);
create trigger aziende_updated_at before update on public.aziende
  for each row execute function public.set_updated_at();

-- Gli eventi possono essere collegati a un'azienda cliente
alter table public.eventi add column azienda_id uuid references public.aziende (id) on delete set null;
create index eventi_azienda on public.eventi (azienda_id);

-- Promemoria di follow-up ("richiamare tra 7 giorni")
create table public.followup (
  id             uuid primary key default gen_random_uuid(),
  azienda_id     uuid not null references public.aziende (id) on delete cascade,
  data           date not null,
  nota           text not null check (length(trim(nota)) > 0),
  assegnato_a    uuid references public.profiles (id) on delete set null default auth.uid(),
  completato_il  timestamptz,
  creato_da      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index followup_aperti on public.followup (data) where completato_il is null;
create index followup_azienda on public.followup (azienda_id);

-- -----------------------------------------------------------------------------
-- Sopralluoghi (prima del preventivo, che può riferirsi a uno di essi)
-- -----------------------------------------------------------------------------
create table public.sopralluoghi (
  id               uuid primary key default gen_random_uuid(),
  azienda_id       uuid references public.aziende (id) on delete set null,
  evento_id        uuid references public.eventi (id) on delete set null,
  titolo           text not null check (length(trim(titolo)) > 0),
  data             date not null default current_date,
  indirizzo        text,
  referente_luogo  text,
  -- [{ "chiave": "accessi", "etichetta": "Accessi", "stato": "ok"|"problema"|"na"|null, "nota": "" }, …]
  checklist        jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  misure           text,
  note             text,
  creato_da        uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index sopralluoghi_azienda on public.sopralluoghi (azienda_id);
create trigger sopralluoghi_updated_at before update on public.sopralluoghi
  for each row execute function public.set_updated_at();

create table public.sopralluogo_file (
  id              uuid primary key default gen_random_uuid(),
  sopralluogo_id  uuid not null references public.sopralluoghi (id) on delete cascade,
  file_path       text not null,
  tipo            text not null default 'foto' check (tipo in ('foto', 'planimetria')),
  didascalia      text,
  caricato_da     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index sopralluogo_file_sopralluogo on public.sopralluogo_file (sopralluogo_id);

-- -----------------------------------------------------------------------------
-- Preventivi
-- -----------------------------------------------------------------------------
create table public.preventivi (
  id              uuid primary key default gen_random_uuid(),
  anno            integer not null default extract(year from current_date)::int,
  progressivo     integer not null,
  numero          text generated always as (anno::text || '-' || lpad(progressivo::text, 3, '0')) stored,
  azienda_id      uuid not null references public.aziende (id) on delete restrict,
  sopralluogo_id  uuid references public.sopralluoghi (id) on delete set null,
  evento_id       uuid references public.eventi (id) on delete set null,
  titolo          text not null check (length(trim(titolo)) > 0),
  data_evento     date,
  luogo           text,
  ospiti          integer check (ospiti >= 0),
  stato           public.stato_preventivo not null default 'bozza',
  data_invio      date,
  valido_fino     date,
  data_esito      date,
  motivo_esito    text,
  sconto_pct      numeric(5,2) not null default 0 check (sconto_pct between 0 and 100),
  iva_pct         numeric(5,2) not null default 22 check (iva_pct >= 0),
  note_cliente    text,   -- stampate sul PDF
  note_interne    text,   -- mai sul PDF
  creato_da       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (anno, progressivo)
);
create index preventivi_azienda on public.preventivi (azienda_id);
create index preventivi_stato on public.preventivi (stato);
create trigger preventivi_updated_at before update on public.preventivi
  for each row execute function public.set_updated_at();

create table public.preventivo_voci (
  id               uuid primary key default gen_random_uuid(),
  preventivo_id    uuid not null references public.preventivi (id) on delete cascade,
  ordine           integer not null default 0,
  tipo             public.tipo_voce not null default 'personale',
  descrizione      text not null check (length(trim(descrizione)) > 0),
  quantita         numeric(10,2) not null default 1 check (quantita > 0),
  ore              numeric(6,2) check (ore > 0),          -- solo per il personale
  prezzo_unitario  numeric(10,2) not null default 0 check (prezzo_unitario >= 0),  -- €/ora a persona o €/unità
  costo_unitario   numeric(10,2) not null default 0 check (costo_unitario >= 0),   -- interno, mai sul PDF
  importo          numeric(12,2) generated always as (round(quantita * coalesce(ore, 1) * prezzo_unitario, 2)) stored,
  costo            numeric(12,2) generated always as (round(quantita * coalesce(ore, 1) * costo_unitario, 2)) stored
);
create index preventivo_voci_preventivo on public.preventivo_voci (preventivo_id, ordine);

-- Numerazione annuale progressiva (2026-001, 2026-002…), IVA e validità predefinite
create or replace function public.nuovo_preventivo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  imp public.impostazioni;
begin
  perform pg_advisory_xact_lock(hashtext('numerazione-preventivi'));
  select coalesce(max(progressivo), 0) + 1 into new.progressivo from public.preventivi where anno = new.anno;
  select * into imp from public.impostazioni where id;
  if new.valido_fino is null then
    new.valido_fino := current_date + imp.validita_preventivo_giorni;
  end if;
  new.stato := 'bozza';
  return new;
end $$;

create trigger preventivi_numerazione before insert on public.preventivi
  for each row execute function public.nuovo_preventivo();

-- Quello che il cliente ha ricevuto non cambia: fuori dalla bozza si modificano solo stato ed esito
create or replace function public.regole_preventivo()
returns trigger language plpgsql as $$
begin
  if old.stato <> 'bozza' and new.stato = old.stato and (
       new.azienda_id, new.titolo, new.data_evento, new.luogo, new.ospiti, new.sconto_pct, new.iva_pct, new.note_cliente, new.valido_fino
     ) is distinct from (
       old.azienda_id, old.titolo, old.data_evento, old.luogo, old.ospiti, old.sconto_pct, old.iva_pct, old.note_cliente, old.valido_fino
     ) then
    raise exception 'Preventivo già inviato: riportalo in bozza per modificarlo' using errcode = '42501';
  end if;
  if new.progressivo <> old.progressivo or new.anno <> old.anno then
    raise exception 'Il numero del preventivo non si può cambiare' using errcode = '42501';
  end if;

  if new.stato is distinct from old.stato then
    if new.stato = 'inviato' then
      new.data_invio := coalesce(new.data_invio, current_date);
    elsif new.stato in ('accettato', 'rifiutato', 'perso') then
      new.data_esito := current_date;
    elsif new.stato = 'bozza' then
      new.data_invio := null;
      new.data_esito := null;
      new.motivo_esito := null;
    end if;
  end if;
  return new;
end $$;

create trigger preventivi_regole before update on public.preventivi
  for each row execute function public.regole_preventivo();

-- La pipeline dell'azienda segue l'esito dei preventivi
create or replace function public.preventivo_aggiorna_pipeline()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stato is distinct from old.stato then
    if new.stato = 'inviato' then
      update public.aziende set stato_pipeline = 'in_trattativa'
      where id = new.azienda_id and stato_pipeline in ('da_contattare', 'contattato', 'perso');
    elsif new.stato = 'accettato' then
      update public.aziende set stato_pipeline = 'cliente_attivo'
      where id = new.azienda_id and stato_pipeline <> 'cliente_attivo';
    end if;
  end if;
  return new;
end $$;

create trigger preventivi_pipeline after update on public.preventivi
  for each row execute function public.preventivo_aggiorna_pipeline();

create trigger preventivi_audit after update on public.preventivi
  for each row when (old.stato is distinct from new.stato)
  execute function public.registra_audit();

-- Le voci si modificano solo in bozza
create or replace function public.voci_solo_in_bozza()
returns trigger language plpgsql as $$
declare
  stato_attuale public.stato_preventivo;
begin
  select stato into stato_attuale from public.preventivi where id = coalesce(new.preventivo_id, old.preventivo_id);
  if stato_attuale is not null and stato_attuale <> 'bozza' then
    raise exception 'Preventivo già inviato: riportalo in bozza per modificare le voci' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create trigger preventivo_voci_bozza before insert or update or delete on public.preventivo_voci
  for each row execute function public.voci_solo_in_bozza();

-- Totali: imponibile scontato, IVA, totale; costo e margine solo per uso interno
create view public.preventivi_totali with (security_invoker = true) as
with somme as (
  select p.id,
         coalesce(sum(v.importo), 0) as subtotale,
         coalesce(sum(v.costo), 0) as costo,
         coalesce(sum(v.quantita) filter (where v.tipo = 'personale'), 0) as persone,
         count(v.id)::int as voci
  from public.preventivi p
  left join public.preventivo_voci v on v.preventivo_id = p.id
  group by p.id
)
select
  p.id as preventivo_id,
  s.voci,
  s.persone,
  s.subtotale,
  round(s.subtotale * p.sconto_pct / 100, 2) as sconto,
  s.subtotale - round(s.subtotale * p.sconto_pct / 100, 2) as imponibile,
  round((s.subtotale - round(s.subtotale * p.sconto_pct / 100, 2)) * p.iva_pct / 100, 2) as iva,
  (s.subtotale - round(s.subtotale * p.sconto_pct / 100, 2))
    + round((s.subtotale - round(s.subtotale * p.sconto_pct / 100, 2)) * p.iva_pct / 100, 2) as totale,
  s.costo,
  (s.subtotale - round(s.subtotale * p.sconto_pct / 100, 2)) - s.costo as margine,
  case when s.subtotale - round(s.subtotale * p.sconto_pct / 100, 2) > 0
       then round(((s.subtotale - round(s.subtotale * p.sconto_pct / 100, 2)) - s.costo)
                  / (s.subtotale - round(s.subtotale * p.sconto_pct / 100, 2)) * 100, 1)
  end as margine_pct
from public.preventivi p
join somme s on s.id = p.id;

-- Promemoria follow-up: una notifica a chi è assegnato quando arriva la data
create or replace function public.genera_promemoria_followup()
returns integer language plpgsql security definer set search_path = public as $$
declare
  f record;
  n integer := 0;
begin
  for f in
    select fu.*, a.nome as azienda
    from public.followup fu
    join public.aziende a on a.id = fu.azienda_id
    where fu.completato_il is null and fu.data <= current_date and fu.assegnato_a is not null
  loop
    perform public.notifica(f.assegnato_a, 'followup',
      'Follow-up: ' || f.azienda,
      f.nota || case when f.data < current_date then ' (previsto il ' || to_char(f.data, 'DD/MM') || ')' else '' end,
      '/crm/' || f.azienda_id, 'fu:' || f.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.genera_promemoria_followup() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security: solo responsabili e admin
-- -----------------------------------------------------------------------------
alter table public.aziende          enable row level security;
alter table public.followup         enable row level security;
alter table public.sopralluoghi     enable row level security;
alter table public.sopralluogo_file enable row level security;
alter table public.preventivi       enable row level security;
alter table public.preventivo_voci  enable row level security;

create policy aziende_staff on public.aziende for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy followup_staff on public.followup for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy sopralluoghi_staff on public.sopralluoghi for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy sopralluogo_file_staff on public.sopralluogo_file for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy preventivo_voci_staff on public.preventivo_voci for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy preventivi_select on public.preventivi for select to authenticated using (public.is_staff());
create policy preventivi_insert on public.preventivi for insert to authenticated with check (public.is_staff());
create policy preventivi_update on public.preventivi for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- Si eliminano solo le bozze (l'admin anche gli altri)
create policy preventivi_delete on public.preventivi for delete to authenticated
  using ((public.is_staff() and stato = 'bozza') or public.is_admin());

revoke all on public.aziende, public.followup, public.sopralluoghi, public.sopralluogo_file,
             public.preventivi, public.preventivo_voci from anon;

-- Storage privato per foto e planimetrie dei sopralluoghi (cartella = id sopralluogo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sopralluoghi', 'sopralluoghi', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy sopralluoghi_file_lettura on storage.objects for select to authenticated
  using (bucket_id = 'sopralluoghi' and public.is_staff());
create policy sopralluoghi_file_caricamento on storage.objects for insert to authenticated
  with check (bucket_id = 'sopralluoghi' and public.is_staff());
create policy sopralluoghi_file_eliminazione on storage.objects for delete to authenticated
  using (bucket_id = 'sopralluoghi' and public.is_staff());

-- Promemoria follow-up ogni mattina (05:35 UTC), accanto a quello dei documenti
do $$
begin
  perform cron.schedule('promemoria-followup', '35 5 * * *', 'select public.genera_promemoria_followup()');
exception when others then
  raise notice 'pg_cron non disponibile (%): pianifica genera_promemoria_followup() a mano', sqlerrm;
end $$;
