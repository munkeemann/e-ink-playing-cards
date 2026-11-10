package com.example.androidapp.ble

import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import kotlinx.coroutines.*
import java.io.File

class BleImageSender(private val context: Context) {

    private var bluetoothGatt: BluetoothGatt? = null
    private var writeChar: BluetoothGattCharacteristic? = null
    private var pendingChunks: List<ByteArray>? = null

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private var disconnectCount = 0
    private val maxRetries = 2

    fun sendImage(file: File) {
        val bmpBytes = file.readBytes()
        Log.d("BLE", "📁 BMP size: ${bmpBytes.size} bytes")

        val expectedSize = 16062
        if (bmpBytes.size != expectedSize) {
            Log.e("BLE", "❌ BMP size mismatch. Expected $expectedSize but got ${bmpBytes.size}")
            return
        }

        val chunkSize = 20
        pendingChunks = bmpBytes.toList().chunked(chunkSize).map { it.toByteArray() }

        Handler(Looper.getMainLooper()).postDelayed({
            startScan { device ->
                Log.d("BLE", "🔗 Connecting to ${device.name} @ ${device.address}")
                connectToDevice(device)
            }
        }, 10_000)
    }

    private fun startScan(onDeviceFound: (BluetoothDevice) -> Unit) {
        val scanner = BluetoothAdapter.getDefaultAdapter()?.bluetoothLeScanner ?: run {
            Log.e("BLE", "❌ Bluetooth LE scanner not available")
            return
        }

        Log.d("BLE", "🔍 Starting scan for EInkReceiver...")

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        val scanCallback = object : ScanCallback() {
            var found = false

            override fun onScanResult(callbackType: Int, result: ScanResult?) {
                val device = result?.device

                if (!found && device?.name == "EInkReceiver") {
                    found = true
                    Log.d("BLE", "✅ Found EInkReceiver: ${device.address}")
                    scanner.stopScan(this)
                    onDeviceFound(device)
                }
            }

            override fun onScanFailed(errorCode: Int) {
                Log.e("BLE", "❌ Scan failed: $errorCode")
            }
        }

        scanner.startScan(null, settings, scanCallback)

        Handler(Looper.getMainLooper()).postDelayed({
            scanner.stopScan(scanCallback)
            Log.d("BLE", "⏲️ Scan timeout")
        }, 10_000)
    }

    private fun connectToDevice(device: BluetoothDevice) {
        bluetoothGatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    }

    private val gattCallback = object : BluetoothGattCallback() {

        override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.e("BLE", "💥 Connection error: status=$status (newState=$newState)")

                gatt?.close()
                bluetoothGatt = null

                if (status == 133) {
                    disconnectCount++
                    if (disconnectCount <= maxRetries) {
                        Log.w("BLE", "🔁 Retrying connection (attempt $disconnectCount)...")
                        retryConnection()
                    } else {
                        Log.e("BLE", "❌ Max retries exceeded. Giving up.")
                        disconnectCount = 0
                    }
                } else {
                    disconnectCount = 0
                }
                return
            }

            if (newState == BluetoothProfile.STATE_CONNECTED) {
                Log.d("BLE", "🔌 Connected to GATT. Discovering services...")
                disconnectCount = 0
                gatt?.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                Log.w("BLE", "⚠️ Disconnected from GATT")
                gatt?.close()
                bluetoothGatt = null
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
            Log.d("BLE", "🧬 Services discovered: $status")

            val matchingCharacteristic = gatt?.services
                ?.flatMap { it.characteristics }
                ?.find { char ->
                    val props = char.properties
                    (props and BluetoothGattCharacteristic.PROPERTY_WRITE) != 0 ||
                            (props and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0
                }


            if (matchingCharacteristic != null) {
                writeChar = matchingCharacteristic
                writeChar?.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                Log.d("BLE", "✍️ Found writable characteristic ${writeChar?.uuid}. Sending data...")

                scope.launch {
                    sendChunks()
                }
            } else {
                Log.e("BLE", "❌ No writable characteristic found.")
                gatt?.disconnect()
            }
        }
    }

    private suspend fun sendChunks() {
        val gatt = bluetoothGatt ?: return
        val char = writeChar ?: return
        val chunks = pendingChunks ?: return

        for ((i, chunk) in chunks.withIndex()) {
            char.value = chunk
            val success = gatt.writeCharacteristic(char)
            Log.d("BLE", "📤 Chunk $i: ${chunk.size} bytes — write=$success")
            delay(50)
        }

        Log.d("BLE", "✅ All chunks sent. Disconnecting...")
        gatt.disconnect()
    }

    private fun retryConnection() {
        bluetoothGatt?.close()
        bluetoothGatt = null

        Handler(Looper.getMainLooper()).postDelayed({
            Log.d("BLE", "🔁 Starting new scan for retry...")
            startScan { device ->
                connectToDevice(device)
            }
        }, 2000)
    }
}
