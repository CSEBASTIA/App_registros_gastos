package expo.modules.capturabilletera

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Lo que el teléfono guarda para enviar los avisos, en el almacenamiento
 * privado de la app (otras apps no lo pueden leer). La clave de captura solo
 * sirve para dejar pagos en la bandeja, tiene límite de uso y se revoca desde
 * la app o desde cualquier otro dispositivo.
 */
internal object Ajustes {
  private const val ARCHIVO = "fintrack_captura_billetera"
  private const val URL = "url"
  private const val APIKEY = "apikey"
  private const val CLAVE = "clave"
  private const val PENDIENTES = "pendientes"
  private const val ULTIMO = "ultimo"
  private const val AVISO_PAGOS = "aviso_pagos"
  private const val AVISO_BANDEJA = "aviso_bandeja"
  private const val AVISO_PRESUPUESTOS = "aviso_presupuestos"

  data class Conexion(val url: String, val apikey: String, val clave: String)

  /** Qué notificaciones mostrar al enviar un pago (se eligen en Más → Notificaciones). */
  data class Avisos(val pagos: Boolean, val bandeja: Boolean, val presupuestos: Boolean)

  private fun preferencias(context: Context) =
    context.applicationContext.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE)

  fun conexion(context: Context): Conexion? {
    val p = preferencias(context)
    val url = p.getString(URL, null) ?: return null
    val apikey = p.getString(APIKEY, null) ?: return null
    val clave = p.getString(CLAVE, null) ?: return null
    return Conexion(url, apikey, clave)
  }

  fun guardarConexion(context: Context, url: String, apikey: String, clave: String) {
    preferencias(context).edit()
      .putString(URL, url)
      .putString(APIKEY, apikey)
      .putString(CLAVE, clave)
      .apply()
  }

  /**
   * Desconectar: borra la clave, los avisos pendientes y el último resultado.
   * Las preferencias de notificaciones son de la persona, no de la conexión: se quedan.
   */
  fun borrar(context: Context) {
    preferencias(context).edit()
      .remove(URL)
      .remove(APIKEY)
      .remove(CLAVE)
      .remove(PENDIENTES)
      .remove(ULTIMO)
      .apply()
  }

  fun avisos(context: Context): Avisos {
    val p = preferencias(context)
    return Avisos(
      pagos = p.getBoolean(AVISO_PAGOS, true),
      bandeja = p.getBoolean(AVISO_BANDEJA, true),
      presupuestos = p.getBoolean(AVISO_PRESUPUESTOS, true),
    )
  }

  fun guardarAvisos(context: Context, avisos: Avisos) {
    preferencias(context).edit()
      .putBoolean(AVISO_PAGOS, avisos.pagos)
      .putBoolean(AVISO_BANDEJA, avisos.bandeja)
      .putBoolean(AVISO_PRESUPUESTOS, avisos.presupuestos)
      .apply()
  }

  fun pendientes(context: Context): JSONArray =
    try {
      JSONArray(preferencias(context).getString(PENDIENTES, "[]"))
    } catch (e: Exception) {
      JSONArray()
    }

  fun guardarPendientes(context: Context, lista: JSONArray) {
    preferencias(context).edit().putString(PENDIENTES, lista.toString()).apply()
  }

  fun ultimo(context: Context): String? = preferencias(context).getString(ULTIMO, null)

  fun guardarUltimo(context: Context, resultado: JSONObject) {
    preferencias(context).edit().putString(ULTIMO, resultado.toString()).apply()
  }
}
