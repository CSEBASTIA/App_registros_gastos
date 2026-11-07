-- Migración de presupuestos que siguen de un mes al otro y recibos de Uber.
--
-- Un presupuesto es de un mes (categoría + límite + mes). Antes, al empezar
-- un mes nuevo la pantalla quedaba vacía y había que volver a crearlos todos.
-- Ahora, la primera vez que la app abre un mes, `continuar_presupuestos`
-- copia los del último mes que tuvo presupuestos (solo las categorías que el
-- mes nuevo aún no tiene).
--
-- Se copia UNA sola vez por mes: `ajustes_usuario.presupuestos_hasta` recuerda
-- el último mes ya preparado. Así, si la persona borra un presupuesto en el
-- mes nuevo, no reaparece al volver a abrir la pantalla.
--
-- Además, `categoria_sugerida` (lo que usa el registro automático) reconoce
-- «UBER *EATS», Rappi y PedidosYa como Comida y DiDi como Transporte, igual
-- que PALABRAS_POR_CATEGORIA en packages/core/src/lib/textoFinanciero.ts.
--
-- Y `registrar_avisos_correo` registra solos los recibos de Uber: en la tarjeta
-- de sus últimos dígitos o, si el recibo no la dice, en la que la persona más
-- usa en Uber. Si el recibo y el aviso del banco son del mismo cobro, el
-- segundo no se registra: queda en la Bandeja marcado para que la persona
-- confirme si es el mismo cobro (`posible_duplicado_de`).

alter table public.ajustes_usuario
  add column if not exists presupuestos_hasta text;

-- El gasto que parece ser el mismo cobro que este aviso (ver registrar_avisos_correo).
alter table public.transacciones_detectadas
  add column if not exists posible_duplicado_de uuid references public.gastos(id) on delete set null;
create index if not exists transacciones_detectadas_duplicado_idx
  on public.transacciones_detectadas (posible_duplicado_de) where posible_duplicado_de is not null;

