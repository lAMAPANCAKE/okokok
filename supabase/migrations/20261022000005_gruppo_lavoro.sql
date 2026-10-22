-- =============================================================================
-- Gruppo di lavoro dell'evento: punto e ora di ritrovo, divisa e referente in
-- loco. Stanno sull'evento, così ogni collaboratore con un turno li vede nella
-- scheda del proprio turno (stessa RLS degli eventi).
-- =============================================================================

alter table public.eventi
  add column punto_ritrovo text,
  add column ora_ritrovo   time,
  add column divisa        text,
  add column referente     text;

comment on column public.eventi.punto_ritrovo is 'Dove si ritrova lo staff (es. ingresso di servizio, parcheggio)';
comment on column public.eventi.referente is 'Referente in loco per lo staff: nome e telefono';
