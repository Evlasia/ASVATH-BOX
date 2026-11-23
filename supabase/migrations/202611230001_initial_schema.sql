create sequence if not exists public.bens_codigo_seq start 1;

create table if not exists public.bens (
  id bigint generated always as identity primary key,
  codigo text not null unique default ('ASV-' || lpad(nextval('public.bens_codigo_seq')::text, 6, '0')),
  nome text not null check (length(trim(nome)) > 0),
  categoria text,
  variacoes_tipo text,
  variacoes_campos jsonb not null default '[]'::jsonb check (jsonb_typeof(variacoes_campos) = 'array'),
  variacoes jsonb not null default '[]'::jsonb check (jsonb_typeof(variacoes) = 'array'),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bens add column if not exists variacoes_tipo text;
alter table public.bens add column if not exists variacoes_campos jsonb not null default '[]'::jsonb;
alter table public.bens add column if not exists variacoes jsonb not null default '[]'::jsonb;
alter table public.bens alter column codigo set default ('ASV-' || lpad(nextval('public.bens_codigo_seq')::text, 6, '0'));

select setval(
  'public.bens_codigo_seq',
  coalesce((select max(nullif(substring(codigo from '([0-9]+)$'), '')::bigint) from public.bens), 0) + 1,
  false
);

create index if not exists bens_categoria_idx on public.bens(categoria) where deleted_at is null;

create or replace function public.asvath_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bens_set_updated_at on public.bens;
create trigger bens_set_updated_at before update on public.bens
for each row execute function public.asvath_set_updated_at();

alter table public.bens enable row level security;
revoke all on public.bens from anon, authenticated;
grant select, insert, update, delete on public.bens to service_role;
grant usage, select on sequence public.bens_codigo_seq to service_role;
