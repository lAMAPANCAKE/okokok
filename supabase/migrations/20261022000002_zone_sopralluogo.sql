-- =============================================================================
-- Zone del sopralluogo (bar, sbarazzo, back, cucina, sala…): foto della location
-- vuota, cosa allestire, note operative e rendering della zona allestita.
-- I rendering sono foto (tipo 'rendering') collegate alla foto originale.
-- Stessa RLS dei sopralluoghi: solo responsabili e admin.
-- =============================================================================

create table public.sopralluogo_zone (
  id              uuid primary key default gen_random_uuid(),
  sopralluogo_id  uuid not null references public.sopralluoghi (id) on delete cascade,
  tipo            text not null default 'altro'
                  check (tipo in ('bar', 'sbarazzo', 'back', 'cucina', 'sala', 'buffet', 'ingresso', 'esterno', 'altro')),
  nome            text not null check (length(trim(nome)) > 0),
  -- Voci guidate scelte (es. "Bancone bar operativo", "Lavabicchieri")
  voci            jsonb not null default '[]'::jsonb check (jsonb_typeof(voci) = 'array'),
  -- { "stile": "elegante", "momento": "sera", "colori": "bianco e oro" }
  stile           jsonb not null default '{}'::jsonb check (jsonb_typeof(stile) = 'object'),
  descrizione     text,
  note_operative  text,
  ordine          integer not null default 0,
  creato_da       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index sopralluogo_zone_sopralluogo on public.sopralluogo_zone (sopralluogo_id);
create trigger sopralluogo_zone_updated_at before update on public.sopralluogo_zone
  for each row execute function public.set_updated_at();

alter table public.sopralluogo_zone enable row level security;
create policy sopralluogo_zone_staff on public.sopralluogo_zone for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
revoke all on public.sopralluogo_zone from anon;

-- Foto e rendering delle zone
alter table public.sopralluogo_file
  add column zona_id    uuid references public.sopralluogo_zone (id) on delete cascade,
  add column origine_id uuid references public.sopralluogo_file (id) on delete set null,
  add column scelto     boolean not null default false;
create index sopralluogo_file_zona on public.sopralluogo_file (zona_id);

alter table public.sopralluogo_file drop constraint sopralluogo_file_tipo_check;
alter table public.sopralluogo_file add constraint sopralluogo_file_tipo_check
  check (tipo in ('foto', 'planimetria', 'rendering'));
