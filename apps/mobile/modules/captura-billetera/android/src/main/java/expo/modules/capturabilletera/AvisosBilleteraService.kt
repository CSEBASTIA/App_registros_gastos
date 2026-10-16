package expo.modules.capturabilletera

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Android avisa a este servicio de cada notificación, pero solo se miran las
 * de Google Wallet: las demás se ignoran sin leer su contenido. Del aviso se
 * toman el título y el texto; no se guarda nada más.
 */
class AvisosBilleteraService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    val aviso = sbn ?: return
    if (aviso.packageName != EnvioAvisos.PAQUETE_GOOGLE_WALLET) return
    val notificacion = aviso.notification ?: return
    // El resumen de un grupo repite lo que dicen las notificaciones del grupo.
    if ((notificacion.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return
    val extras = notificacion.extras ?: return
    val titulo = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val texto = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))
      ?.toString()
      .orEmpty()
    if (titulo.isBlank() && texto.isBlank()) return
    EnvioAvisos.encolar(this, titulo, texto, aviso.postTime, aviso.key)
  }
}
