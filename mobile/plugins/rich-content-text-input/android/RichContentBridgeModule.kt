package ru.titop.arenda.chat

import android.graphics.BitmapFactory
import android.net.Uri
import android.view.View
import androidx.core.view.ContentInfoCompat
import androidx.core.view.ViewCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.UIManagerHelper
import java.io.File
import java.util.UUID

class RichContentBridgeModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun attach(viewTag: Double, promise: Promise) {
    val tag = viewTag.toInt()
    context.runOnUiQueueThread {
      try {
        val view =
          UIManagerHelper.getUIManagerForReactTag(context, tag)?.resolveView(tag)
            ?: throw IllegalStateException("TextInput view not found")
        attachListener(view, tag)
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("ATTACH_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  private fun attachListener(view: View, viewTag: Int) {
    ViewCompat.setOnReceiveContentListener(
      view,
      SUPPORTED_MIME_TYPES,
    ) { _, payload ->
      val clip = payload.clip
      var handled = false
      for (index in 0 until clip.itemCount) {
        val uri = clip.getItemAt(index).uri ?: continue
        val mimeType =
          clip.description.filterMimeTypes("image/gif").firstOrNull()
            ?: continue
        handled = true
        copyAndEmit(uri, mimeType, viewTag)
      }
      if (handled) null else payload
    }
  }

  private fun copyAndEmit(uri: Uri, mimeType: String, viewTag: Int) {
    Thread {
      try {
        val directory = File(context.cacheDir, "keyboard-media").apply { mkdirs() }
        val destination = File(directory, "gboard_${UUID.randomUUID()}.gif")
        context.contentResolver.openInputStream(uri)?.use { input ->
          destination.outputStream().use(input::copyTo)
        } ?: return@Thread

        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(destination.absolutePath, options)
        val payload =
          Arguments.createMap().apply {
            putInt("viewTag", viewTag)
            putString("uri", Uri.fromFile(destination).toString())
            putString("fileName", destination.name)
            putString("mimeType", mimeType)
            putDouble("size", destination.length().toDouble())
            if (options.outWidth > 0) putInt("width", options.outWidth)
            if (options.outHeight > 0) putInt("height", options.outHeight)
          }

        context.runOnUiQueueThread {
          context
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_NAME, payload)
        }
      } catch (_: Exception) {
        // Keyboard URIs are short-lived. If access has already been revoked,
        // leave the typed message intact and simply skip the attachment.
      }
    }.start()
  }

  private companion object {
    const val MODULE_NAME = "RichContentBridge"
    const val EVENT_NAME = "titop.keyboardMedia"
    val SUPPORTED_MIME_TYPES = arrayOf("image/gif")
  }
}
