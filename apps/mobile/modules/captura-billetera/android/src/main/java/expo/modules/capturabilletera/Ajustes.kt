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

  data class Conexion(val url: String, val apikey: String, val clave: String)

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

  /** Desconectar: borra la clave, los avisos pendientes y el último resultado. */
  fun borrar(context: Context) {
    preferencias(context).edit().clear().apply()
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
