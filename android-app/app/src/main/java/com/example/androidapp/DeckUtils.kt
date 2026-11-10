package com.example.androidapp.utils

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import com.example.androidapp.CardInstance
import com.example.androidapp.CardDetails
import com.example.androidapp.ui.theme.Deck
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.example.androidapp.fetchCardDetails
import com.example.androidapp.R
import android.app.Activity
import android.view.inputmethod.InputMethodManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.runtime.Composable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.focus.FocusManager


val gson = Gson()

fun saveDeckToJson(context: Context, fileName: String, cards: List<CardInstance>) {
    val json = gson.toJson(cards)
    val file = File(context.filesDir, fileName)
    file.bufferedWriter().use { it.write(json) }
}

fun parseDeckListWithCommander(lines: List<String>): List<CardInstance> {
    val result = mutableListOf<CardInstance>()
    var currentIndex = 1  // 0 is reserved for commander
    var isFirstCard = true

    for (line in lines) {
        val trimmed = line.trim()
        val parts = trimmed.split(" ", limit = 2)
        if (parts.size != 2) continue

        val count = parts[0].toIntOrNull() ?: continue
        var name = parts[1]

        name = name
            .replace(Regex("\\(.*?\\)"), "")
            .replace(Regex("[★✪*]"), "")
            .trim()

        for (i in 1..count) {
            val displayName = if (count > 1) "$name $i" else name
            val place = if (isFirstCard && i == 1) {
                "commander"
            } else {
                currentIndex++.toString()
            }

            result.add(
                CardInstance(
                    baseName = name,
                    displayName = displayName,
                    details = CardDetails(
                        baseName = name,
                        imagePath = "",
                        set = "Unknown",
                        rules = "No rules text.",
                        colorIdentity = emptyList()
                    ),
                    place = place
                )
            )
        }

        isFirstCard = false
    }

    return result
}

fun getCardDetailsFromScryfall(name: String, context: Context): CardDetails {
    return try {
        val query = URLEncoder.encode(name, "UTF-8")
        val apiUrl = "https://api.scryfall.com/cards/named?exact=$query"

        val connection = URL(apiUrl).openConnection() as HttpURLConnection
        connection.requestMethod = "GET"

        if (connection.responseCode == 200) {
            val response = connection.inputStream.bufferedReader().readText()
            val json = JSONObject(response)

            val cardName = json.optString("name", name)
            val typeLine = json.optString("type_line", "Unknown")
            val oracleText = json.optString("oracle_text", "No rules text.")
            val imagePath = json.optJSONObject("image_uris")?.optString("normal") ?: ""

            val safeFileName = cardName.replace(Regex("[^a-zA-Z0-9._-]"), "_") + ".jpg"
            val imageDir = File(context.filesDir, "card_images")
            imageDir.mkdirs()
            val imageFile = File(imageDir, safeFileName)

            if (!imageFile.exists() && imagePath.isNotEmpty()) {
                URL(imagePath).openStream().use { input ->
                    imageFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
            }

            val colorArray = json.optJSONArray("color_identity")
            val colorIdentity = mutableListOf<String>()
            for (i in 0 until (colorArray?.length() ?: 0)) {
                colorArray?.getString(i)?.let { colorIdentity.add(it) }
            }

            CardDetails(
                baseName = cardName,
                imagePath = imageFile.absolutePath,
                set = json.optString("set_name", "Unknown"),
                rules = oracleText,
                colorIdentity = colorIdentity
            )
        } else {
            Log.w("Scryfall", "Failed to fetch card: $name - HTTP ${connection.responseCode}")
            defaultCard(name)
        }
    } catch (e: Exception) {
        Log.e("Scryfall", "Error fetching card: $name", e)
        defaultCard(name)
    }
}

private fun defaultCard(name: String): CardDetails {
    return CardDetails(
        baseName = name,
        imagePath = "",
        set = "Unknown",
        rules = "No rules text.",
        colorIdentity = emptyList()
    )
}

fun loadDeckFromJson(file: File): Deck? {
    return try {
        val json = file.readText()
        val cards = gson.fromJson(json, Array<CardInstance>::class.java).toList()
        val commander = cards.find { it.place == "commander" } ?: return null
        val colorIdentity = commander.details.colorIdentity

        Deck(
            name = file.nameWithoutExtension,
            commanderImagePath = commander.details.imagePath,
            colors = colorIdentity,
            cards = cards
        )
    } catch (e: Exception) {
        e.printStackTrace()
        null
    }
}



suspend fun saveDeckToFile(context: Context, deckName: String, deckList: String) {
    val lines = deckList.lines()
    val parsedCards = parseDeckListWithCommander(lines)

    val enrichedCards = withContext(Dispatchers.IO) {
        parsedCards.mapIndexed { index, card ->
            val cleanedName = card.baseName
                .replace(Regex("  ?\\d+.*$"), "")
                .replace(Regex("[★✪*]"), "")
                .trim()

            Log.d("SaveDeck", "Fetching details for '$cleanedName'")

            val fetched = fetchCardDetails(context, cleanedName)

            Log.d("SaveDeck", "Fetched for '$cleanedName': ${fetched?.bwImagePath}, colors: ${fetched?.colorIdentity}")

            card.copy(
                baseName = cleanedName,
                displayName = if (parsedCards.count { it.baseName == cleanedName } > 1)
                    "$cleanedName ${index + 1}" else cleanedName,
                place = if (index == 0) "commander" else index.toString(),
                details = fetched ?: card.details
            )
        }
    }

    val json = gson.toJson(enrichedCards)
    val file = File(context.filesDir, "$deckName.json")
    file.writeText(json)

    Log.d("SaveDeck", "Saved ${enrichedCards.size} cards to ${file.absolutePath}")
}

fun loadAllDecks(context: Context): List<Deck> {
    val files = context.filesDir.listFiles()?.filter { it.extension == "json" } ?: emptyList()
    return files.mapNotNull { loadDeckFromJson(it) }
}



fun getManaSymbolResId(color: String): Int {
    return when (color.uppercase()) {
        "W" -> R.drawable.white_mana
        "U" -> R.drawable.blue_mana
        "B" -> R.drawable.black_mana
        "R" -> R.drawable.red_mana
        "G" -> R.drawable.green_mana
        else -> R.drawable.colorless_mana
    }
}





fun hideKeyboard(context: Context) {
    val inputMethodManager = context.getSystemService(Activity.INPUT_METHOD_SERVICE) as InputMethodManager
    inputMethodManager.hideSoftInputFromWindow(null, 0)
}

fun clearFocusAndHideKeyboard(context: Context, focusManager: androidx.compose.ui.focus.FocusManager) {
    focusManager.clearFocus()
    hideKeyboard(context)
}

@Composable
fun hideKeyboardAndClearFocus() {
    val focusManager = LocalFocusManager.current
    val context = LocalContext.current
    clearFocusAndHideKeyboard(context, focusManager)
}