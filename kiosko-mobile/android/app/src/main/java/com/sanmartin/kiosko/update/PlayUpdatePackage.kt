package com.sanmartin.kiosko.update

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import java.util.concurrent.atomic.AtomicBoolean
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import com.sanmartin.kiosko.BuildConfig

class PlayUpdatePackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(PlayUpdateModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class PlayUpdateModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val manager = AppUpdateManagerFactory.create(context)
  private val preferences = context.getSharedPreferences("play_updates", 0)
  private var pending: Promise? = null
  private val requestCode = 7391
  private val listener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, request: Int, result: Int, data: Intent?) {
      if (request != requestCode) return
      val promise = pending
      pending = null
      if (result == Activity.RESULT_OK) promise?.resolve(null)
      else promise?.reject("UPDATE_CANCELLED", "La actualización no se completó. Debe actualizar para continuar.")
    }
  }

  init { context.addActivityEventListener(listener) }
  override fun getName() = "PlayUpdate"
  private fun required(): Boolean = preferences.getInt("requiredVersion", 0) > BuildConfig.VERSION_CODE

  @ReactMethod fun check(promise: Promise) {
    val settled = AtomicBoolean(false)
    val handler = Handler(Looper.getMainLooper())
    fun unavailable() {
      if (!settled.compareAndSet(false, true)) return
      promise.resolve(Arguments.createMap().apply {
        putBoolean("required", required())
        putBoolean("available", false)
        putBoolean("downloaded", false)
        putBoolean("downloading", false)
        putString("version", BuildConfig.VERSION_NAME)
        putInt("versionCode", BuildConfig.VERSION_CODE)
        putString("error", "No se pudo consultar Google Play. Compruebe la conexión y vuelva a intentar.")
      })
    }
    val timeout = Runnable { unavailable() }
    handler.postDelayed(timeout, 15000)
    manager.appUpdateInfo.addOnSuccessListener { info ->
      val available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE ||
        info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
      if (available) preferences.edit().putInt("requiredVersion", maxOf(preferences.getInt("requiredVersion", 0), info.availableVersionCode())).commit()
      handler.removeCallbacks(timeout)
      if (!settled.compareAndSet(false, true)) return@addOnSuccessListener
      promise.resolve(Arguments.createMap().apply {
        putBoolean("required", required())
        putBoolean("available", available)
        putBoolean("downloaded", info.installStatus() == InstallStatus.DOWNLOADED)
        putBoolean("downloading", info.installStatus() == InstallStatus.DOWNLOADING || info.installStatus() == InstallStatus.PENDING || info.installStatus() == InstallStatus.INSTALLING)
        putString("version", BuildConfig.VERSION_NAME)
        putInt("versionCode", BuildConfig.VERSION_CODE)
      })
    }.addOnFailureListener {
      // Retain a previously detected mandatory update even while offline or after relaunch.
      handler.removeCallbacks(timeout)
      unavailable()
    }
  }

  @ReactMethod fun install(promise: Promise) {
    context.runOnUiQueueThread {
      if (pending != null) { promise.reject("UPDATE_BUSY", "La actualización ya está abierta."); return@runOnUiQueueThread }
      manager.appUpdateInfo.addOnSuccessListener { info ->
        if (info.installStatus() == InstallStatus.DOWNLOADED) {
          manager.completeUpdate().addOnSuccessListener { promise.resolve(null) }
            .addOnFailureListener { promise.reject("UPDATE_INSTALL", "No se pudo instalar. Vuelva a intentar.", it) }
          return@addOnSuccessListener
        }
        val activity = context.currentActivity
        if (activity == null) { promise.reject("UPDATE_ACTIVITY", "Abra la aplicación para actualizar."); return@addOnSuccessListener }
        val type = if (info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) AppUpdateType.IMMEDIATE
          else if (info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) AppUpdateType.FLEXIBLE else AppUpdateType.IMMEDIATE
        if (!info.isUpdateTypeAllowed(type)) {
          promise.reject("UPDATE_UNAVAILABLE", "Google Play no permite actualizar ahora. Abra Google Play o vuelva a intentar.")
          return@addOnSuccessListener
        }
        try {
          pending = promise
          if (!manager.startUpdateFlowForResult(info, activity, AppUpdateOptions.newBuilder(type).build(), requestCode)) {
            pending = null
            promise.reject("UPDATE_START", "No se pudo iniciar la actualización.")
          }
        } catch (error: Exception) {
          pending = null
          promise.reject("UPDATE_START", "No se pudo iniciar la actualización.", error)
        }
      }.addOnFailureListener { promise.reject("UPDATE_CHECK", "No se pudo consultar Google Play. Vuelva a intentar.", it) }
    }
  }

  override fun invalidate() {
    context.removeActivityEventListener(listener)
    pending?.reject("UPDATE_CLOSED", "Se cerró la actualización.")
    pending = null
    super.invalidate()
  }
}
