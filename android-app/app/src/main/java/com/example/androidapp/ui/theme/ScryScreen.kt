package com.example.androidapp.ui.theme

import android.content.Context
import android.util.Log
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.example.androidapp.CardInstance
import com.example.androidapp.utils.InGameActions
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalFocusManager

private const val DIVIDER_KEY = "__DIVIDER__"

private sealed class ScryListItem {
    data class CardItem(val card: CardInstance) : ScryListItem()
    object Divider : ScryListItem()
}
// Add near top of ScryScreen composable:

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ScryScreen(
    deckName: String,
    scryCount: Int,
    navController: NavController
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val allCards = remember { loadDeckSafe(context, deckName) } ?: emptyList()
    val focusManager = LocalFocusManager.current

    val scryed = remember {
        allCards
            .filter { it.place.toIntOrNull() != null }
            .sortedBy { it.place.toInt() }
            .take(scryCount)
    }

    val items = remember {
        mutableStateListOf<ScryListItem>().apply {
            addAll(scryed.map { ScryListItem.CardItem(it) })
            add(ScryListItem.Divider)
        }
    }

    val lazyListState = rememberLazyListState()
    val reorderableState = rememberReorderableLazyListState(lazyListState) { from, to ->
        val movingDivider = items.getOrNull(from.index) is ScryListItem.Divider
        val targetIndex = to.index.coerceIn(0, items.lastIndex)
        if (movingDivider && targetIndex == 0) return@rememberReorderableLazyListState
        val item = items.removeAt(from.index)
        items.add(targetIndex, item)
    }

    val dividerIndex = items.indexOfFirst { it is ScryListItem.Divider }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
            .padding(16.dp)
            .pointerInput(Unit) {
                detectTapGestures(onTap = { focusManager.clearFocus() })
            }
    ) {
        Text(
            text = "Scry $scryCount",
            style = MaterialTheme.typography.headlineSmall,
            color = Color.Black
        )
        Text(
            text = "Drag cards to reorder • drag the divider bar or cards past it to set bottom",
            style = MaterialTheme.typography.bodySmall,
            color = Color.Gray
        )

        Spacer(modifier = Modifier.height(8.dp))

        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            state = lazyListState
        ) {
            itemsIndexed(items, key = { _, item ->
                when (item) {
                    is ScryListItem.CardItem -> item.card.displayName
                    is ScryListItem.Divider -> DIVIDER_KEY
                }
            }) { index, item ->
                when (item) {
                    is ScryListItem.Divider -> {
                        ReorderableItem(reorderableState, key = DIVIDER_KEY) { isDragging ->
                            val elevation by animateDpAsState(if (isDragging) 8.dp else 0.dp)
                            Card(
                                elevation = CardDefaults.cardElevation(elevation),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 6.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color(0xFF444444))
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        "── BOTTOM OF DECK ──",
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                    Box(modifier = Modifier.draggableHandle().padding(8.dp)) {
                                        Text("⠿", color = Color.White)
                                    }
                                }
                            }
                        }
                    }

                    is ScryListItem.CardItem -> {
                        val isBottom = index > dividerIndex
                        ReorderableItem(
                            reorderableState,
                            key = item.card.displayName
                        ) { isDragging ->
                            val elevation by animateDpAsState(if (isDragging) 12.dp else 2.dp)
                            val bgColor = when {
                                isDragging -> Color(0xFFFFEEAA)
                                isBottom -> Color(0xFFFFF0F0)
                                else -> Color(0xFFF0F4FF)
                            }

                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                elevation = CardDefaults.cardElevation(elevation)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(bgColor)
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = item.card.displayName,
                                        color = Color.Black,
                                        modifier = Modifier.weight(1f)
                                    )
                                    Text(
                                        text = if (isBottom) "BOTTOM" else "TOP",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (isBottom) Color(0xFFAA3333) else Color(0xFF3355AA),
                                        modifier = Modifier.padding(horizontal = 8.dp)
                                    )
                                    Box(modifier = Modifier.draggableHandle().padding(8.dp)) {
                                        Text("⠿", color = Color.Gray)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = {
                scope.launch {
                    try {
                        val divIdx = items.indexOfFirst { it is ScryListItem.Divider }
                        val topCards = items.take(divIdx)
                            .filterIsInstance<ScryListItem.CardItem>()
                            .map { it.card }
                        val bottomCards = items.drop(divIdx + 1)
                            .filterIsInstance<ScryListItem.CardItem>()
                            .map { it.card }

                        val allDeckCards = withContext(Dispatchers.IO) {
                            loadDeckSafe(context, deckName) ?: emptyList()
                        }
                        val commander = allDeckCards.find { it.place == "commander" }
                        val restOfDeck = allDeckCards
                            .filter { it.place != "commander" }
                            .filter { card -> scryed.none { s -> s.displayName == card.displayName } }
                            .sortedBy { it.place.toIntOrNull() ?: Int.MAX_VALUE }

                        val newOrder = topCards + restOfDeck + bottomCards
                        newOrder.forEachIndexed { idx, card -> card.place = (idx + 1).toString() }

                        val finalDeck = mutableListOf<CardInstance>()
                        commander?.let { finalDeck.add(it) }
                        finalDeck.addAll(newOrder)

                        // Save file
                        withContext(Dispatchers.IO) {
                            val file = File(context.filesDir, "$deckName.json")
                            file.writeText(Gson().toJson(finalDeck))
                        }

                        // Send images inline so we control the order and timing
                        withContext(Dispatchers.IO) {
                            val client = okhttp3.OkHttpClient.Builder()
                                .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                                .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                                .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                                .build()

                            finalDeck.forEachIndexed { index, card ->
                                val sleeveId = index + 1
                                val imagePath = card.details.imagePath
                                if (imagePath.isBlank()) return@forEachIndexed

                                val imageFile = File(imagePath)
                                if (!imageFile.exists()) return@forEachIndexed

                                try {
                                    val imageBytes = imageFile.readBytes()
                                    val url = "http://192.168.86.193:5050/display?sleeve_id=$sleeveId"
                                    val body = imageBytes.toRequestBody("image/jpeg".toMediaType())
                                    val request = okhttp3.Request.Builder()
                                        .url(url)
                                        .post(body)
                                        .build()
                                    val response = client.newCall(request).execute()
                                    Log.d("SCRY", "✅ Sleeve $sleeveId: ${response.code}")
                                    response.close()
                                } catch (e: Exception) {
                                    Log.e("SCRY", "❌ Failed sleeve $sleeveId: ${e.message}")
                                }
                            }
                        }

                        withContext(Dispatchers.Main) {
                            navController.popBackStack()
                        }
                    } catch (e: Exception) {
                        Log.e("SCRY", "Confirm failed: ${e.message}", e)
                        withContext(Dispatchers.Main) {
                            navController.popBackStack()
                        }
                    }
                }
            },
            modifier = Modifier.align(Alignment.End)
        ) {
            Text("Confirm Scry")
        }
    }
}

private fun loadDeckSafe(context: Context, deckName: String): List<CardInstance>? {
    return try {
        val file = File(context.filesDir, "$deckName.json")
        if (!file.exists()) return null
        val type = object : TypeToken<List<CardInstance>>() {}.type
        Gson().fromJson(file.readText(), type)
    } catch (e: Exception) {
        Log.e("SCRY", "Error loading deck", e)
        null
    }
}