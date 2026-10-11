-- AulaIA · v3: copias de seguridad de la Agenda antes de cada sincronización
create table if not exists agenda_backups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  motivo      text,
  data        jsonb not null,
  created_at  timestamptz default now()
);
create index if not exists idx_agenda_backups_user on agenda_backups(user_id, created_at desc);
alter table agenda_backups enable row level security;
drop policy if exists "propios_agenda_backups" on agenda_backups;
create policy "propios_agenda_backups" on agenda_backups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
