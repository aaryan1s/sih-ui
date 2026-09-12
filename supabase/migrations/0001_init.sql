-- =====================================================================
-- Legal Metrology Compliance System — initial schema, RLS, storage
-- Run in Supabase SQL editor (or `supabase db push`).
-- Relationships: profiles → inspections → products/declarations/evidence
--                manufacturers → products / cases → case_events
-- Roles are server-side only: raw_app_meta_data->>'app_role'
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Roles helper (server-side authorization) ----------
create or replace function public.auth_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'app_role', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'app_role', '')
  );
$$;

-- ---------- Profiles (mirrors auth.users 1:1) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  employee_id text,
  department text,
  designation text,
  region text,
  phone text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile on signup; role stays in app metadata (SQL-only).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Manufacturers (shared repository; no duplicates) ----------
create table if not exists public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  gstin varchar(15) unique,
  license_number text unique,
  license_status text not null default 'active'
    check (license_status in ('active','under_review','suspended')),
  address text,
  contact text,
  categories text[] default '{}',
  risk_level text not null default 'LOW'
    check (risk_level in ('LOW','MODERATE','HIGH','CRITICAL')),
  risk_factors jsonb default '[]'::jsonb,
  inspection_count int not null default 0,
  violation_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manufacturers_name_idx on public.manufacturers using gin (to_tsvector('simple', legal_name || ' ' || coalesce(trade_name,'')));
create index if not exists manufacturers_gstin_idx on public.manufacturers (gstin);

-- ---------- Products (catalog; linked to manufacturer when known) ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid references public.manufacturers(id) on delete set null,
  name text not null,
  brand text,
  barcode varchar(20),
  category text,
  created_at timestamptz not null default now(),
  unique (manufacturer_id, name)
);

create index if not exists products_barcode_idx on public.products (barcode);

-- ---------- Inspections (one inspection, many products) ----------
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,               -- human id, e.g. LM-1042
  inspector_id uuid not null references public.profiles(id) on delete cascade,
  establishment text not null,
  establishment_address text,
  inspection_type text not null default 'routine'
    check (inspection_type in ('routine','complaint','special_drive')),
  location text,
  inspected_at timestamptz not null default now(),
  remarks text,
  status text not null default 'under_review'
    check (status in ('compliant','non_compliant','warning','under_review')),
  summary jsonb not null default '{}'::jsonb,   -- counts + overall
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inspections_inspector_idx on public.inspections (inspector_id);
create index if not exists inspections_date_idx on public.inspections (inspected_at desc);

-- ---------- Inspection products ----------
create table if not exists public.inspection_products (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  -- denormalized snapshot of what was on the label at inspection time
  label_name text not null,
  label_brand text,
  label_net_quantity text,
  label_mrp text,
  label_mfg text,
  label_expiry text,
  label_batch text,
  image_path text,                               -- storage path in product-images
  verified_fields jsonb default '{}'::jsonb,     -- inspector-verified edits
  created_at timestamptz not null default now()
);

create index if not exists inspection_products_inspection_idx on public.inspection_products (inspection_id);

-- ---------- Declarations (extraction contract, one row per check) ----------
create table if not exists public.declarations (
  id uuid primary key default gen_random_uuid(),
  inspection_product_id uuid not null references public.inspection_products(id) on delete cascade,
  name text not null,
  value text,
  ocr_value text,                                -- raw automated extraction (audit trail; value = reviewed)
  confidence numeric(4,3) check (confidence between 0 and 1),
  presence_status text check (presence_status in ('ok','warn','bad','unknown','na')),
  correctness_status text check (correctness_status in ('ok','warn','bad','unknown','na')),
  placement_status text check (placement_status in ('ok','warn','bad','unknown','na')),
  readability_status text check (readability_status in ('ok','warn','bad','unknown','na')),
  font_size_status text check (font_size_status in ('ok','warn','bad','unknown','na')),
  violation_type text,
  rule_reference text,
  bbox jsonb,                                    -- {x,y,w,h} normalized
  verified boolean not null default false,       -- inspector-confirmed value
  created_at timestamptz not null default now()
);

create index if not exists declarations_ip_idx on public.declarations (inspection_product_id);

-- ---------- Evidence ----------
create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  storage_path text not null,                    -- path in evidence bucket
  label text not null,
  note text,
  violation_declaration_id uuid references public.declarations(id) on delete set null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists evidence_inspection_idx on public.evidence (inspection_id);

-- ---------- Violations (register, fed from failed declarations) ----------
create table if not exists public.violations (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  declaration_id uuid references public.declarations(id) on delete set null,
  manufacturer_id uuid references public.manufacturers(id) on delete cascade,
  severity text not null check (severity in ('severe','major','minor')),
  violation_type text not null,
  rule_reference text not null,
  created_at timestamptz not null default now()
);

create index if not exists violations_manufacturer_idx on public.violations (manufacturer_id);

-- ---------- Cases & enforcement ----------
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,                -- e.g. CASE-077
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  inspection_id uuid references public.inspections(id) on delete set null,
  severity text not null check (severity in ('severe','major','minor')),
  title text not null,
  status text not null default 'under_review'
    check (status in ('under_review','action_taken','closed')),
  flag_reason text not null,                     -- SYSTEM advisory flag
  decision_action text,                          -- officer-recorded action
  decision_reason text,                          -- officer justification
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  opened_at timestamptz not null default now()
);

create table if not exists public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  actor text not null,
  event text not null,
  created_at timestamptz not null default now()
);

-- ---------- Reports ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null unique references public.inspections(id) on delete cascade,
  reference text not null unique,                -- RPT-...
  generated_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- CONSISTENCY TRIGGERS: rollups stay true automatically
-- =====================================================================

