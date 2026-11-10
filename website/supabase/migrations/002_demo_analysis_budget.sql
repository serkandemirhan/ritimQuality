-- Run before enabling anonymous AI in production. No documents or raw IPs stored.
begin;
create table public.site_demo_analysis_budget (
 day date not null,
 scope text not null,
 used integer not null default 0,
 primary key(day,scope)
);
alter table public.site_demo_analysis_budget enable row level security;
revoke all on public.site_demo_analysis_budget from public,anon,authenticated;
create function public.site_reserve_demo_analysis(visitor_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare today date := (now() at time zone 'UTC')::date; global_used integer; visitor_used integer;
begin
 if visitor_hash !~ '^[a-f0-9]{64}$' then return false; end if;
 -- Lock global row first, making the daily 100-request cap atomic across instances.
 insert into public.site_demo_analysis_budget(day,scope) values(today,'global') on conflict do nothing;
 select used into global_used from public.site_demo_analysis_budget where day=today and scope='global' for update;
 if global_used>=100 then return false; end if;
 insert into public.site_demo_analysis_budget(day,scope) values(today,visitor_hash) on conflict do nothing;
 select used into visitor_used from public.site_demo_analysis_budget where day=today and scope=visitor_hash for update;
 if visitor_used>=3 then return false; end if;
 update public.site_demo_analysis_budget set used=used+1 where day=today and scope in ('global',visitor_hash);
 delete from public.site_demo_analysis_budget where day<today-2;
 return true;
end;
$$;
revoke all on function public.site_reserve_demo_analysis(text) from public,anon,authenticated;
grant execute on function public.site_reserve_demo_analysis(text) to service_role;
commit;
