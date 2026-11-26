-- Quantidade em estoque por bem e incremento atômico.
alter table public.bens add column if not exists quantidade integer not null default 0 check (quantidade >= 0);

create or replace function public.asvath_add_quantity(p_id bigint, p_amount integer)
returns public.bens
language plpgsql
set search_path = public
as $$
declare
  result public.bens;
begin
  if p_amount is null or p_amount < 1 then
    raise exception 'A quantidade a adicionar deve ser maior que zero.' using errcode = '23514';
  end if;

  update public.bens
     set quantidade = quantidade + p_amount
   where id = p_id and deleted_at is null
  returning * into result;

  return result;
end;
$$;

revoke all on function public.asvath_add_quantity(bigint, integer) from public, anon, authenticated;
grant execute on function public.asvath_add_quantity(bigint, integer) to service_role;
