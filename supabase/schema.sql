-- ============================================================
-- FC AUTISM · Esquema Supabase
-- Pega este archivo COMPLETO en:
--   Supabase Dashboard > SQL Editor > New query > RUN
--
-- Nota: no requiere extensiones. La contraseña se hashea en el
-- navegador (SHA-256 + nombre de usuario) y aquí solo se guarda
-- el hash. gen_random_uuid() es parte del núcleo de Postgres 13+.
-- ============================================================

-- Jugadores (nombre de usuario + hash de contraseña)
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Sesiones (token para verificar al entrar)
create table if not exists public.sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Salas online
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null references public.players(id) on delete cascade,
  config jsonb not null default '{}',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- RLS: el hash y las sesiones NUNCA se exponen por el cliente anon.
-- Las salas sí son legibles (para localizar una sala por su código).
alter table public.players enable row level security;
alter table public.sessions enable row level security;
alter table public.rooms enable row level security;

create policy "rooms readable" on public.rooms for select using (true);

-- ------------------------------------------------------------------
-- RPCs (SECURITY DEFINER). El parámetro p_password_hash ya llega
-- hasheado desde el navegador; nunca se guarda texto plano.
-- ------------------------------------------------------------------

create or replace function public.register_player(p_username text, p_password_hash text)
returns table (id uuid, username text, token uuid)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_token uuid;
begin
  if length(coalesce(p_username,'')) < 2 then
    raise exception 'El nombre debe tener al menos 2 caracteres';
  end if;
  if length(coalesce(p_password_hash,'')) < 8 then
    raise exception 'La contraseña no es válida';
  end if;
  insert into public.players (username, password_hash)
  values (lower(p_username), p_password_hash)
  on conflict (username) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'Ese nombre ya está en uso';
  end if;
  insert into public.sessions (user_id) values (v_id) returning token into v_token;
  return query select pl.id, pl.username, v_token from public.players pl where pl.id = v_id;
end $$;

create or replace function public.login_player(p_username text, p_password_hash text)
returns table (id uuid, username text, token uuid)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_token uuid;
begin
  select pl.id into v_id
  from public.players pl
  where pl.username = lower(p_username)
    and pl.password_hash = p_password_hash;
  if v_id is null then
    raise exception 'Nombre o contraseña incorrectos';
  end if;
  insert into public.sessions (user_id) values (v_id) returning token into v_token;
  return query select pl.id, pl.username, v_token from public.players pl where pl.id = v_id;
end $$;

create or replace function public.whoami(p_token uuid)
returns table (id uuid, username text)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select pl.id, pl.username
    from public.sessions s
    join public.players pl on pl.id = s.user_id
    where s.token = p_token;
end $$;

create or replace function public.create_room(p_token uuid, p_code text, p_config jsonb)
returns table (code text)
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select s.user_id into v_user from public.sessions s where s.token = p_token;
  if v_user is null then
    raise exception 'La sesión no es válida, inicia sesión de nuevo';
  end if;
  insert into public.rooms (code, host_id, config)
  values (upper(p_code), v_user, coalesce(p_config, '{}'::jsonb))
  on conflict (code) do update
    set host_id = excluded.host_id,
        config = excluded.config,
        created_at = now();
  return query select upper(p_code);
end $$;

create or replace function public.get_room(p_code text)
returns table (code text, host_id uuid, config jsonb, status text)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select r.code, r.host_id, r.config, r.status
    from public.rooms r
    where r.code = upper(p_code);
end $$;