alter table public.ajustes_usuario drop constraint if exists ajustes_usuario_presupuestos_hasta_valido;
alter table public.ajustes_usuario add constraint ajustes_usuario_presupuestos_hasta_valido
  check (presupuestos_hasta is null or presupuestos_hasta ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

create or replace function public.continuar_presupuestos(p_mes text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_hasta text;
  v_origen text;
  v_copiados integer := 0;
begin
  if v_usuario is null then
    raise exception 'Inicia sesión para ver tus presupuestos.' using errcode = '28000';
  end if;
  if p_mes is null or p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Mes inválido: se esperaba AAAA-MM.' using errcode = '22023';
  end if;

  insert into ajustes_usuario (usuario_id) values (v_usuario) on conflict (usuario_id) do nothing;
  -- La fila bloqueada: dos pantallas que abren el mes a la vez no copian dos veces.
  select presupuestos_hasta into v_hasta from ajustes_usuario where usuario_id = v_usuario for update;
  if v_hasta is not null and v_hasta >= p_mes then
    return 0;
  end if;

  select max(mes) into v_origen from presupuestos where usuario_id = v_usuario and mes < p_mes;
  if v_origen is not null then
    insert into presupuestos (usuario_id, categoria_id, monto_limite, mes)
    select v_usuario, p.categoria_id, p.monto_limite, p_mes
    from presupuestos p
    where p.usuario_id = v_usuario and p.mes = v_origen
    on conflict (usuario_id, categoria_id, mes) do nothing;
    get diagnostics v_copiados = row_count;
  end if;

  update ajustes_usuario set presupuestos_hasta = p_mes, updated_at = now() where usuario_id = v_usuario;
  return v_copiados;
end;
$$;

revoke all on function public.continuar_presupuestos(text) from public, anon;
grant execute on function public.continuar_presupuestos(text) to authenticated;

-- Categoría sugerida: igual que en 20261018130000_registro_automatico_billetera,
-- con la comida a domicilio antes que los viajes.

create or replace function public.categoria_sugerida(p_usuario uuid, p_texto text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_texto text := lower(btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g')));
  v_sin_acentos text;
  v_nombre text;
  v_id uuid;
begin
  if v_texto <> '' then
    -- La categoría que usaste la última vez en ese mismo comercio.
    select g.categoria_id into v_id
    from gastos g
    where g.usuario_id = p_usuario and g.categoria_id is not null
      and lower(btrim(regexp_replace(g.descripcion, '\s+', ' ', 'g'))) = v_texto
    order by g.fecha desc, g.created_at desc
    limit 1;
    if v_id is not null then
      return v_id;
    end if;

    -- Palabras clave: las mismas (y en el mismo orden) que
    -- PALABRAS_POR_CATEGORIA en packages/core/src/lib/textoFinanciero.ts.
    v_sin_acentos := translate(v_texto, 'áéíóúüñ', 'aeiouun');
    v_nombre := case
      when v_sin_acentos ~ '(supermaxi|megamaxi|mi comisariato|coral|restaurante|market|food|uber ?\*? ?eats|rappi|pedidos ?ya)' then 'Comida'
      when v_sin_acentos ~ '(uber|cabify|indriver|didi|taxi|gasolina|combustible|peaje)' then 'Transporte'
      when v_sin_acentos ~ '(netflix|spotify|cine|cinemark|supercines|steam|teatro|discoteca|casino|concierto)' then 'Ocio'
      when v_sin_acentos ~ '(farmacia|fybeca|sana sana|cruz azul|medico|medica|clinica|hospital|laboratorio clinico|consultorio|odontologo|dentista|medicamento)' then 'Salud'
      when v_sin_acentos ~ '(cnel|cnt|movistar|claro|agua potable|electricidad)' then 'Servicios'
    end;
    if v_nombre is not null then
      -- Una categoría propia con ese nombre gana a la global.
      select c.id into v_id
      from categorias c
      where c.tipo = 'gasto' and lower(c.nombre) = lower(v_nombre)
        and (c.usuario_id = p_usuario or c.usuario_id is null)
      order by (c.usuario_id is null), c.id
      limit 1;
      if v_id is not null then
        return v_id;
      end if;
    end if;
  end if;

  select c.id into v_id
  from categorias c
  where c.tipo = 'gasto' and c.nombre = 'Otros' and c.usuario_id is null
  limit 1;
  return v_id;
end;
$$;

revoke all on function public.categoria_sugerida(uuid, text) from public, anon, authenticated;

-- Registro del correo: igual que en 20261019120000_saldos_y_registro_del_correo,
-- más la unión del recibo de un comercio con el aviso del banco del mismo cobro.

create or replace function public.registrar_avisos_correo()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  a transacciones_detectadas;
  v_cuenta cuentas;
  v_otra cuentas;
  v_resultados jsonb := '[]'::jsonb;
  v_gasto uuid;
  v_pago uuid;
  v_transferencia uuid;
  v_existente uuid;
  v_categoria uuid;
  v_categoria_nombre text;
  v_lugar uuid;
  v_comercio text;
  v_frecuente uuid;
begin
  if v_usuario is null then
    raise exception 'Inicia sesión para registrar tus movimientos.' using errcode = '28000';
  end if;
  if not registro_automatico_activo(v_usuario) then
    return v_resultados;
  end if;

  for a in
    select * from transacciones_detectadas
    where usuario_id = v_usuario and estado = 'pendiente' and origen = 'correo'
      and (clase is not null or (es_transferencia and tipo = 'ingreso'))
    order by coalesce(pagado_en, fecha::timestamptz), created_at, id
    for update
  loop
    -- Cada aviso va en su propio bloque: si uno no se puede registrar (por
    -- ejemplo, dejaría una cuenta en negativo), queda en la Bandeja y los
    -- demás siguen.
    begin
      v_cuenta := null;
      v_otra := null;
      if a.cuenta_id is not null then
        select * into v_cuenta from cuentas where id = a.cuenta_id and usuario_id = v_usuario;
      end if;
      if a.contraparte_cuenta_id is not null then
        select * into v_otra from cuentas where id = a.contraparte_cuenta_id and usuario_id = v_usuario;
      end if;

      -- La otra mitad de una transferencia que ya se registró sola: el aviso
      -- de «recibida» de la cuenta destino no se vuelve a contar.
      if a.clase is null then
        select t.id into v_existente
        from transferencias t
        where t.usuario_id = v_usuario and t.origen = 'correo' and a.cuenta_id is not null
          and t.cuenta_destino_id = a.cuenta_id and t.monto = a.monto
          and t.fecha between a.fecha - 2 and a.fecha + 2
          and t.created_at > now() - interval '3 days'
          and not exists (select 1 from transacciones_detectadas o where o.transferencia_id = t.id and o.tipo = 'ingreso')
        order by t.created_at desc
        limit 1;
        if found then
          update transacciones_detectadas set estado = 'confirmado', transferencia_id = v_existente where id = a.id;
          v_resultados := v_resultados || jsonb_build_object('aviso', a.id, 'resultado', 'ya_registrado', 'clase', 'transferencia');
        end if;
        continue;
      end if;

      if a.clase = 'consumo' then
        -- Recibo de un comercio (Uber) que no dice con qué tarjeta se pagó: la
        -- que la persona más usa ahí (al menos 2 de sus últimos 5 gastos en
        -- ese comercio, de los últimos 90 días).
        if v_cuenta.id is null and a.banco is null and nullif(btrim(a.comercio), '') is not null then
          select f.cuenta_id into v_frecuente
          from (
            select g.cuenta_id from gastos g
            where g.usuario_id = v_usuario and g.cuenta_id is not null
              and g.fecha between a.fecha - 90 and a.fecha
              and position(lower(btrim(a.comercio)) in lower(g.descripcion)) > 0
            order by g.fecha desc, g.created_at desc
            limit 5
          ) f
          group by f.cuenta_id
          having count(*) >= 2
          order by count(*) desc
          limit 1;
          if v_frecuente is not null then
            select * into v_cuenta from cuentas where id = v_frecuente and usuario_id = v_usuario;
            update transacciones_detectadas set cuenta_id = v_frecuente where id = a.id;
            a.cuenta_id := v_frecuente;
          end if;
        end if;
        continue when v_cuenta.id is null or v_cuenta.tipo = 'efectivo';
        -- ¿El mismo cobro ya llegó por el otro correo? El recibo del comercio
        -- (Uber, sin banco ni hora) y el aviso del banco: misma tarjeta y monto,
        -- con hasta un día de diferencia y, si los dos traen la hora, hasta 3
        -- horas (Uber puede cobrar al pedir el viaje o al terminarlo). Va antes
        -- que la regla de Google Wallet para que la persona siempre lo confirme.
        -- No se registra otra vez: queda en la
        -- Bandeja marcado, y la persona confirma si es el mismo cobro u otro.
        -- Solo se compara un recibo con un aviso del banco: dos viajes iguales
        -- nunca se marcan entre sí.
        select g.id into v_existente
        from gastos g
        where g.usuario_id = v_usuario and g.cuenta_id = a.cuenta_id and g.monto = a.monto
          and g.fecha between a.fecha - 1 and a.fecha + 1
          and (a.pagado_en is null or g.pagado_en is null
               or abs(extract(epoch from g.pagado_en - a.pagado_en)) <= 3 * 3600)
          and exists (
            select 1 from transacciones_detectadas o
            where o.gasto_id = g.id and o.id <> a.id and o.origen = 'correo'
              and (o.banco is null) <> (a.banco is null)
          )
          and not exists (
            select 1 from transacciones_detectadas o
            where o.gasto_id = g.id and o.id <> a.id and (o.banco is null) = (a.banco is null)
          )
        -- El más cercano en hora (dos viajes iguales el mismo día, cada uno con su aviso).
        order by abs(extract(epoch from coalesce(g.pagado_en, a.pagado_en, now()) - coalesce(a.pagado_en, g.pagado_en, now()))),
                 g.created_at desc
        limit 1;
        if found then
          update transacciones_detectadas set posible_duplicado_de = v_existente where id = a.id;
          v_resultados := v_resultados || jsonb_build_object('aviso', a.id, 'resultado', 'verificar', 'clase', 'consumo', 'gasto_id', v_existente);
          continue;
        end if;

        -- Ya lo registró otro camino (Google Wallet) a la misma hora: no se duplica.
        select g.id into v_existente
        from gastos g
        where g.usuario_id = v_usuario and g.cuenta_id = a.cuenta_id and g.monto = a.monto
          and g.pagado_en is not null and a.pagado_en is not null
          and abs(extract(epoch from g.pagado_en - a.pagado_en)) <= 600
        limit 1;
        if found then
          update transacciones_detectadas set estado = 'confirmado', gasto_id = v_existente where id = a.id;
          v_resultados := v_resultados || jsonb_build_object('aviso', a.id, 'resultado', 'ya_registrado', 'clase', 'consumo', 'gasto_id', v_existente);
          continue;
        end if;
        -- ¿Lo anotaste tú a mano el mismo día (sin hora)? Que decida la persona.
        -- Un gasto que vino de otro aviso no cuenta: dos viajes iguales el
        -- mismo día son dos cobros.
        continue when exists (
          select 1 from gastos g
          where g.usuario_id = v_usuario and g.cuenta_id = a.cuenta_id and g.monto = a.monto
            and g.fecha = a.fecha and g.pagado_en is null
            and not exists (select 1 from transacciones_detectadas o where o.gasto_id = g.id)
        );

        v_comercio := coalesce(nullif(btrim(a.comercio), ''), a.descripcion);
        v_categoria := categoria_sugerida(v_usuario, v_comercio);
        v_lugar := lugar_por_comercio(v_usuario, a.comercio);
        insert into gastos (
          usuario_id, monto, descripcion, categoria_id, categoria_detalle, cuenta_id, fecha,
          metodo_pago, pagado_en, lugar_id
        ) values (
          v_usuario, a.monto, left(v_comercio, 200), v_categoria,
          case when (select nombre from categorias where id = v_categoria) = 'Otros' then left(v_comercio, 80) end,
          a.cuenta_id, a.fecha,
          case v_cuenta.tipo when 'credito' then 'credito' else 'debito' end,
          a.pagado_en, v_lugar
        )
        returning id into v_gasto;
        update transacciones_detectadas set estado = 'confirmado', gasto_id = v_gasto where id = a.id;
        select nombre into v_categoria_nombre from categorias where id = v_categoria;
        v_resultados := v_resultados || jsonb_strip_nulls(jsonb_build_object(
          'aviso', a.id, 'resultado', 'registrado', 'clase', 'consumo', 'gasto_id', v_gasto,
          'monto', a.monto, 'comercio', v_comercio, 'fecha', a.fecha,
          'cuenta', v_cuenta.nombre, 'tarjeta', coalesce(v_cuenta.identificador, a.tarjeta_final),
          'categoria', v_categoria_nombre, 'sin_lugar', v_lugar is null
        ));

      elsif a.clase = 'pago_tarjeta' then
        -- El mismo pago llega en dos correos (el del banco y el comprobante): se cuenta una vez.
        select o.id into v_existente
        from transacciones_detectadas o
        where o.usuario_id = v_usuario and o.id <> a.id and o.clase = 'pago_tarjeta' and o.estado = 'confirmado'
          and o.monto = a.monto and o.pagado_en is not null and a.pagado_en is not null
          and abs(extract(epoch from o.pagado_en - a.pagado_en)) <= 600
        limit 1;
        if found then
          update transacciones_detectadas set estado = 'confirmado' where id = a.id;
          v_resultados := v_resultados || jsonb_build_object('aviso', a.id, 'resultado', 'ya_registrado', 'clase', 'pago_tarjeta');
          continue;
        end if;
        -- Hace falta saber la tarjeta y de qué cuenta se pagó: si no, la Bandeja.
        continue when v_cuenta.id is null or v_cuenta.tipo <> 'credito' or v_otra.id is null or v_otra.tipo = 'credito';
        insert into pagos_tarjeta (usuario_id, cuenta_id, cuenta_origen_id, monto, fecha)
        values (v_usuario, a.cuenta_id, a.contraparte_cuenta_id, a.monto, a.fecha)
        returning id into v_pago;
        update transacciones_detectadas set estado = 'confirmado' where id = a.id;
        v_resultados := v_resultados || jsonb_strip_nulls(jsonb_build_object(
          'aviso', a.id, 'resultado', 'registrado', 'clase', 'pago_tarjeta', 'pago_id', v_pago,
          'monto', a.monto, 'fecha', a.fecha, 'cuenta', v_cuenta.nombre, 'origen', v_otra.nombre,
          'tarjeta', coalesce(v_cuenta.identificador, a.tarjeta_final)
        ));

      elsif a.clase = 'transferencia' then
        -- Solo entre cuentas propias: si el destino no es una cuenta tuya
        -- reconocida, no se sabe si es un gasto: la Bandeja.
        continue when v_cuenta.id is null or v_otra.id is null or v_cuenta.id = v_otra.id
          or v_cuenta.tipo = 'credito' or v_otra.tipo = 'credito';
        insert into transferencias (usuario_id, cuenta_origen_id, cuenta_destino_id, monto, fecha, descripcion, origen)
        values (v_usuario, a.cuenta_id, a.contraparte_cuenta_id, a.monto, a.fecha, 'Transferencia entre mis cuentas', 'correo')
        returning id into v_transferencia;
        -- La comisión del banco sí es un gasto.
        if coalesce(a.comision, 0) > 0 then
          v_categoria := categoria_sugerida(v_usuario, 'comisión bancaria');
          insert into gastos (usuario_id, monto, descripcion, categoria_id, categoria_detalle, cuenta_id, fecha, metodo_pago, pagado_en)
          values (
            v_usuario, a.comision, 'Comisión de transferencia', v_categoria,
            case when (select nombre from categorias where id = v_categoria) = 'Otros' then 'Comisión de transferencia' end,
            a.cuenta_id, a.fecha, case v_cuenta.tipo when 'debito' then 'debito' end, a.pagado_en
          );
        end if;
        update transacciones_detectadas set estado = 'confirmado', transferencia_id = v_transferencia where id = a.id;
        v_resultados := v_resultados || jsonb_strip_nulls(jsonb_build_object(
          'aviso', a.id, 'resultado', 'registrado', 'clase', 'transferencia', 'transferencia_id', v_transferencia,
          'monto', a.monto, 'fecha', a.fecha, 'cuenta', v_cuenta.nombre, 'destino', v_otra.nombre,
          'comision', a.comision
        ));
      end if;
    exception when others then
      -- Queda pendiente en la Bandeja (la subtransacción deshizo lo que alcanzó a escribir).
      null;
    end;
  end loop;

  return v_resultados;
end;
$$;

revoke all on function public.registrar_avisos_correo() from public, anon;
grant execute on function public.registrar_avisos_correo() to authenticated;
