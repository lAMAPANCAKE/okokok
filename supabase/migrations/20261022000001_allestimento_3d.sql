-- =============================================================================
-- Allestimento 3D del sopralluogo: pareti ricavate da misure o planimetria,
-- foto applicate alle pareti, tavoli, sedie e arredi di sala. Un unico documento
-- JSON per sopralluogo (stessa RLS: solo responsabili e admin).
-- =============================================================================

alter table public.sopralluoghi
  add column allestimento jsonb check (allestimento is null or jsonb_typeof(allestimento) = 'object');

comment on column public.sopralluoghi.allestimento is
  'Allestimento 3D: { versione, pareti: { punti, chiusa, altezza }, pavimento, planimetria, foto_pareti, oggetti: [{ id, tipo, x, z, rot, sedie, lunghezza }] }';
