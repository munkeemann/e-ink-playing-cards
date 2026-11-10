package com.example.androidapp.wifi

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

class WifiImageSender(private val context: Context) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
        .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    fun sendFile(file: File, piIp: String, port: Int = 5050, sleeveId: Int = 1) {
        scope.launch {
            try {
                val url = "http://$piIp:$port/display?sleeve_id=$sleeveId"
                Log.d("WIFI", "📤 Sending ${file.name} to $url")

                val body = file.readBytes().toRequestBody("image/jpeg".toMediaType())
                val request = Request.Builder()
                    .url(url)
                    .post(body)
                    .build()

                val response = client.newCall(request).execute()
                Log.d("WIFI", "✅ Response: ${response.code} ${response.body?.string()}")
                response.close()

            } catch (e: Exception) {
                Log.e("WIFI", "❌ Failed: ${e.message}")
            }
        }
    }
}