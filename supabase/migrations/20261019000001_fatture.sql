-- =============================================================================
-- Fatture e incassi — registro delle fatture emesse ai clienti e dei pagamenti
-- ricevuti. Non sostituisce la fattura elettronica (SdI): il numero è quello
-- del documento emesso col programma di fatturazione. Riservato agli admin.
-- =============================================================================

create table public.fatture (
  id              uuid primary key default gen_random_uuid(),
  anno            integer not null default extract(year from current_date)::int,
  numero          text not null check (length(trim(numero)) > 0),
  azienda_id      uuid not null references public.aziende (id) on delete restrict,
  preventivo_id   uuid references public.preventivi (id) on delete set null,
  evento_id       uuid references public.eventi (id) on delete set null,
  data_emissione  date not null default current_date,
  data_scadenza   date not null default current_date + 30,
  descrizione     text not null check (length(trim(descrizione)) > 0),
  imponibile      numeric(12,2) not null check (imponibile >= 0),
  iva_pct         numeric(5,2) not null default 22 check (iva_pct >= 0),
  iva             numeric(12,2) generated always as (round(imponibile * iva_pct / 100, 2)) stored,
  totale          numeric(12,2) generated always as (imponibile + round(imponibile * iva_pct / 100, 2)) stored,
  annullata       boolean not null default false,
  note            text,
  creato_da       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (anno, numero),
  check (data_scadenza >= data_emissione)
);
create index fatture_azienda on public.fatture (azienda_id);
create index fatture_preventivo on public.fatture (preventivo_id);
create index fatture_evento on public.fatture (evento_id);
create index fatture_scadenza on public.fatture (data_scadenza) where not annullata;
create trigger fatture_updated_at before update on public.fatture
  for each row execute function public.set_updated_at();
create trigger fatture_audit after insert or update or delete on public.fatture
  for each row execute function public.registra_audit();

create table public.incassi (
  id             uuid primary key default gen_random_uuid(),
  fattura_id     uuid not null references public.fatture (id) on delete restrict,  -- prima si eliminano gli incassi
  data           date not null default current_date,
  importo        numeric(12,2) not null check (importo > 0),
  metodo         public.metodo_pagamento not null default 'bonifico',
  note           text,
  registrato_da  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index incassi_fattura on public.incassi (fattura_id);
create index incassi_data on public.incassi (data);
create trigger incassi_audit after insert or update or delete on public.incassi
  for each row execute function public.registra_audit();

-- Gli incassi non superano il totale e non si registrano su fatture annullate
create or replace function public.regole_incasso()
returns trigger language plpgsql as $$
declare
  f public.fatture;
  gia numeric;
begin
  select * into f from public.fatture where id = new.fattura_id for update;
  if f.annullata then
    raise exception 'Fattura annullata: non si possono registrare incassi' using errcode = '23514';
  end if;
  select coalesce(sum(importo), 0) into gia from public.incassi where fattura_id = new.fattura_id and id <> new.id;
  if gia + new.importo > f.totale then
    raise exception 'L''incasso supera il totale della fattura (restano % €)', replace((f.totale - gia)::text, '.', ',')
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger incassi_regole before insert or update on public.incassi
  for each row execute function public.regole_incasso();

-- Una fattura con incassi non si annulla né scende sotto quanto già incassato
create or replace function public.regole_fattura()
returns trigger language plpgsql as $$
declare
  incassato numeric;
begin
  select coalesce(sum(importo), 0) into incassato from public.incassi where fattura_id = new.id;
  if new.annullata and not old.annullata and incassato > 0 then
    raise exception 'La fattura ha incassi registrati: eliminali prima di annullarla' using errcode = '23514';
  end if;
  -- Nei trigger BEFORE le colonne generate non sono ancora calcolate
  if new.imponibile + round(new.imponibile * new.iva_pct / 100, 2) < incassato then
    raise exception 'Il totale non può essere inferiore a quanto già incassato' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger fatture_regole before update on public.fatture
  for each row execute function public.regole_fattura();

-- Stato calcolato: pagata, parziale, scaduta, da incassare, annullata
create view public.fatture_stato with (security_invoker = true) as
select
  f.*,
  coalesce(i.incassato, 0) as incassato,
  f.totale - coalesce(i.incassato, 0) as residuo,
  i.ultimo_incasso,
  case
    when f.annullata then 'annullata'
    when coalesce(i.incassato, 0) >= f.totale then 'pagata'
    when f.data_scadenza < current_date then 'scaduta'
    when coalesce(i.incassato, 0) > 0 then 'parziale'
    else 'da_incassare'
  end as stato
from public.fatture f
left join lateral (
  select sum(importo) as incassato, max(data) as ultimo_incasso from public.incassi where fattura_id = f.id
) i on true;

-- -----------------------------------------------------------------------------
-- Row Level Security: solo admin
-- -----------------------------------------------------------------------------
alter table public.fatture enable row level security;
alter table public.incassi enable row level security;

create policy fatture_admin on public.fatture for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy incassi_admin on public.incassi for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.fatture, public.incassi, public.fatture_stato from anon;
