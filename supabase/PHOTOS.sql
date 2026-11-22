-- =============================================================================
--  HSELY — ACCUEIL + PHOTOS · à coller une fois dans Supabase → SQL Editor → Run
--
--  Ajoute aux trois tables de rapports :
--    • photos          JSONB  — URLs des photos (stockées sur Cloudflare R2)
--    • operationnelle  BOOLEAN — état de l'installation saisi à l'accueil
--    • localisation    JSONB  — position GPS { latitude, longitude, precision, horodatage }
--
--  Remplace inserer_rapport par la version 10 paramètres.
--  Idempotent : peut être relancé sans casser l'existant.
--  Aucune clé service_role n'est nécessaire côté application HSELY.
-- =============================================================================

-- 1) Colonnes -----------------------------------------------------------------
alter table public.rapports_lf     add column if not exists photos         jsonb   not null default '[]'::jsonb;
alter table public.rapports_nissan add column if not exists photos         jsonb   not null default '[]'::jsonb;
alter table public.rapports_st     add column if not exists photos         jsonb   not null default '[]'::jsonb;

alter table public.rapports_lf     add column if not exists operationnelle boolean;
alter table public.rapports_nissan add column if not exists operationnelle boolean;
alter table public.rapports_st     add column if not exists operationnelle boolean;

alter table public.rapports_lf     add column if not exists localisation   jsonb;
alter table public.rapports_nissan add column if not exists localisation   jsonb;
alter table public.rapports_st     add column if not exists localisation   jsonb;

-- 2) Fonction de transmission -------------------------------------------------
-- On supprime les anciennes signatures (7 et 8 paramètres) pour éviter que
-- PostgREST hésite entre plusieurs surcharges.
drop function if exists public.inserer_rapport(text, text, text, text, text, jsonb, text);
drop function if exists public.inserer_rapport(text, text, text, text, text, jsonb, text, jsonb);

create or replace function public.inserer_rapport(
  p_secteur text, p_nom text, p_prenom text, p_unite text, p_emplacement text,
  p_reponses jsonb, p_remarques text,
  p_photos jsonb default '[]'::jsonb,
  p_operationnelle boolean default null,
  p_localisation jsonb default null
)
returns table (rapport_id uuid, recu_le timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table text;
  v_rapporteur uuid;
  v_nombre bigint;
  v_photos jsonb := coalesce(p_photos, '[]'::jsonb);
  v_cles text[] := array['pomme', 'vanne_1', 'palette', 'vanne_2', 'vasque', 'rampe_2_sorties',
                         'erogateurs', 'tige_commande', 'pedale', 'flotteur', 'ressort', 'qualite_eau'];
begin
  if p_secteur not in ('LF', 'NISSAN', 'ST')
     or jsonb_typeof(p_reponses) <> 'object'
     or jsonb_typeof(v_photos) <> 'array' then
    raise exception 'entree invalide' using errcode = '22023';
  end if;

  if jsonb_array_length(v_photos) > 3 then
    raise exception 'trop_de_photos' using errcode = '22023';
  end if;

  if p_localisation is not null and jsonb_typeof(p_localisation) <> 'object' then
    raise exception 'localisation invalide' using errcode = '22023';
  end if;

  v_table := 'rapports_' || lower(p_secteur);

  -- Limite anti-abus globale : 1 200 transmissions par minute.
  select (select count(*) from public.rapports_lf where created_at > now() - interval '1 minute')
       + (select count(*) from public.rapports_nissan where created_at > now() - interval '1 minute')
       + (select count(*) from public.rapports_st where created_at > now() - interval '1 minute')
    into v_nombre;
  if v_nombre >= 1200 then
    raise exception 'limite_globale' using errcode = 'P0001';
  end if;

  insert into public.rapporteurs as r (nom, prenom)
  values (btrim(p_nom), btrim(p_prenom))
  on conflict (lower(nom), lower(prenom)) do update set nom = r.nom
  returning r.id into v_rapporteur;

  -- Limite individuelle : 5 contrôles par minute et par rapporteur.
  execute format(
    'select count(*) from public.%I where rapporteur_id = $1
       and created_at > now() - interval ''1 minute''', v_table)
    into v_nombre using v_rapporteur;
  if v_nombre >= 5 then
    raise exception 'limite_individuelle' using errcode = 'P0001';
  end if;

  execute format(
    'insert into public.%I
       (rapporteur_id, unite, emplacement, %s, remarques, photos, operationnelle, localisation)
     values ($1, $2, $3, %s, $5, $6, $7, $8)
     returning id, created_at',
    v_table,
    (select string_agg(quote_ident(t.c), ', ' order by t.o) from unnest(v_cles) with ordinality as t (c, o)),
    (select string_agg(format('$4->>%L', t.c), ', ' order by t.o) from unnest(v_cles) with ordinality as t (c, o)))
    into rapport_id, recu_le
    using v_rapporteur, btrim(p_unite), btrim(p_emplacement), p_reponses,
          nullif(btrim(coalesce(p_remarques, '')), ''), v_photos,
          p_operationnelle, p_localisation;

  return next;
end;
$$;

revoke execute on function public.inserer_rapport(
  text, text, text, text, text, jsonb, text, jsonb, boolean, jsonb
) from public, authenticated;

grant execute on function public.inserer_rapport(
  text, text, text, text, text, jsonb, text, jsonb, boolean, jsonb
) to anon, service_role;

notify pgrst, 'reload schema';

-- 3) Vérification -------------------------------------------------------------
select
  to_regprocedure(
    'public.inserer_rapport(text,text,text,text,text,jsonb,text,jsonb,boolean,jsonb)'
  ) is not null as fonction_accueil_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rapports_lf' and column_name = 'photos'
  ) as colonne_photos_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rapports_lf' and column_name = 'operationnelle'
  ) as colonne_etat_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rapports_lf' and column_name = 'localisation'
  ) as colonne_gps_ok;
