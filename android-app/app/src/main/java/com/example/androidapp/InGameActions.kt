package com.example.androidapp.utils

import android.content.Context
import com.example.androidapp.CardInstance
import com.google.gson.Gson
import java.io.File
import kotlin.random.Random
import android.util.Log
import kotlinx.coroutines.*
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
object InGameActions {

    private val gson = Gson()

    fun loadDeckFile(context: Context, deckName: String): MutableList<CardInstance> {
        val file = File(context.filesDir, "$deckName.json")
        val json = file.readText()
        val cards = gson.fromJson(json, Array<CardInstance>::class.java).toMutableList()

        // Always ensure commander is first, then sort rest by place number
        val commander = cards.filter { it.place == "commander" }
        val rest = cards.filter { it.place != "commander" }
            .sortedBy { it.place.toIntOrNull() ?: Int.MAX_VALUE }

        return (commander + rest).toMutableList()
    }

    private fun saveDeckFile(context: Context, deckName: String, cards: List<CardInstance>) {
        val file = File(context.filesDir, "$deckName.json")
        file.writeText(gson.toJson(cards))
    }

    fun shuffleDeck(context: Context, deckName: String) {
        val cards = loadDeckFile(context, deckName)
        val commander = cards.find { it.place == "commander" }
        val rest = cards.filter { it.place != "commander" }.toMutableList()

        rest.shuffle(Random(System.currentTimeMillis()))
        rest.forEachIndexed { index, card -> card.place = (index + 1).toString() }

        val finalDeck = mutableListOf<CardInstance>()
        commander?.let { finalDeck.add(it) }
        finalDeck.addAll(rest)

        saveDeckFile(context, deckName, finalDeck)
    }

    fun tutorCard(context: Context, deckName: String, cardName: String) {
        shuffleDeck(context, deckName)
        val cards = loadDeckFile(context, deckName)
        val commander = cards.find { it.place == "commander" }
        val rest = cards.filter { it.place != "commander" }.toMutableList()

        val target = rest.find { it.baseName == cardName } ?: return
        rest.remove(target)
        rest.forEachIndexed { index, card -> card.place = (index + 2).toString() }

        target.place = "1"

        val finalDeck = mutableListOf<CardInstance>()
        commander?.let { finalDeck.add(it) }
        finalDeck.add(target)
        finalDeck.addAll(rest)

        saveDeckFile(context, deckName, finalDeck)
    }

    fun placeCardAt(context: Context, deckName: String, cardName: String, position: Int) {
        val cards = loadDeckFile(context, deckName)
        val commander = cards.find { it.place == "commander" }
        val rest = cards.filter { it.place != "commander" }.toMutableList()

        val target = rest.find { it.baseName == cardName } ?: return
        rest.remove(target)

        val newList = mutableListOf<CardInstance>()
        newList.addAll(rest.take(position - 1))
        newList.add(target)
        newList.addAll(rest.drop(position - 1))

        newList.forEachIndexed { index, card -> card.place = (index + 1).toString() }

        val finalDeck = mutableListOf<CardInstance>()
        commander?.let { finalDeck.add(it) }
        finalDeck.addAll(newList)

        saveDeckFile(context, deckName, finalDeck)
    }

