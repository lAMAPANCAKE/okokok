-- =============================================================================
-- Lista di carico dell'evento: attrezzature e materiali da caricare, divisi per
-- reparto (sala, bar, cucina, allestimento, consumabili), con la spunta al carico.
-- Lo staff la compila; i collaboratori con turno confermato la leggono e
-- spuntano il carico tramite spunta_carico (senza poter cambiare altro).
-- =============================================================================

create table public.liste_carico (
  evento_id   uuid primary key references public.eventi (id) on delete cascade,
  -- [{ "chiave": "…", "reparto": "sala", "voce": "Piatti piani", "quantita": 132, "unita": "pz",
  --    "note": "", "caricato": false, "auto": true }, …]
  voci        jsonb not null default '[]'::jsonb check (jsonb_typeof(voci) = 'array'),
  coperti     integer check (coperti >= 0),
  ospiti      integer check (ospiti >= 0),
  scorta_pct  integer not null default 10 check (scorta_pct between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger liste_carico_updated_at before update on public.liste_carico
  for each row execute function public.set_updated_at();

alter table public.liste_carico enable row level security;
create policy liste_carico_select on public.liste_carico for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.turni t
      where t.evento_id = liste_carico.evento_id
        and t.collaboratore_id = auth.uid()
        and t.stato in ('confermato', 'completato')
    )
  );
create policy liste_carico_insert on public.liste_carico for insert to authenticated with check (public.is_staff());
create policy liste_carico_update on public.liste_carico for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy liste_carico_delete on public.liste_carico for delete to authenticated using (public.is_staff());
revoke all on public.liste_carico from anon;

-- Spunta (o toglie la spunta) di una voce al carico: staff o collaboratori con turno confermato nell'evento
create or replace function public.spunta_carico(p_evento_id uuid, p_chiave text, p_caricato boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (
    public.is_staff()
    or exists (
      select 1 from public.turni t
      where t.evento_id = p_evento_id and t.collaboratore_id = auth.uid() and t.stato in ('confermato', 'completato')
    )
  ) then
    raise exception 'Lista di carico non trovata' using errcode = 'P0002';
  end if;

  update public.liste_carico
  set voci = (
    select coalesce(jsonb_agg(
      case when e.v ->> 'chiave' = p_chiave then jsonb_set(e.v, '{caricato}', to_jsonb(p_caricato)) else e.v end
      order by e.n
    ), '[]'::jsonb)
    from jsonb_array_elements(voci) with ordinality as e(v, n)
  )
  where evento_id = p_evento_id;
  if not found then
    raise exception 'Lista di carico non trovata' using errcode = 'P0002';
  end if;
end $$;

revoke execute on function public.spunta_carico(uuid, text, boolean) from public, anon;
grant execute on function public.spunta_carico(uuid, text, boolean) to authenticated;
