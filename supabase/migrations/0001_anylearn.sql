-- AnyLearn Plugin, migration 0001
--
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query),
-- on the project's default "postgres" database. It does not touch any other
-- database or schema, so existing apps in the same project are unaffected.
--
-- BEFORE RUNNING: replace CHANGE_ME_STRONG_PASSWORD below with a long random
-- password (letters and digits only, so it is safe inside a connection URL).
-- That password goes into Vercel as part of DATABASE_URL; don't commit it.
--
-- Safe to run more than once.

-- 1. A schema of our own --------------------------------------------------

create schema if not exists anylearn_plugin;

create table if not exists anylearn_plugin.courses (
  id               text primary key,
  edit_token_hash  text        not null,
  status           text        not null default 'draft' check (status in ('draft', 'published')),
  title            text        not null,
  language         text        not null,
  -- The whole course document (format v1, see src/lib/schema.ts).
  -- While drafting, some lessons may have no cards yet.
  data             jsonb       not null,
  thumbnail_url    text,
  version          integer     not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  published_at     timestamptz
);

create index if not exists courses_created_at_idx on anylearn_plugin.courses (created_at desc);

-- 2. A login role that can only reach this schema -------------------------
-- The app connects as anylearn_plugin_app, never as postgres. Through the Supabase
-- pooler the user name becomes "anylearn_plugin_app.<project-ref>".

do $$
begin
  if not exists (select from pg_roles where rolname = 'anylearn_plugin_app') then
    create role anylearn_plugin_app login password '#@Cc9798';
  end if;
end
$$;

grant usage on schema anylearn_plugin to anylearn_plugin_app;
grant select, insert, update, delete on all tables in schema anylearn_plugin to anylearn_plugin_app;
alter default privileges in schema anylearn_plugin grant select, insert, update, delete on tables to anylearn_plugin_app;

-- Row Level Security: only anylearn_plugin_app may touch course rows. Supabase's
-- anon/authenticated roles get nothing even if the schema were ever exposed.
alter table anylearn_plugin.courses enable row level security;
drop policy if exists plugin_app_all on anylearn_plugin.courses;
create policy plugin_app_all on anylearn_plugin.courses
  for all to anylearn_plugin_app using (true) with check (true);

-- Keep the schema out of Supabase's public Data API roles.
do $$
begin
  if exists (select from pg_roles where rolname = 'anon') then
    revoke all on schema anylearn_plugin from anon;
  end if;
  if exists (select from pg_roles where rolname = 'authenticated') then
    revoke all on schema anylearn_plugin from authenticated;
  end if;
end
$$;

-- 3. A public storage bucket for thumbnails and course images -------------
-- Separate from any existing bucket. Files are readable by anyone with the
-- URL; only the server (with an S3 access key) can write.

do $$
begin
  if exists (select from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('anylearn-plugin', 'anylearn-plugin', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
    on conflict (id) do nothing;
  end if;
end
$$;
