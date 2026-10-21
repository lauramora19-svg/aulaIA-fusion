-- AulaIA · Registro abierto solo a los colegios dados de alta (v12)
-- Puede crear cuenta quien tenga un correo con el dominio de alguno de los
-- centros de «Usuarios y consumo → 🏫 Centros». Cualquier otro correo se rechaza,
-- también si alguien intenta registrarse saltándose la pantalla de la app.
-- Se puede ejecutar más de una vez.

-- ¿Este correo pertenece a un colegio dado de alta? (la pantalla de registro lo pregunta antes de crear la cuenta)
create or replace function dominio_permitido(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from centros
     where coalesce(dominio, '') <> ''
       and lower(dominio) = lower(split_part(trim(coalesce(p_email, '')), '@', 2))
  );
$$;
revoke all on function dominio_permitido(text) from public;
grant execute on function dominio_permitido(text) to anon, authenticated;

-- Candado en la base de datos: ninguna cuenta nueva fuera de esos dominios
create or replace function registro_solo_centros() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not dominio_permitido(new.email) then
    raise exception 'El registro en AulaIA solo está abierto a los colegios dados de alta (dominio: %).', split_part(coalesce(new.email, ''), '@', 2);
  end if;
  return new;
end $$;
drop trigger if exists auth_registro_solo_centros on auth.users;
create trigger auth_registro_solo_centros before insert on auth.users
  for each row execute function registro_solo_centros();

select 'registro listo' as estado,
  dominio_permitido('prueba@nscarmen.corazonistas.org') as tu_colegio_puede,
  dominio_permitido('prueba@gmail.com') as gmail_no_puede;
