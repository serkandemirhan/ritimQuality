-- Run in a staging Supabase project first. Does not modify existing production app tables.
begin;
create table if not exists public.site_workspaces (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id),
 name text not null check (char_length(name) between 2 and 120),
 plan_id text not null default 'free' check (plan_id in ('free','pro','business')),
 created_at timestamptz not null default now()
);
create table if not exists public.site_memberships (
 workspace_id uuid not null references public.site_workspaces(id),
 user_id uuid not null references auth.users(id),
 role text not null check (role in ('owner','member')),
 primary key (workspace_id,user_id)
);
create table if not exists public.site_inspections (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.site_workspaces(id),
 created_by uuid not null references auth.users(id),
 sample_code text not null check(sample_code='rq-demo-shaft'),
 measurements jsonb not null check(jsonb_typeof(measurements)='object' and octet_length(measurements::text)<20000),
 created_at timestamptz not null default now()
);
create index if not exists site_inspections_workspace_created on public.site_inspections(workspace_id,created_at desc);
create table if not exists public.site_billing_events (
 provider text not null,
 event_id text not null,
 workspace_id uuid not null references public.site_workspaces(id),
 event_payload jsonb not null,
 processed_at timestamptz not null default now(),
 primary key(provider,event_id)
);
alter table public.site_workspaces enable row level security;
alter table public.site_memberships enable row level security;
alter table public.site_inspections enable row level security;
alter table public.site_billing_events enable row level security;

create or replace function public.site_is_member(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.site_memberships where workspace_id=target and user_id=(select auth.uid()));
$$;
revoke all on function public.site_is_member(uuid) from public;
grant execute on function public.site_is_member(uuid) to authenticated;

create policy site_workspace_read on public.site_workspaces for select to authenticated using(public.site_is_member(id));
create policy site_membership_read on public.site_memberships for select to authenticated using(user_id=(select auth.uid()));
create policy site_inspection_read on public.site_inspections for select to authenticated using(public.site_is_member(workspace_id));
create policy site_inspection_insert on public.site_inspections for insert to authenticated with check(public.site_is_member(workspace_id) and created_by=(select auth.uid()));
revoke all on public.site_workspaces,public.site_memberships,public.site_inspections,public.site_billing_events from anon,authenticated;
grant select on public.site_workspaces,public.site_memberships,public.site_inspections to authenticated;
grant insert on public.site_inspections to authenticated;

create or replace function public.site_create_workspace(workspace_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); workspace uuid;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Email verification required'; end if;
 if char_length(trim(workspace_name)) not between 2 and 120 then raise exception 'Invalid name'; end if;
 insert into public.site_workspaces(owner_id,name) values(actor,trim(workspace_name)) on conflict(owner_id) do nothing;
 select id into workspace from public.site_workspaces where owner_id=actor;
 insert into public.site_memberships(workspace_id,user_id,role) values(workspace,actor,'owner') on conflict do nothing;
 return workspace;
end;
$$;
revoke all on function public.site_create_workspace(text) from public;
grant execute on function public.site_create_workspace(text) to authenticated;

-- Private buckets are prepared for the future real-document workflow.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('site-drawings','site-drawings',false,8388608,array['application/pdf','image/png','image/jpeg']),
       ('site-reports','site-reports',false,8388608,array['application/pdf'])
on conflict(id) do nothing;
-- No anonymous policies. Paths must start with the authorized workspace UUID.
create policy site_document_read on storage.objects for select to authenticated
using(bucket_id in ('site-drawings','site-reports') and exists(select 1 from public.site_memberships m where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid())));
-- Upload writes stay server-controlled until real-document quotas and revision rules are wired.
commit;