    fun scry(context: Context, deckName: String, reorder: List<Pair<Int, Boolean>>) {
        val cards = loadDeckFile(context, deckName)
        val commander = cards.find { it.place == "commander" }
        val rest = cards.filter { it.place != "commander" }.toMutableList()

        // Get top X cards to reorder
        val topCards = rest.take(reorder.size).toMutableList()
        val bottomCards = rest.drop(reorder.size).toMutableList()

        val reorderedTop = mutableListOf<CardInstance>()

        reorder.forEach { (index, putOnBottom) ->
            val zeroBasedIndex = index - 1  // our UI is using 1-based indexes
            if (zeroBasedIndex in topCards.indices) {
                val card = topCards[zeroBasedIndex]
                if (putOnBottom) {
                    bottomCards.add(card)
                } else {
                    reorderedTop.add(card)
                }
            }
        }

        // Handle any leftovers not reordered
        val remaining = topCards.filterNot { reorderedTop.contains(it) || bottomCards.contains(it) }
        reorderedTop.addAll(remaining)

        val finalList = reorderedTop + bottomCards
        finalList.forEachIndexed { idx, card -> card.place = (idx + 1).toString() }

        val finalDeck = mutableListOf<CardInstance>()
        commander?.let { finalDeck.add(it) }
        finalDeck.addAll(finalList)

        saveDeckFile(context, deckName, finalDeck)
    }
    fun returnFromGraveyard(context: Context, deckName: String, displayName: String) {
        val cards = loadDeckFile(context, deckName)
        val target = cards.find { it.displayName == displayName } ?: return
        val commander = cards.find { it.place == "commander" }
        val libCards = cards.filter { it.place != "commander" && it.place.toIntOrNull() != null }
            .sortedBy { it.place.toInt() }
            .toMutableList()

        // Renumber: returned card at position 1, rest shift down
        val returned = target.copy(place = "1")
        libCards.remove(target)
        libCards.forEachIndexed { index, card -> card.place = (index + 2).toString() }

        val finalDeck = mutableListOf<CardInstance>()
        commander?.let { finalDeck.add(it) }
        finalDeck.add(returned)
        finalDeck.addAll(libCards)

        saveDeckFile(context, deckName, finalDeck)
    }
    fun beginGame(context: Context, deckName: String, piIp: String, port: Int = 5050) {
        val cards = loadDeckFile(context, deckName)

        CoroutineScope(Dispatchers.IO).launch {
            val client = okhttp3.OkHttpClient.Builder()
                .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .build()

            // Fetch registered sleeves
            val registeredIds = try {
                val req = okhttp3.Request.Builder()
                    .url("http://$piIp:$port/sleeves")
                    .build()
                val resp = client.newCall(req).execute()
                val body = resp.body?.string() ?: "{}"
                val sleevesObj = org.json.JSONObject(body).getJSONObject("sleeves")
                sleevesObj.keys().asSequence().toSet()
            } catch (e: Exception) {
                Log.e("BEGIN", "Failed to fetch sleeves: ${e.message}")
                emptySet()
            }

            // Fetch current zone states
            val zoneStates = try {
                val req = okhttp3.Request.Builder()
                    .url("http://$piIp:$port/zones")
                    .build()
                val resp = client.newCall(req).execute()
                val body = resp.body?.string() ?: "{}"
                val zonesObj = org.json.JSONObject(body).getJSONObject("zones")
                zonesObj.keys().asSequence().associate { it to zonesObj.getString(it) }
            } catch (e: Exception) {
                Log.e("BEGIN", "Failed to fetch zones: ${e.message}")
                emptyMap()
            }

            Log.d("BEGIN", "Registered: $registeredIds, Zones: $zoneStates")

            cards.forEachIndexed { index, card ->
                val sleeveId = (index + 1).toString()
                if (sleeveId !in registeredIds) return@forEachIndexed

                // Skip sleeves not in LIB zone
                // If zone not reported yet, default to LIB (allow push)
                val zone = zoneStates[sleeveId]
                if (zone != null && zone != "LIB") {
                    Log.d("BEGIN", "⏭️ Skipping sleeve $sleeveId — zone is $zone")
                    return@forEachIndexed
                }

                val imagePath = card.details.imagePath
                if (imagePath.isBlank()) {
                    Log.w("BEGIN", "⚠️ No image for ${card.baseName}, skipping")
                    return@forEachIndexed
                }

                try {
                    val imageFile = File(imagePath)
                    if (!imageFile.exists()) {
                        Log.e("BEGIN", "❌ File not found: $imagePath")
                        return@forEachIndexed
                    }

                    val imageBytes = imageFile.readBytes()
                    Log.d("BEGIN", "📤 Sending ${card.baseName} to sleeve $sleeveId")

                    val url = "http://$piIp:$port/display?sleeve_id=$sleeveId"
                    val body = imageBytes.toRequestBody("image/jpeg".toMediaType())
                    val request = okhttp3.Request.Builder()
                        .url(url)
                        .post(body)
                        .build()

                    val response = client.newCall(request).execute()
                    Log.d("BEGIN", "✅ Sleeve $sleeveId response: ${response.code}")
                    response.close()

                } catch (e: Exception) {
                    Log.e("BEGIN", "❌ Failed for ${card.baseName}: ${e.message}")
                }
            }

            Log.d("BEGIN", "🎮 All done!")
        }
    }
}
