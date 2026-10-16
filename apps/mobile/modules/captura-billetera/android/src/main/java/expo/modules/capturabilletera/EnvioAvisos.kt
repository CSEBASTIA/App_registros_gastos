package expo.modules.capturabilletera

import android.content.Context
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

/**
 * Envía a Supabase el título y el texto de cada notificación de Google
 * Wallet. La base (`registrar_aviso_billetera`) lee el monto, el comercio y
 * la tarjeta, y deja el aviso en la bandeja.
 *
 * Cada aviso se guarda antes de enviarse: si no hay internet, o Android
 * cierra la app a mitad, se reintenta con la siguiente notificación o al
 * abrir la app. Los pendientes duran 3 días y son 20 como máximo.
 */
internal object EnvioAvisos {
  const val PAQUETE_GOOGLE_WALLET = "com.google.android.apps.walletnfcrel"
  private const val MAXIMO_PENDIENTES = 20
  private const val VIGENCIA_MS = 3L * 24 * 60 * 60 * 1000
  private const val TIEMPO_ESPERA_MS = 15_000

  // Un solo hilo: los envíos van en orden y la lista de pendientes no se pisa.
  private val hilo = Executors.newSingleThreadExecutor()

  // Android vuelve a publicar la misma notificación al actualizarla.
  private val recientes = ArrayDeque<String>()

  private sealed class Resultado {
    class Listo(val estado: String, val monto: Double?) : Resultado()
    class Rechazado(val mensaje: String) : Resultado()
    class Reintentar(val mensaje: String) : Resultado()
  }

  fun encolar(context: Context, titulo: String, texto: String, cuando: Long, llave: String) {
    val app = context.applicationContext
    hilo.execute {
      val huella = "$llave|$titulo|$texto"
      if (recientes.contains(huella)) return@execute
      recientes.addLast(huella)
      if (recientes.size > 50) recientes.removeFirst()

      if (Ajustes.conexion(app) == null) return@execute
      val lista = Ajustes.pendientes(app)
      lista.put(
        JSONObject()
          .put("titulo", titulo.take(500))
          .put("texto", texto.take(500))
          .put("cuando", cuando)
      )
      Ajustes.guardarPendientes(app, vigentes(lista))
      enviarPendientes(app)
    }
  }

  fun reintentar(context: Context) {
    val app = context.applicationContext
    hilo.execute { enviarPendientes(app) }
  }

  /** Los últimos 20 de los últimos 3 días. */
  private fun vigentes(lista: JSONArray): JSONArray {
    val limite = System.currentTimeMillis() - VIGENCIA_MS
    val todos = (0 until lista.length())
      .mapNotNull { lista.optJSONObject(it) }
      .filter { it.optLong("cuando") >= limite }
      .takeLast(MAXIMO_PENDIENTES)
    return JSONArray().also { salida -> todos.forEach { salida.put(it) } }
  }

  private fun enviarPendientes(context: Context) {
    val conexion = Ajustes.conexion(context) ?: return
    val lista = vigentes(Ajustes.pendientes(context))
    val quedan = JSONArray()
    var sinConexion = false
    for (i in 0 until lista.length()) {
      val aviso = lista.getJSONObject(i)
      // Si uno no pudo salir por falta de red, los siguientes tampoco: se guardan.
      if (sinConexion) {
        quedan.put(aviso)
        continue
      }
      val resultado = enviar(conexion, aviso)
      val ultimo = JSONObject().put("cuando", System.currentTimeMillis())
      when (resultado) {
        is Resultado.Listo -> {
          ultimo.put("estado", resultado.estado)
          resultado.monto?.let { ultimo.put("monto", it) }
        }
        is Resultado.Rechazado -> ultimo.put("estado", "error").put("mensaje", resultado.mensaje)
        is Resultado.Reintentar -> {
          ultimo.put("estado", "pendiente").put("mensaje", resultado.mensaje)
          quedan.put(aviso)
          sinConexion = true
        }
      }
      Ajustes.guardarUltimo(context, ultimo)
    }
    Ajustes.guardarPendientes(context, quedan)
  }

  private fun enviar(c: Ajustes.Conexion, aviso: JSONObject): Resultado {
    val cuerpo = JSONObject()
      .put("p_clave", c.clave)
      .put("p_titulo", aviso.optString("titulo"))
      .put("p_texto", aviso.optString("texto"))
      .put("p_paquete", PAQUETE_GOOGLE_WALLET)
      .put("p_cuando", aviso.optLong("cuando").toString())
    var http: HttpURLConnection? = null
    return try {
      // La clave de captura va en el cuerpo, nunca en la dirección.
      val conexion = (URL(c.url.trimEnd('/') + "/rest/v1/rpc/registrar_aviso_billetera").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = TIEMPO_ESPERA_MS
        readTimeout = TIEMPO_ESPERA_MS
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Accept", "application/json")
        setRequestProperty("apikey", c.apikey)
      }
      http = conexion
      conexion.outputStream.use { it.write(cuerpo.toString().toByteArray(Charsets.UTF_8)) }
      val codigo = conexion.responseCode
      val respuesta = (if (codigo in 200..299) conexion.inputStream else conexion.errorStream)
        ?.bufferedReader(Charsets.UTF_8)
        ?.use { it.readText() }
        .orEmpty()
      when {
        codigo in 200..299 -> {
          val json = JSONObject(respuesta)
          Resultado.Listo(json.optString("estado", "recibido"), if (json.has("monto")) json.optDouble("monto") else null)
        }
        // 404: la base todavía no tiene la función (falta aplicar la actualización).
        codigo == 404 || codigo == 429 || codigo >= 500 -> Resultado.Reintentar("El servidor no lo recibió ($codigo): se reintentará.")
        codigo == 401 || codigo == 403 -> Resultado.Rechazado("La clave ya no es válida: vuelve a conectar Google Wallet.")
        else -> Resultado.Rechazado(mensajeDe(respuesta) ?: "No se pudo leer el pago ($codigo).")
      }
    } catch (e: IOException) {
      Resultado.Reintentar("Sin conexión: se enviará después.")
    } catch (e: Exception) {
      Resultado.Rechazado("Respuesta inesperada del servidor.")
    } finally {
      http?.disconnect()
    }
  }

  private fun mensajeDe(respuesta: String): String? =
    try {
      JSONObject(respuesta).optString("message").takeIf { it.isNotBlank() }?.take(200)
    } catch (e: Exception) {
      null
    }
}
