package expo.modules.pdfcompartido

import android.content.Intent
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * «Compartir → FinTrack» con un PDF (WhatsApp, Archivos, Descargas…). Android
 * entrega el archivo en el extra EXTRA_STREAM de un ACTION_SEND, que React
 * Native no lee (solo lee los ACTION_VIEW, que llegan como enlace). Este
 * módulo solo devuelve la dirección content:// una vez; JavaScript la copia,
 * la lee en el lector de PDF sin internet y borra la copia.
 */
class PdfCompartidoModule : Module() {
  // Lo que llegó con la app ya abierta (onNewIntent no cambia getIntent()).
  private var pendiente: String? = null

  override fun definition() = ModuleDefinition {
    Name("PdfCompartido")

    /** La dirección del PDF compartido, o null. Se entrega una sola vez. */
    Function("tomar") {
      tomarPendiente()
    }

    OnNewIntent { intent ->
      uriDe(intent)?.let { pendiente = it }
    }
  }

  private fun tomarPendiente(): String? {
    val nuevo = pendiente
    pendiente = null
    if (nuevo != null) return nuevo
    val intent = appContext.currentActivity?.intent ?: return null
    return uriDe(intent)
  }

  private fun uriDe(intent: Intent): String? {
    if (intent.action != Intent.ACTION_SEND) return null
    if (intent.type?.startsWith("application/pdf") != true) return null
    val uri: Uri? = if (Build.VERSION.SDK_INT >= 33) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
    }
    // Se consume: al volver a la app no se vuelve a abrir el mismo PDF.
    intent.removeExtra(Intent.EXTRA_STREAM)
    intent.action = Intent.ACTION_MAIN
    return uri?.takeIf { it.scheme == "content" }?.toString()
  }
}