-- Keep manufacturer counts in sync with inspections
create or replace function public.bump_manufacturer_counts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.manufacturer_id is not null then
    update public.manufacturers m
       set inspection_count = m.inspection_count + 1,
           violation_count  = m.violation_count + coalesce((new.summary->>'violationCount')::int, 0),
           updated_at = now()
     where m.id = new.manufacturer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bump_counts on public.inspections;
create trigger trg_bump_counts
  after insert on public.inspections
  for each row execute function public.bump_manufacturer_counts();

-- =====================================================================
-- ROW LEVEL SECURITY — the authorization boundary
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.manufacturers       enable row level security;
alter table public.products            enable row level security;
alter table public.inspections         enable row level security;
alter table public.inspection_products enable row level security;
alter table public.declarations        enable row level security;
alter table public.evidence            enable row level security;
alter table public.violations          enable row level security;
alter table public.cases               enable row level security;
alter table public.case_events         enable row level security;
alter table public.reports             enable row level security;

-- profiles: read any (needed for inspector names), edit own
create policy "profiles read"    on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles update"  on public.profiles for update using (auth.uid() = id);

-- manufacturers: authenticated read (both roles); write is officer-only
create policy "mfr read"  on public.manufacturers for select using (auth.role() = 'authenticated');
create policy "mfr write" on public.manufacturers for all
  using (public.auth_role() in ('gov_officer','admin'))
  with check (public.auth_role() in ('gov_officer','admin'));

-- products: authenticated read; officer write
create policy "products read"  on public.products for select using (auth.role() = 'authenticated');
create policy "products write" on public.products for all
  using (public.auth_role() in ('gov_officer','admin'))
  with check (public.auth_role() in ('gov_officer','admin'));

-- inspections: inspectors see OWN; officers see ALL
create policy "insp read own" on public.inspections for select
  using (
    inspector_id = auth.uid()
    or public.auth_role() in ('gov_officer','admin')
  );

create policy "insp insert own" on public.inspections for insert
  with check (inspector_id = auth.uid() and public.auth_role() = 'inspector');

create policy "insp update own" on public.inspections for update
  using (inspector_id = auth.uid() and public.auth_role() = 'inspector');

-- child rows follow the parent inspection's visibility
create policy "ip read" on public.inspection_products for select
  using (exists (
    select 1 from public.inspections i
    where i.id = inspection_id
      and (i.inspector_id = auth.uid() or public.auth_role() in ('gov_officer','admin'))
  ));
create policy "ip write" on public.inspection_products for all
  using (exists (
    select 1 from public.inspections i
    where i.id = inspection_id and i.inspector_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.inspections i
    where i.id = inspection_id and i.inspector_id = auth.uid()
  ));

create policy "decl read" on public.declarations for select
  using (exists (
    select 1 from public.inspection_products ip
    join public.inspections i on i.id = ip.inspection_id
    where ip.id = inspection_product_id
      and (i.inspector_id = auth.uid() or public.auth_role() in ('gov_officer','admin'))
  ));
create policy "decl write" on public.declarations for all
  using (exists (
    select 1 from public.inspection_products ip
    join public.inspections i on i.id = ip.inspection_id
    where ip.id = inspection_product_id and i.inspector_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.inspection_products ip
    join public.inspections i on i.id = ip.inspection_id
    where ip.id = inspection_product_id and i.inspector_id = auth.uid()
  ));

create policy "evidence read" on public.evidence for select
  using (exists (
    select 1 from public.inspections i
    where i.id = inspection_id
      and (i.inspector_id = auth.uid() or public.auth_role() in ('gov_officer','admin'))
  ));
create policy "evidence write" on public.evidence for all
  using (exists (
    select 1 from public.inspections i
    where i.id = inspection_id and i.inspector_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.inspections i
    where i.id = inspection_id and i.inspector_id = auth.uid()
  ));

-- violations: department-wide read (officers); system/officer writes via service path
create policy "viol read" on public.violations for select using (auth.role() = 'authenticated');
create policy "viol write" on public.violations for insert
  with check (public.auth_role() = 'inspector');

-- cases: officers only
create policy "case read"  on public.cases for select using (public.auth_role() in ('gov_officer','admin'));
create policy "case write" on public.cases for all
  using (public.auth_role() in ('gov_officer','admin'))
  with check (public.auth_role() in ('gov_officer','admin'));

create policy "case_event read"  on public.case_events for select using (public.auth_role() in ('gov_officer','admin'));
create policy "case_event write" on public.case_events for all
  using (public.auth_role() in ('gov_officer','admin'))
  with check (public.auth_role() in ('gov_officer','admin'));

-- reports: own for inspector, all for officer
create policy "report read" on public.reports for select
  using (exists (
    select 1 from public.inspections i
    where i.id = inspection_id
      and (i.inspector_id = auth.uid() or public.auth_role() in ('gov_officer','admin'))
  ));
create policy "report insert" on public.reports for insert
  with check (exists (
    select 1 from public.inspections i
    where i.id = inspection_id and i.inspector_id = auth.uid()
  ));

-- =====================================================================
-- STORAGE: private buckets with role-checked policies
-- =====================================================================

insert into storage.buckets (id, name, public) values
  ('product-images', 'product-images', false),
  ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- evidence: inspectors upload; owner + officers read
create policy "evidence upload" on storage.objects for insert
  with check (bucket_id = 'evidence' and public.auth_role() = 'inspector');
create policy "evidence read" on storage.objects for select
  using (bucket_id = 'evidence' and auth.role() = 'authenticated');

-- product images: same model
create policy "pimg upload" on storage.objects for insert
  with check (bucket_id = 'product-images' and public.auth_role() = 'inspector');
create policy "pimg read" on storage.objects for select
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');
