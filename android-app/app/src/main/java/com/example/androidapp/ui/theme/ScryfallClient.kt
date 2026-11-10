package com.example.androidapp

import android.content.Context
import android.graphics.*
import android.net.Uri
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder

suspend fun fetchCardDetails(context: Context, cardName: String): CardDetails? {
    val cleanedCardName = cardName
        .replace(Regex("\\s+\\d+\\s*[A-Z]?$"), "")
        .replace(Regex("[★✪*]"), "")
        .trim()

    val urlStr = "https://api.scryfall.com/cards/named?exact=${Uri.encode(cleanedCardName)}"
    Log.d("Scryfall", "Fetching URL: $urlStr")

    return withContext(Dispatchers.IO) {
        // Rate limit: Scryfall allows 10 requests/second
        delay(110)

        var connection: HttpURLConnection? = null
        try {
            connection = URL(urlStr).openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("User-Agent", "MTGSleeveApp/1.0")
            connection.setRequestProperty("Accept", "application/json")
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.connect()

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val response = connection.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(response)

                val name = json.optString("name", cardName)
                val oracleText = json.optString("oracle_text", "No rules text.")

                // Handle double-faced cards
                val remoteImageUrl = json.optJSONObject("image_uris")?.optString("large")
                    ?: json.optJSONArray("card_faces")
                        ?.optJSONObject(0)
                        ?.optJSONObject("image_uris")
                        ?.optString("large")
                    ?: ""

                // Get color identity
                val colorArray = json.optJSONArray("color_identity")
                val colorIdentity = mutableListOf<String>()
                for (i in 0 until (colorArray?.length() ?: 0)) {
                    colorArray?.getString(i)?.let { colorIdentity.add(it) }
                }

                // Generate filenames
                val safeBase = name.replace(Regex("[^a-zA-Z0-9._-]"), "_")
                val cardsDir = File(context.filesDir, "cards").apply { mkdirs() }

                val colorFile = File(cardsDir, "$safeBase-color.jpg")
                val bwJpgFile = File(cardsDir, "$safeBase-bw.jpg")
                val bwBmpFile = File(cardsDir, "$safeBase.bmp")

                // Download color image
                val localImagePath = if (remoteImageUrl.isNotBlank()) {
                    downloadImageToLocal(context, remoteImageUrl, colorFile.name)
                } else null

                // Convert and save BW images
                if (localImagePath != null) {
                    convertToBlackAndWhiteAndBmp(File(localImagePath), bwJpgFile, bwBmpFile)
                }

                Log.d(
                    "Scryfall",
                    "✅ Cleaned: $cleanedCardName → imagePath: $localImagePath, Colors: $colorIdentity"
                )

                return@withContext CardDetails(
                    baseName = cleanedCardName,
                    imagePath = localImagePath ?: "",
                    bwImagePath = bwBmpFile.absolutePath,
                    set = json.optString("set_name", "Unknown"),
                    rules = oracleText,
                    colorIdentity = colorIdentity
                )
            } else {
                val errorBody = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                Log.w(
                    "Scryfall",
                    "Failed to fetch card: '$cleanedCardName' - HTTP ${connection.responseCode} - $errorBody"
                )
                null
            }
        } catch (e: Exception) {
            Log.e("Scryfall", "Exception fetching card: $cardName", e)
            null
        } finally {
            connection?.disconnect()
        }
    }
}

suspend fun downloadImageToLocal(
    context: Context,
    imageUrl: String,
    fileName: String
): String? {
    return withContext(Dispatchers.IO) {
        var connection: HttpURLConnection? = null
        try {
            val url = URL(imageUrl)
            connection = url.openConnection() as HttpURLConnection
            connection.setRequestProperty("User-Agent", "MTGSleeveApp/1.0")
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.doInput = true
            connection.connect()

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val inputStream = connection.inputStream
                val cardsDir = File(context.filesDir, "cards").apply { mkdirs() }
                val file = File(cardsDir, fileName)

                FileOutputStream(file).use { output ->
                    inputStream.copyTo(output)
                }
                Log.d("Scryfall", "✅ Downloaded image: ${file.absolutePath}")
                file.absolutePath
            } else {
                Log.w("Scryfall", "Failed to download image: HTTP ${connection.responseCode}")
                null
            }
        } catch (e: Exception) {
            Log.e("Scryfall", "Exception downloading image: $imageUrl", e)
            null
        } finally {
            connection?.disconnect()
        }
    }
}

