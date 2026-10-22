-- =============================================================================
-- Ordine di servizio dell'evento: scaletta, menù con allergeni, intolleranze
-- degli ospiti, checklist di montaggio, dress code e note per lo staff.
-- Lo gestiscono responsabili e admin; lo leggono anche i collaboratori con un
-- turno confermato (o completato) in quell'evento.
-- Regole del personale: camerieri ogni 10–12 coperti, modificabili dall'admin.
-- =============================================================================

alter table public.impostazioni
  add column coperti_per_cameriere_min integer not null default 10 check (coperti_per_cameriere_min between 1 and 100),
  add column coperti_per_cameriere_max integer not null default 12 check (coperti_per_cameriere_max between 1 and 100),
  add constraint impostazioni_coperti_cameriere check (coperti_per_cameriere_min <= coperti_per_cameriere_max);

create table public.ordini_servizio (
  evento_id     uuid primary key references public.eventi (id) on delete cascade,
  -- [{ "ora": "18:30", "attivita": "Arrivo ospiti", "zona": "Giardino", "note": "" }, …]
  scaletta      jsonb not null default '[]'::jsonb check (jsonb_typeof(scaletta) = 'array'),
  -- [{ "portata": "Antipasti", "piatto": "Vitello tonnato", "allergeni": [3, 4], "note": "" }, …]
  menu          jsonb not null default '[]'::jsonb check (jsonb_typeof(menu) = 'array'),
  -- [{ "tipo": "Celiachia", "numero": 2, "note": "tavolo 4" }, …]
  intolleranze  jsonb not null default '[]'::jsonb check (jsonb_typeof(intolleranze) = 'array'),
  -- [{ "zona": "Bar", "voce": "Bancone bar operativo", "fatto": false }, …]
  checklist     jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  dress_code    text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger ordini_servizio_updated_at before update on public.ordini_servizio
  for each row execute function public.set_updated_at();

alter table public.ordini_servizio enable row level security;
create policy ordini_servizio_select on public.ordini_servizio for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.turni t
      where t.evento_id = ordini_servizio.evento_id
        and t.collaboratore_id = auth.uid()
        and t.stato in ('confermato', 'completato')
    )
  );
create policy ordini_servizio_insert on public.ordini_servizio for insert to authenticated with check (public.is_staff());
create policy ordini_servizio_update on public.ordini_servizio for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy ordini_servizio_delete on public.ordini_servizio for delete to authenticated using (public.is_staff());
revoke all on public.ordini_servizio from anon;
