package ru.wigaj.arenda.chat

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class RichContentPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext,
  ): List<NativeModule> =
    listOf(
      RichContentBridgeModule(reactContext),
      WigajDownloadModule(reactContext),
    )

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
