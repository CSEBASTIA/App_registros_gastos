package expo.modules.capturabilletera

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import java.util.Locale
import org.json.JSONObject

/**
 * Las notificaciones que el teléfono muestra al enviar un pago de Google
 * Wallet, aunque la app esté cerrada: «Registré $12.50 en SUPERMAXI», «Pago
 * por confirmar» y, si ese pago cruzó un nivel de un presupuesto, ese aviso.
 * Son locales (no pasan por ningún servidor de avisos). En la pantalla
 * bloqueada se muestra una versión sin montos si la persona lo pidió así en
 * Android. Los mismos canales los usa la app para los avisos que programa.
 * Al tocarlas se abre la pantalla correspondiente (gastosapp://…).
 */
internal object Notificaciones {
  const val CANAL_PAGOS = "fintrack_pagos"
  const val CANAL_BANDEJA = "fintrack_bandeja"
  const val CANAL_PRESUPUESTOS = "fintrack_presupuestos"

  private fun monto(valor: Double): String = String.format(Locale.US, "$%.2f", valor)

  /** «Google Wallet» o «Pago» no son un comercio. */
  private fun comercioDe(texto: String?): String? =
    texto?.trim()?.takeIf {
      it.isNotEmpty() && !Regex("^(google ?wallet|wallet|google ?pay|g ?pay|pago|pagos|compra)\\W*$", RegexOption.IGNORE_CASE).matches(it)
    }?.take(60)

  private fun crearCanales(manager: NotificationManager) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    listOf(
      Triple(CANAL_PAGOS, "Pagos registrados", "Pagos con billetera que se registraron solos."),
      Triple(CANAL_BANDEJA, "Pagos por confirmar", "Pagos detectados que esperan en la bandeja."),
      Triple(CANAL_PRESUPUESTOS, "Presupuestos", "Cuando llegas al 75 %, al 100 % o te pasas de un presupuesto."),
    ).forEach { (id, nombre, descripcion) ->
      val canal = NotificationChannel(id, nombre, NotificationManager.IMPORTANCE_DEFAULT)
      canal.description = descripcion
      canal.lockscreenVisibility = Notification.VISIBILITY_PRIVATE
      manager.createNotificationChannel(canal)
    }
  }

  private fun puedeAvisar(context: Context, manager: NotificationManager): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return false
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.N || manager.areNotificationsEnabled()
  }

  private fun constructor(context: Context, canal: String): Notification.Builder {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, canal)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context).setPriority(Notification.PRIORITY_DEFAULT)
    }
    // El ícono blanco que genera expo-notifications; si no está, el de la app.
    val icono = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    builder.setSmallIcon(if (icono != 0) icono else context.applicationInfo.icon)
    val color = context.resources.getIdentifier("notification_icon_color", "color", context.packageName)
    if (color != 0) builder.setColor(context.getColor(color))
    return builder.setAutoCancel(true).setShowWhen(true)
  }

  private fun mostrar(
    context: Context,
    canal: String,
    id: Int,
    titulo: String,
    texto: String,
    tituloPublico: String,
    enlace: String,
  ) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    crearCanales(manager)
    if (!puedeAvisar(context, manager)) return
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(enlace))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val abrir = PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    // Lo que se ve con la pantalla bloqueada si la persona ocultó el contenido sensible.
    val publica = constructor(context, canal).setContentTitle(tituloPublico).setContentText("Toca para verlo.").build()
    val notificacion = constructor(context, canal)
      .setContentTitle(titulo)
      .setContentText(texto)
      .setStyle(Notification.BigTextStyle().bigText(texto))
      .setContentIntent(abrir)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setPublicVersion(publica)
      .build()
    try {
      manager.notify(id, notificacion)
    } catch (e: SecurityException) {
      // Sin permiso de notificaciones: el pago ya se registró igual.
    }
  }

  /**
   * Después de enviar un aviso: `respuesta` es lo que devolvió la base.
   * `tituloAviso` es el título de la notificación de Google Wallet (el comercio,
   * casi siempre), por si la respuesta no lo trae.
   */
  fun alEnviar(context: Context, respuesta: JSONObject, tituloAviso: String) {
    val avisos = Ajustes.avisos(context)
    val valor = if (respuesta.has("monto")) monto(respuesta.optDouble("monto")) else "un pago"
    val comercio = comercioDe(respuesta.optString("comercio").takeIf { it.isNotBlank() }) ?: comercioDe(tituloAviso)
    val base = (System.currentTimeMillis() % 1_000_000L).toInt() * 4

    when (respuesta.optString("estado")) {
      "registrado" -> {
        if (avisos.pagos) {
          val tarjeta = respuesta.optString("tarjeta").takeIf { it.isNotBlank() }?.let { "Con tu tarjeta •••• $it" }
          val categoria = respuesta.optString("categoria").takeIf { it.isNotBlank() }
          val detalle = listOfNotNull(tarjeta, categoria).joinToString(" · ")
          val gasto = respuesta.optString("gasto_id")
          mostrar(
            context, CANAL_PAGOS, base,
            titulo = if (comercio != null) "Registré $valor en $comercio" else "Registré un pago de $valor",
            texto = listOf(detalle, "Toca para revisarlo o corregirlo.").filter { it.isNotBlank() }.joinToString(". "),
            tituloPublico = "Registré un pago",
            enlace = if (gasto.isNotBlank()) "gastosapp://gasto/editar?id=${Uri.encode(gasto)}" else "gastosapp://gastos",
          )
        }
        respuesta.optJSONObject("presupuesto")?.let { if (avisos.presupuestos) avisarPresupuesto(context, it, base + 1) }
      }
      "recibido" -> if (avisos.bandeja) {
        mostrar(
          context, CANAL_BANDEJA, base + 2,
          titulo = "Pago de $valor por confirmar",
          texto = listOfNotNull(comercio, "Confírmalo en la bandeja para que tus saldos queden al día.").joinToString(". "),
          tituloPublico = "Un pago por confirmar",
          enlace = "gastosapp://bandeja",
        )
      }
    }
  }

  /** Mismos textos que `textoAvisoPresupuesto` en core (packages/core/src/lib/notificaciones.ts). */
  private fun avisarPresupuesto(context: Context, p: JSONObject, id: Int) {
    val categoria = p.optString("categoria").ifBlank { "Sin categoría" }
    val gastado = p.optDouble("gastado", 0.0)
    val limite = p.optDouble("limite", 0.0)
    val (titulo, texto) = when (p.optInt("nivel")) {
      101 -> "Te pasaste del presupuesto de $categoria" to
        "Llevas ${monto(gastado)}: ${monto(Math.round((gastado - limite) * 100) / 100.0)} más que el límite de ${monto(limite)}."
      100 -> "Llegaste al límite de $categoria" to "Gastaste ${monto(gastado)} de ${monto(limite)} este mes."
      75 -> "Presupuesto de $categoria: ${p.optDouble("porcentaje", 75.0).toInt()} %" to
        "Llevas ${monto(gastado)} de ${monto(limite)} este mes. Te quedan ${monto(Math.round((limite - gastado) * 100) / 100.0)}."
      else -> return
    }
    mostrar(context, CANAL_PRESUPUESTOS, id, titulo, texto, "Aviso de presupuesto", "gastosapp://presupuestos")
  }
}