fun convertToBlackAndWhiteAndBmp(
    inputFile: File,
    bwJpgFile: File,
    bwBmpFile: File
) {
    val originalBitmap = BitmapFactory.decodeFile(inputFile.absolutePath)
    if (originalBitmap == null) {
        Log.e("Scryfall", "Failed to decode bitmap from ${inputFile.absolutePath}")
        return
    }

    val targetWidth = 400
    val targetHeight = 300
    val scaledBitmap = Bitmap.createScaledBitmap(originalBitmap, targetWidth, targetHeight, true)

    val grayPixels = Array(targetHeight) { y ->
        DoubleArray(targetWidth) { x ->
            val pixel = scaledBitmap.getPixel(x, y)
            Color.red(pixel) * 0.2126 +
                    Color.green(pixel) * 0.7152 +
                    Color.blue(pixel) * 0.0722
        }
    }

    val bwPixels = Array(targetHeight) { ByteArray(targetWidth) }

    val THRESHOLD = 128.0
    for (y in 0 until targetHeight) {
        for (x in 0 until targetWidth) {
            val old = grayPixels[y][x]
            val new = if (old < THRESHOLD) 0.0 else 255.0
            val error = old - new

            grayPixels[y][x] = new
            bwPixels[y][x] = if (new == 0.0) 0 else 1

            if (x + 1 < targetWidth) grayPixels[y][x + 1] += error * 7.0 / 16.0
            if (y + 1 < targetHeight) {
                if (x > 0) grayPixels[y + 1][x - 1] += error * 3.0 / 16.0
                grayPixels[y + 1][x] += error * 5.0 / 16.0
                if (x + 1 < targetWidth) grayPixels[y + 1][x + 1] += error * 1.0 / 16.0
            }
        }
    }

    val cleanedPixels = despeckle(bwPixels)

    val ditheredBitmap = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888)
    for (y in 0 until targetHeight) {
        for (x in 0 until targetWidth) {
            val color = if (cleanedPixels[y][x] == 0.toByte()) Color.BLACK else Color.WHITE
            ditheredBitmap.setPixel(x, y, color)
        }
    }

    FileOutputStream(bwJpgFile).use {
        ditheredBitmap.compress(Bitmap.CompressFormat.JPEG, 100, it)
    }

    val rowBytes = ((targetWidth + 31) / 32) * 4
    val bytesPerRowData = (targetWidth + 7) / 8
    val imageSize = rowBytes * targetHeight
    val headerSize = 54 + 8

    val buffer = ByteBuffer
        .allocate(headerSize + imageSize)
        .order(ByteOrder.LITTLE_ENDIAN)

    buffer.put('B'.code.toByte())
    buffer.put('M'.code.toByte())
    buffer.putInt(headerSize + imageSize)
    buffer.putInt(0)
    buffer.putInt(headerSize)

    buffer.putInt(40)
    buffer.putInt(targetWidth)
    buffer.putInt(targetHeight)
    buffer.putShort(1)
    buffer.putShort(1)
    buffer.putInt(0)
    buffer.putInt(imageSize)
    buffer.putInt(0)
    buffer.putInt(0)
    buffer.putInt(0)
    buffer.putInt(0)

    buffer.put(byteArrayOf(0x00, 0x00, 0x00, 0x00))
    buffer.put(byteArrayOf(0xFF.toByte(), 0xFF.toByte(), 0xFF.toByte(), 0x00))

    for (y in targetHeight - 1 downTo 0) {
        var byte = 0
        var bitIndex = 0

        for (x in 0 until targetWidth) {
            val bit = cleanedPixels[y][x].toInt()
            byte = byte or (bit shl (7 - bitIndex))
            bitIndex++

            if (bitIndex == 8 || x == targetWidth - 1) {
                buffer.put(byte.toByte())
                byte = 0
                bitIndex = 0
            }
        }

        repeat(rowBytes - bytesPerRowData) {
            buffer.put(0.toByte())
        }
    }

    FileOutputStream(bwBmpFile).use {
        buffer.flip()
        it.write(buffer.array(), 0, buffer.limit())
    }
}

private fun despeckle(bwPixels: Array<ByteArray>): Array<ByteArray> {
    val height = bwPixels.size
    val width = bwPixels[0].size
    val out = Array(height) { ByteArray(width) }

    for (y in 0 until height) {
        for (x in 0 until width) {
            val cur = bwPixels[y][x].toInt()
            var blackNeighbors = 0
            var whiteNeighbors = 0

            for (dy in -1..1) {
                for (dx in -1..1) {
                    if (dx == 0 && dy == 0) continue
                    val ny = y + dy
                    val nx = x + dx
                    if (ny in 0 until height && nx in 0 until width) {
                        if (bwPixels[ny][nx].toInt() == 0) blackNeighbors++
                        else whiteNeighbors++
                    }
                }
            }

            out[y][x] = when {
                cur == 0 && whiteNeighbors >= 7 -> 1.toByte()
                cur == 1 && blackNeighbors >= 7 -> 0.toByte()
                else -> cur.toByte()
            }
        }
    }

    return out
}