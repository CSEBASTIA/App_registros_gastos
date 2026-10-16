package expo.modules.capturabilletera

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Lo que la pantalla «Conectar Google Wallet» usa desde JavaScript. */
class CapturaBilleteraModule : Module() {
  private val contexto: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("CapturaBilletera")

    /**
     * {conectado, prefijo, permiso, pendientes, ultimo}: `ultimo` es un JSON o
     * null. `prefijo` (6 caracteres, como en la lista de claves) sirve para
     * revocar la clave al desconectar; la clave completa nunca sale de aquí.
     */
    Function("estado") {
      val c = contexto
      val conexion = Ajustes.conexion(c)
      mapOf(
        "conectado" to (conexion != null),
        "prefijo" to conexion?.clave?.substring(3, 9),
        "permiso" to permisoConcedido(c),
        "pendientes" to Ajustes.pendientes(c).length(),
        "ultimo" to Ajustes.ultimo(c)
      )
    }

    Function("conectar") { url: String, apikey: String, clave: String ->
      require(url.startsWith("https://")) { "La dirección de Supabase debe empezar con https://" }
      require(apikey.isNotBlank()) { "Falta la clave pública de Supabase." }
      require(Regex("^ft_[0-9a-f]{64}$").matches(clave)) { "Clave de captura no válida." }
      Ajustes.guardarConexion(contexto, url, apikey, clave)
    }

    Function("desconectar") {
      Ajustes.borrar(contexto)
    }

    /** Abre el ajuste de Android donde el usuario activa el acceso a notificaciones. */
    Function("abrirPermiso") {
      val c = contexto
      val componente = ComponentName(c, AvisosBilleteraService::class.java)
      val directo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
          .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, componente.flattenToString())
      } else {
        null
      }
      val lista = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      try {
        c.startActivity((directo ?: lista).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      } catch (e: ActivityNotFoundException) {
        c.startActivity(lista.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    Function("reintentar") {
      EnvioAvisos.reintentar(contexto)
    }
  }

  private fun permisoConcedido(c: Context): Boolean {
    val activos = Settings.Secure.getString(c.contentResolver, "enabled_notification_listeners") ?: return false
    val nuestro = ComponentName(c, AvisosBilleteraService::class.java)
    return activos.split(':').mapNotNull { ComponentName.unflattenFromString(it) }.any { it == nuestro }
  }
}
