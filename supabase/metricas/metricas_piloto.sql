-- Métricas del piloto: activación, frecuencia y retención.
--
-- Solo lectura y solo agregados: ninguna consulta muestra montos,
-- descripciones ni correos. Se calculan con lo que la base ya guarda
-- (auth.users.created_at y created_at de cada gasto/ingreso), sin
-- instrumentar la app ni usar servicios de terceros.
--
-- Cómo correrlas: en el SQL Editor de Supabase (rol postgres) o con psql.
-- NUNCA exponerlas a la app: leen auth.users de todos los usuarios.
--
-- Se excluyen las cuentas de prueba (correos @gastos.local, @prueba.local,
-- @fintrack.com). Ajustar el filtro en `participantes` si cambia.
--
-- Nota: se usa created_at (cuándo se anotó), no `fecha` (la fecha que la
-- persona eligió para el gasto): lo que mide el hábito es cuándo usa la app.

-- ---------------------------------------------------------------------
-- 1) Resumen del piloto: activación a 24 h y 7 días
-- ---------------------------------------------------------------------
with participantes as (
  select id, created_at as alta
  from auth.users
  where email not like '%@gastos.local'
    and email not like '%@prueba.local'
    and email not like '%@fintrack.com'
),
movimientos as (
  select usuario_id, created_at from gastos
  union all
  select usuario_id, created_at from ingresos
),
primer_mov as (
  select p.id, p.alta, min(m.created_at) as primero
  from participantes p
  left join movimientos m on m.usuario_id = p.id
  group by p.id, p.alta
)
select
  count(*)                                                                as registrados,
  count(*) filter (where primero is not null)                             as con_algun_movimiento,
  count(*) filter (where primero <= alta + interval '24 hours')           as activados_24h,
  count(*) filter (where primero <= alta + interval '7 days')             as activados_7d,
  round(100.0 * count(*) filter (where primero <= alta + interval '24 hours') / nullif(count(*), 0), 1)
                                                                          as pct_activacion_24h,
  round(100.0 * count(*) filter (where primero <= alta + interval '7 days') / nullif(count(*), 0), 1)
                                                                          as pct_activacion_7d,
  percentile_cont(0.5) within group (order by primero - alta)
    filter (where primero is not null)                                    as mediana_hasta_primer_movimiento
from primer_mov;

-- ---------------------------------------------------------------------
-- 2) Frecuencia semanal: movimientos y días activos por persona activa
-- ---------------------------------------------------------------------
with participantes as (
  select id from auth.users
  where email not like '%@gastos.local'
    and email not like '%@prueba.local'
    and email not like '%@fintrack.com'
),
movimientos as (
  select usuario_id, created_at from gastos
  union all
  select usuario_id, created_at from ingresos
)
select
  date_trunc('week', m.created_at)::date                       as semana,
  count(distinct m.usuario_id)                                 as personas_activas,
  count(*)                                                     as movimientos,
  round(count(*)::numeric / nullif(count(distinct m.usuario_id), 0), 1)
                                                               as movimientos_por_persona,
  round(count(distinct (m.usuario_id, m.created_at::date))::numeric
        / nullif(count(distinct m.usuario_id), 0), 1)          as dias_activos_por_persona
from movimientos m
join participantes p on p.id = m.usuario_id
group by 1
order by 1;

-- ---------------------------------------------------------------------
-- 3) Retención por cohorte (semana de alta): % que anota algo en la
--    semana 1, 2 y 4 después de registrarse (semana 0 = la del alta)
-- ---------------------------------------------------------------------
with participantes as (
  select id, created_at as alta, date_trunc('week', created_at)::date as cohorte
  from auth.users
  where email not like '%@gastos.local'
    and email not like '%@prueba.local'
    and email not like '%@fintrack.com'
),
movimientos as (
  select usuario_id, created_at from gastos
  union all
  select usuario_id, created_at from ingresos
),
semanas_activas as (
  select distinct p.id, p.cohorte,
         floor(extract(epoch from (m.created_at - p.alta)) / (7 * 24 * 3600))::int as semana_n
  from participantes p
  join movimientos m on m.usuario_id = p.id
)
select
  p.cohorte,
  count(distinct p.id)                                                         as personas,
  round(100.0 * count(distinct s.id) filter (where s.semana_n = 1) / count(distinct p.id), 1) as pct_semana_1,
  round(100.0 * count(distinct s.id) filter (where s.semana_n = 2) / count(distinct p.id), 1) as pct_semana_2,
  round(100.0 * count(distinct s.id) filter (where s.semana_n = 4) / count(distinct p.id), 1) as pct_semana_4
from participantes p
left join semanas_activas s on s.id = p.id
group by p.cohorte
order by p.cohorte;

-- ---------------------------------------------------------------------
-- 4) Qué funciones usa la gente (proporción de participantes)
-- ---------------------------------------------------------------------
with participantes as (
  select id from auth.users
  where email not like '%@gastos.local'
    and email not like '%@prueba.local'
    and email not like '%@fintrack.com'
)
select
  count(*)                                                                                        as participantes,
  round(100.0 * count(*) filter (where exists (select 1 from cuentas c where c.usuario_id = p.id)) / nullif(count(*), 0), 1)
                                                                                                  as pct_con_cuentas,
  round(100.0 * count(*) filter (where exists (select 1 from cuentas c where c.usuario_id = p.id and c.tipo = 'credito')) / nullif(count(*), 0), 1)
                                                                                                  as pct_con_tarjeta,
  round(100.0 * count(*) filter (where exists (select 1 from gastos g where g.usuario_id = p.id and g.metodo_pago = 'diferido')) / nullif(count(*), 0), 1)
                                                                                                  as pct_con_diferidos,
  round(100.0 * count(*) filter (where exists (select 1 from presupuestos x where x.usuario_id = p.id)) / nullif(count(*), 0), 1)
                                                                                                  as pct_con_presupuesto,
  round(100.0 * count(*) filter (where exists (select 1 from deudas d where d.usuario_id = p.id)) / nullif(count(*), 0), 1)
                                                                                                  as pct_con_deudas,
  round(100.0 * count(*) filter (where exists (select 1 from transacciones_detectadas t where t.usuario_id = p.id)) / nullif(count(*), 0), 1)
                                                                                                  as pct_uso_correo
from participantes p;
