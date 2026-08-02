package ru.wigaj.arenda.chat

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.BufferedInputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class WigajDownloadModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
  private val executor = Executors.newCachedThreadPool()

  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun downloadAndOpen(
    url: String,
    fileName: String,
    mimeType: String,
    promise: Promise,
  ) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.reject("UNSUPPORTED_ANDROID", "Автоматическое сохранение в Downloads требует Android 10 или новее.")
      return
    }
    if (!url.startsWith("https://")) {
      promise.reject("INVALID_URL", "Недопустимый адрес файла.")
      return
    }

    executor.execute {
      var connection: HttpURLConnection? = null
      var outputUri: Uri? = null
      try {
        val safeName = sanitizeFileName(fileName)
        val values =
          ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, safeName)
            put(MediaStore.Downloads.MIME_TYPE, mimeType.ifBlank { "application/octet-stream" })
            put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/$DOWNLOAD_FOLDER")
            put(MediaStore.Downloads.IS_PENDING, 1)
          }

        val resolver = context.contentResolver
        outputUri =
          resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: throw IOException("Не удалось создать файл в Downloads")

        connection = (URL(url).openConnection() as HttpURLConnection).apply {
          connectTimeout = 15_000
          readTimeout = 60_000
          instanceFollowRedirects = true
          requestMethod = "GET"
        }
        if (connection!!.responseCode !in 200..299) {
          throw IOException("Сервер вернул HTTP ${connection!!.responseCode}")
        }

        resolver.openOutputStream(outputUri!!)?.use { output ->
          BufferedInputStream(connection!!.inputStream).use { input ->
            val buffer = ByteArray(BUFFER_SIZE)
            var total = 0L
            while (true) {
              val read = input.read(buffer)
              if (read < 0) break
              total += read
              if (total > MAX_DOWNLOAD_BYTES) {
                throw IOException("Файл превышает допустимый размер")
              }
              output.write(buffer, 0, read)
            }
          }
        } ?: throw IOException("Не удалось записать файл")

        resolver.update(
          outputUri!!,
          ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) },
          null,
          null,
        )

        val openIntent =
          Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(outputUri, mimeType.ifBlank { "application/octet-stream" })
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
        val opened =
          if (openIntent.resolveActivity(context.packageManager) != null) {
            context.startActivity(openIntent)
            true
          } else {
            false
          }

        val result =
          com.facebook.react.bridge.Arguments.createMap().apply {
            putString("uri", outputUri.toString())
            putBoolean("opened", opened)
          }
        promise.resolve(result)
      } catch (error: Exception) {
        outputUri?.let { context.contentResolver.delete(it, null, null) }
        promise.reject("DOWNLOAD_FAILED", error.message ?: "Не удалось скачать файл", error)
      } finally {
        connection?.disconnect()
      }
    }
  }

  private fun sanitizeFileName(value: String): String {
    val cleaned = value.trim().replace(Regex("""[\\/:*?"<>|]"""), "_").trim('.')
    return if (cleaned.isBlank()) "document_${System.currentTimeMillis()}" else cleaned
  }

  private companion object {
    const val MODULE_NAME = "WigajDownload"
    const val DOWNLOAD_FOLDER = "WIGAJ"
    const val BUFFER_SIZE = 64 * 1024
    const val MAX_DOWNLOAD_BYTES = 50L * 1024L * 1024L
  }
}
