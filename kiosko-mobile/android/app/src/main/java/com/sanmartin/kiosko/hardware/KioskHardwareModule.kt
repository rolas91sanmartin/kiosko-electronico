package com.sanmartin.kiosko.hardware

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Build
import android.util.Base64
import android.view.KeyEvent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileInputStream
import java.lang.ref.WeakReference
import kotlin.concurrent.thread

class KioskHardwareModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  private val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
  private val permissionAction = "${context.packageName}.USB_PERMISSION"
  private var permissionPromise: Promise? = null
  private var scannerEnabled = false
  private var nfcEnabled = false
  @Volatile private var serialRunning = false
  private var serialInput: FileInputStream? = null
  private var serialThread: Thread? = null

  private val usbPermissionReceiver = object : BroadcastReceiver() {
    override fun onReceive(receiverContext: Context?, intent: Intent?) {
      if (intent?.action != permissionAction) return
      val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
      permissionPromise?.resolve(granted)
      permissionPromise = null
      emit("KioskHardwareUsbPermission", Arguments.createMap().apply {
        putBoolean("granted", granted)
      })
    }
  }

  init {
    activeModule = WeakReference(this)
    ContextCompat.registerReceiver(
      context,
      usbPermissionReceiver,
      IntentFilter(permissionAction),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )
  }

  override fun getName() = "KioskHardwareModule"

  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Int) = Unit

  @ReactMethod
  fun getHardwareDiagnostics(promise: Promise) {
    try {
      promise.resolve(Arguments.createMap().apply {
        putMap("android", Arguments.createMap().apply {
          putString("version", Build.VERSION.RELEASE)
          putInt("sdk", Build.VERSION.SDK_INT)
          putString("abi", Build.SUPPORTED_ABIS.firstOrNull() ?: Build.CPU_ABI)
          putArray("supportedAbis", Arguments.fromList(Build.SUPPORTED_ABIS.toList()))
          putString("manufacturer", Build.MANUFACTURER)
          putString("model", Build.MODEL)
        })
        putArray("usbDevices", usbDevices())
        putArray("serialPorts", Arguments.fromList(serialPorts()))
        putArray("cameras", cameras())
        val adapter = NfcAdapter.getDefaultAdapter(context)
        putMap("nfc", Arguments.createMap().apply {
          putBoolean("available", adapter != null)
          putBoolean("enabled", adapter?.isEnabled == true)
        })
      })
    } catch (error: Throwable) {
      promise.reject("HARDWARE_DIAGNOSTICS_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun setScannerEnabled(enabled: Boolean) {
    scannerEnabled = enabled
  }

  @ReactMethod
  fun startSerialScanner(path: String, promise: Promise) {
    val port = File(path)
    if (!Regex("^/dev/ttyS\\d+$").matches(path) || !port.exists() || !port.canRead()) {
      promise.reject("SERIAL_PORT_UNAVAILABLE", "El puerto serial no existe o no puede leerse: $path")
      return
    }
    stopSerialReader()
    try {
      val input = FileInputStream(port)
      serialInput = input
      serialRunning = true
      serialThread = thread(start = true, isDaemon = true, name = "KioskSerialScanner") {
        val bytes = ByteArray(256)
        try {
          while (serialRunning) {
            val count = input.read(bytes)
            if (count < 0) break
            for (index in 0 until count) {
              val value = bytes[index].toInt() and 0xff
              val enter = value == 10 || value == 13
              emit("KioskHardwareKey", Arguments.createMap().apply {
                putString("character", if (enter) "" else value.toChar().toString())
                putInt("keyCode", if (enter) KeyEvent.KEYCODE_ENTER else 0)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
                putInt("deviceId", -2)
                putBoolean("external", true)
              })
            }
          }
        } catch (error: Throwable) {
          if (serialRunning) emit("KioskHardwareSerialError", Arguments.createMap().apply {
            putString("path", path)
            putString("message", error.message ?: "Error de lectura serial")
          })
        } finally {
          runCatching { input.close() }
          serialRunning = false
        }
      }
      promise.resolve(true)
    } catch (error: Throwable) {
      serialRunning = false
      promise.reject("SERIAL_OPEN_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun stopSerialScanner(promise: Promise) {
    stopSerialReader()
    promise.resolve(null)
  }

  @ReactMethod
  fun requestUsbPermission(vendorId: Int, productId: Int, promise: Promise) {
    val device = findDevice(vendorId, productId)
    if (device == null) {
      promise.reject("USB_DEVICE_NOT_FOUND", "No se encontró el dispositivo USB solicitado.")
      return
    }
    if (usbManager.hasPermission(device)) {
      promise.resolve(true)
      return
    }
    if (permissionPromise != null) {
      promise.reject("USB_PERMISSION_BUSY", "Ya existe una solicitud de permiso USB activa.")
      return
    }
    permissionPromise = promise
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
    val pending = PendingIntent.getBroadcast(
      context,
      0,
      Intent(permissionAction).setPackage(context.packageName),
      flags,
    )
    usbManager.requestPermission(device, pending)
  }

  @ReactMethod
  fun hasUsbPermission(vendorId: Int, productId: Int, promise: Promise) {
    promise.resolve(findDevice(vendorId, productId)?.let(usbManager::hasPermission) == true)
  }

  @ReactMethod
  fun printUsb(base64: String, vendorId: Int?, productId: Int?, timeoutMs: Int, promise: Promise) {
    thread(start = true, name = "KioskUsbPrinter") {
      var connection: android.hardware.usb.UsbDeviceConnection? = null
      try {
        val selected = selectPrinter(vendorId, productId)
          ?: throw HardwareException("NO_USB_PRINTER", "No se encontró una impresora USB con endpoint Bulk OUT.")
        val (device, usbInterface, endpoint) = selected
        if (!usbManager.hasPermission(device)) {
          throw HardwareException("USB_PERMISSION_REQUIRED", "La impresora requiere permiso USB.")
        }
        connection = usbManager.openDevice(device)
          ?: throw HardwareException("USB_OPEN_FAILED", "Android no pudo abrir la impresora USB.")
        if (!connection.claimInterface(usbInterface, true)) {
          throw HardwareException("USB_OPEN_FAILED", "No se pudo reclamar la interfaz USB de impresión.")
        }
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        var offset = 0
        while (offset < bytes.size) {
          val length = minOf(16_384, bytes.size - offset)
          val written = connection.bulkTransfer(endpoint, bytes, offset, length, timeoutMs.coerceAtLeast(250))
          if (written <= 0) {
            val code = if (written == 0) "PRINTER_TIMEOUT" else "PRINT_WRITE_FAILED"
            throw HardwareException(code, "Falló la escritura USB en byte $offset.")
          }
          offset += written
        }
        promise.resolve(Arguments.createMap().apply {
          putBoolean("printed", true)
          putInt("bytesWritten", offset)
          putInt("vendorId", device.vendorId)
          putInt("productId", device.productId)
        })
      } catch (error: HardwareException) {
        promise.reject(error.code, error.message, error)
      } catch (error: Throwable) {
        promise.reject("PRINT_WRITE_FAILED", error.message, error)
      } finally {
        connection?.close()
      }
    }
  }

  @ReactMethod
  fun startNfc(promise: Promise) {
    val activity = context.currentActivity
    val adapter = NfcAdapter.getDefaultAdapter(context)
    if (adapter == null) {
      promise.resolve(false)
      return
    }
    if (activity == null) {
      promise.reject("NFC_ACTIVITY_UNAVAILABLE", "No hay una actividad Android activa.")
      return
    }
    val mutableFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
    val pending = PendingIntent.getActivity(
      context,
      0,
      Intent(context, activity.javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
      PendingIntent.FLAG_UPDATE_CURRENT or mutableFlag,
    )
    activity.runOnUiThread {
      try {
        adapter.enableForegroundDispatch(activity, pending, null, null)
        nfcEnabled = true
        promise.resolve(true)
      } catch (error: Throwable) {
        promise.reject("NFC_START_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun stopNfc(promise: Promise) {
    val activity = context.currentActivity
    val adapter = NfcAdapter.getDefaultAdapter(context)
    if (adapter == null || activity == null) {
      nfcEnabled = false
      promise.resolve(null)
      return
    }
    activity.runOnUiThread {
      runCatching { adapter.disableForegroundDispatch(activity) }
      nfcEnabled = false
      promise.resolve(null)
    }
  }

  override fun invalidate() {
    stopSerialReader()
    runCatching { context.unregisterReceiver(usbPermissionReceiver) }
    activeModule.clear()
    super.invalidate()
  }

  private fun emit(name: String, body: WritableMap) {
    if (context.hasActiveReactInstance()) {
      context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(name, body)
    }
  }

  private fun handleKey(event: KeyEvent): Boolean {
    if (!scannerEnabled || event.action != KeyEvent.ACTION_DOWN || event.repeatCount > 0) return false
    emit("KioskHardwareKey", Arguments.createMap().apply {
      putString("character", event.unicodeChar.takeIf { it > 0 }?.toChar()?.toString() ?: "")
      putInt("keyCode", event.keyCode)
      putDouble("timestamp", event.eventTime.toDouble())
      putInt("deviceId", event.deviceId)
      putBoolean("external", event.device?.isExternal == true)
    })
    return event.keyCode == KeyEvent.KEYCODE_ENTER || event.keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER
  }

  private fun handleNfc(intent: Intent) {
    if (!nfcEnabled || intent.action !in NFC_ACTIONS) return
    val tag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra(NfcAdapter.EXTRA_TAG) as? Tag
    } ?: return
    emit("KioskHardwareNfcTag", Arguments.createMap().apply {
      putString("id", tag.id.joinToString("") { "%02X".format(it) })
      putArray("technologies", Arguments.fromList(tag.techList.toList()))
    })
  }

  private fun usbDevices(): WritableArray = Arguments.createArray().apply {
    usbManager.deviceList.values.forEach { pushMap(usbDeviceMap(it)) }
  }

  private fun serialPorts(): List<String> = (0..9)
    .map { "/dev/ttyS$it" }
    .filter { File(it).let { file -> file.exists() && file.canRead() } }

  private fun stopSerialReader() {
    serialRunning = false
    runCatching { serialInput?.close() }
    serialInput = null
    serialThread?.interrupt()
    serialThread = null
  }

  private fun usbDeviceMap(device: UsbDevice): WritableMap = Arguments.createMap().apply {
    putString("deviceName", device.deviceName)
    putInt("deviceId", device.deviceId)
    putInt("vendorId", device.vendorId)
    putInt("productId", device.productId)
    putInt("deviceClass", device.deviceClass)
    putBoolean("permission", usbManager.hasPermission(device))
    putString("manufacturerName", runCatching { device.manufacturerName }.getOrNull())
    putString("productName", runCatching { device.productName }.getOrNull())
    putBoolean("hid", (0 until device.interfaceCount).any {
      device.getInterface(it).interfaceClass == UsbConstants.USB_CLASS_HID
    })
    putArray("interfaces", Arguments.createArray().apply {
      for (interfaceIndex in 0 until device.interfaceCount) {
        val usbInterface = device.getInterface(interfaceIndex)
        pushMap(Arguments.createMap().apply {
          putInt("id", usbInterface.id)
          putInt("interfaceClass", usbInterface.interfaceClass)
          putInt("interfaceSubclass", usbInterface.interfaceSubclass)
          putInt("interfaceProtocol", usbInterface.interfaceProtocol)
          putArray("endpoints", Arguments.createArray().apply {
            for (endpointIndex in 0 until usbInterface.endpointCount) {
              val endpoint = usbInterface.getEndpoint(endpointIndex)
              pushMap(Arguments.createMap().apply {
                putInt("address", endpoint.address)
                putInt("type", endpoint.type)
                putInt("direction", endpoint.direction)
                putInt("maxPacketSize", endpoint.maxPacketSize)
              })
            }
          })
        })
      }
    })
  }

  private fun cameras(): WritableArray = Arguments.createArray().apply {
    val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    manager.cameraIdList.forEach { id ->
      val characteristics = manager.getCameraCharacteristics(id)
      val facing = when (characteristics.get(CameraCharacteristics.LENS_FACING)) {
        CameraCharacteristics.LENS_FACING_FRONT -> "front"
        CameraCharacteristics.LENS_FACING_BACK -> "back"
        CameraCharacteristics.LENS_FACING_EXTERNAL -> "external"
        else -> "unknown"
      }
      pushMap(Arguments.createMap().apply {
        putString("id", id)
        putString("facing", facing)
        putBoolean("external", facing == "external")
        putInt("hardwareLevel", characteristics.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL) ?: -1)
      })
    }
  }

  private fun findDevice(vendorId: Int, productId: Int): UsbDevice? =
    usbManager.deviceList.values.firstOrNull { it.vendorId == vendorId && it.productId == productId }

  private fun selectPrinter(vendorId: Int?, productId: Int?): Triple<UsbDevice, UsbInterface, UsbEndpoint>? {
    val candidates = usbManager.deviceList.values
      .filter { (vendorId == null || it.vendorId == vendorId) && (productId == null || it.productId == productId) }
      .sortedByDescending { device ->
        (0 until device.interfaceCount).any { device.getInterface(it).interfaceClass == UsbConstants.USB_CLASS_PRINTER }
      }
    candidates.forEach { device ->
      for (interfaceIndex in 0 until device.interfaceCount) {
        val usbInterface = device.getInterface(interfaceIndex)
        for (endpointIndex in 0 until usbInterface.endpointCount) {
          val endpoint = usbInterface.getEndpoint(endpointIndex)
          if (endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK && endpoint.direction == UsbConstants.USB_DIR_OUT) {
            return Triple(device, usbInterface, endpoint)
          }
        }
      }
    }
    return null
  }

  private class HardwareException(val code: String, message: String) : Exception(message)

  companion object {
    private var activeModule = WeakReference<KioskHardwareModule>(null)
    private val NFC_ACTIONS = setOf(
      NfcAdapter.ACTION_TAG_DISCOVERED,
      NfcAdapter.ACTION_TECH_DISCOVERED,
      NfcAdapter.ACTION_NDEF_DISCOVERED,
    )

    @JvmStatic fun dispatchKeyEvent(event: KeyEvent): Boolean = activeModule.get()?.handleKey(event) == true
    @JvmStatic fun onNewIntent(intent: Intent) { activeModule.get()?.handleNfc(intent) }
  }
}
