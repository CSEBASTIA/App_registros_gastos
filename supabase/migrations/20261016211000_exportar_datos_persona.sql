-- Migración de exportación de datos personales.
--
-- La Ley Orgánica de Protección de Datos Personales de Ecuador da derecho de
-- acceso y de portabilidad: la persona puede pedir una copia de TODOS sus
-- datos en un formato que pueda leer y llevar a otro servicio, y hay un plazo
-- corto para responder (docs/legal/procedimiento-derechos-titular.md).
--
-- `exportar_datos_persona(correo)` arma esa copia en un solo JSON. La corre
-- quien administra el proyecto desde el SQL Editor (nunca la app): por eso no
-- se concede a `anon` ni a `authenticated`, y además se niega a correr si la
-- llaman con esos roles. Quien la corre debe haber comprobado antes que la
-- solicitud viene del correo de esa cuenta.
--
-- No incluye la huella de las claves de captura de Apple Pay (es un secreto
-- derivado: solo sale el prefijo y el nombre). Las facturas (archivos en
-- Storage) salen como lista de nombres; los archivos se bajan del panel de
-- Storage, carpeta con el id de la persona.
--
-- Una prueba comprueba que TODA tabla con `usuario_id` aparezca en la copia:
-- si alguien agrega una tabla de datos personales y olvida añadirla aquí, falla.

create or replace function public.exportar_datos_persona(p_correo text)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid;
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'Solo la administración puede exportar datos.' using errcode = '42501';
  end if;

  select id into v_usuario from auth.users where lower(email) = lower(btrim(p_correo));
  if v_usuario is null then
    raise exception 'No existe una cuenta con ese correo.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'exportado_en', now(),
    'cuenta', (
      select jsonb_build_object('id', u.id, 'correo', u.email, 'creada', u.created_at, 'ultimo_ingreso', u.last_sign_in_at)
      from auth.users u where u.id = v_usuario
    ),
    'aceptaciones_legales', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.aceptado_en, t.documento), '[]'::jsonb) from public.aceptaciones_legales t where t.usuario_id = v_usuario),
    'cuentas', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.created_at, t.id), '[]'::jsonb) from public.cuentas t where t.usuario_id = v_usuario),
    'categorias', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.nombre, t.id), '[]'::jsonb) from public.categorias t where t.usuario_id = v_usuario),
    'gastos', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.fecha, t.created_at, t.id), '[]'::jsonb) from public.gastos t where t.usuario_id = v_usuario),
    'ingresos', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.fecha, t.created_at, t.id), '[]'::jsonb) from public.ingresos t where t.usuario_id = v_usuario),
    'deudas', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.created_at, t.id), '[]'::jsonb) from public.deudas t where t.usuario_id = v_usuario),
    'abonos_deuda', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.fecha, t.created_at, t.id), '[]'::jsonb) from public.abonos_deuda t where t.usuario_id = v_usuario),
    'pagos_tarjeta', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.fecha, t.created_at, t.id), '[]'::jsonb) from public.pagos_tarjeta t where t.usuario_id = v_usuario),
    'presupuestos', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.mes, t.id), '[]'::jsonb) from public.presupuestos t where t.usuario_id = v_usuario),
    'recordatorios', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.fecha, t.id), '[]'::jsonb) from public.recordatorios t where t.usuario_id = v_usuario),
    'transacciones_detectadas', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.created_at, t.id), '[]'::jsonb) from public.transacciones_detectadas t where t.usuario_id = v_usuario),
    'lugares', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' order by t.created_at, t.id), '[]'::jsonb) from public.lugares t where t.usuario_id = v_usuario),
    -- Sin la huella: es un secreto derivado de la clave.
    'claves_captura', (select coalesce(jsonb_agg(to_jsonb(t) - 'usuario_id' - 'huella' order by t.created_at, t.id), '[]'::jsonb) from public.claves_captura t where t.usuario_id = v_usuario),
    'facturas_guardadas', (
      select coalesce(jsonb_agg(o.name order by o.name), '[]'::jsonb)
      from storage.objects o
      where o.bucket_id = 'facturas' and (storage.foldername(o.name))[1] = v_usuario::text
    )
  );
end;
$$;

revoke all on function public.exportar_datos_persona(text) from public, anon, authenticated;
