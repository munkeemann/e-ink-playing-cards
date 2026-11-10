package com.example.androidapp.utils

import android.content.Context
import android.util.Log
import com.example.androidapp.ui.theme.Deck
import com.example.androidapp.CardInstance
import java.io.*
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import com.google.gson.Gson

object DeckPacker {

    fun packageDeck(context: Context, deckName: String, deck: List<CardInstance>): File? {
        return try {
            val deckDir = File(context.filesDir, "deck_packages").apply { mkdirs() }
            val zipFile = File(deckDir, "$deckName.zip")

            ZipOutputStream(BufferedOutputStream(FileOutputStream(zipFile))).use { zos ->

                // 1️⃣ Convert deck object to JSON directly
                val deckObject = Deck(
                    name = deckName,
                    commanderImagePath = "",  // If you want you can pull actual value here
                    colors = emptyList(),     // If you want you can pull actual value here
                    cards = deck
                )
                val gson = Gson() // or whatever serializer you're using
                val deckJsonString = gson.toJson(deckObject)

                // 2️⃣ Add deck.json directly to zip
                zos.putNextEntry(ZipEntry("deck.json"))
                zos.write(deckJsonString.toByteArray())
                zos.closeEntry()

                // 3️⃣ Add BMPs
                deck.forEach { card ->
                    val bmpPath = card.details.bwImagePath
                    if (bmpPath.isNullOrBlank()) return@forEach

                    val bmpFile = File(bmpPath)
                    if (!bmpFile.exists()) return@forEach

                    val bmpFileName = "${card.place}.bmp"
                    FileInputStream(bmpFile).use { fis ->
                        zos.putNextEntry(ZipEntry(bmpFileName))
                        fis.copyTo(zos)
                        zos.closeEntry()
                    }
                }
            }

            Log.d("DeckPacker", "✅ Deck packaged at: ${zipFile.absolutePath}")
            zipFile

        } catch (e: Exception) {
            Log.e("DeckPacker", "❌ Failed to package deck: ${e.message}")
            null
        }
    }
}
