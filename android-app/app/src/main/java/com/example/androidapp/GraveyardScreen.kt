package com.example.androidapp.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.example.androidapp.CardInstance
import com.example.androidapp.utils.InGameActions
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File
import kotlinx.coroutines.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GraveyardScreen(
    deckName: String,
    navController: NavController,
    piIp: String = "192.168.4.1"
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // All cards in deck order (index 0 = commander = sleeve 1, index 1 = sleeve 2, etc.)
    val allCards = remember { loadAllCards(context, deckName) }

    // zone_name by sleeve_id from Pi: { "1": "GRV", "2": "LIB", ... }
    var zoneMap by remember { mutableStateOf<Map<String, String>>(emptyMap()) }

    // Poll Pi zones on load
    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            try {
                val client = okhttp3.OkHttpClient()
                val request = okhttp3.Request.Builder()
                    .url("http://$piIp:5050/zones")
                    .build()
                val response = client.newCall(request).execute()
                val body = response.body?.string() ?: return@withContext
                val json = org.json.JSONObject(body)
                val zonesJson = json.getJSONObject("zones")
                val map = mutableMapOf<String, String>()
                zonesJson.keys().forEach { key ->
                    map[key] = zonesJson.getString(key)
                }
                zoneMap = map
            } catch (e: Exception) {
                android.util.Log.e("GRAVEYARD", "Failed to fetch zones: ${e.message}")
            }
        }
    }

    // Derive graveyard cards: sleeve_id = card index + 1
    val graveyardCards = allCards.mapIndexedNotNull { index, card ->
        val sleeveId = (index + 1).toString()
        if (zoneMap[sleeveId] == "GRV") card else null
    }

    Scaffold(
        topBar = {
            SmallTopAppBar(
                title = { Text("Graveyard (${graveyardCards.size})") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        if (graveyardCards.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Text("Graveyard is empty", style = MaterialTheme.typography.bodyLarge)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(graveyardCards, key = { it.displayName }) { card ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = card.displayName,
                                style = MaterialTheme.typography.bodyLarge,
                                modifier = Modifier.weight(1f)
                            )
                            Button(onClick = {
                                scope.launch {
                                    // Move to top of deck
                                    InGameActions.returnFromGraveyard(
                                        context, deckName, card.displayName
                                    )
                                    // Tell the sleeve its zone is now LIB
                                    val sleeveId = (allCards.indexOfFirst {
                                        it.displayName == card.displayName
                                    } + 1).toString()
                                    pushZoneToSleeve(piIp, sleeveId, 4) // 4 = LIB
                                    // Refresh display
                                    InGameActions.beginGame(context, deckName, piIp)
                                    navController.popBackStack()
                                }
                            }) {
                                Text("Return to Top")
                            }
                        }
                    }
                }
            }
        }
    }
}

private suspend fun pushZoneToSleeve(piIp: String, sleeveId: String, zoneIndex: Int) {
    withContext(Dispatchers.IO) {
        try {
            val client = okhttp3.OkHttpClient()
            val url = "http://$piIp:5050/set_zone?sleeve_id=$sleeveId&zone=$zoneIndex"
            val request = okhttp3.Request.Builder()
                .url(url)
                .post(okhttp3.RequestBody.create(null, ByteArray(0)))
                .build()
            client.newCall(request).execute()
        } catch (e: Exception) {
            android.util.Log.e("GRAVEYARD", "Failed to push zone: ${e.message}")
        }
    }
}

private fun loadAllCards(
    context: android.content.Context,
    deckName: String
): List<CardInstance> {
    return try {
        val file = File(context.filesDir, "$deckName.json")
        if (!file.exists()) return emptyList()
        val type = object : TypeToken<List<CardInstance>>() {}.type
        val all = Gson().fromJson<List<CardInstance>>(file.readText(), type)
        // Return in sleeve order: commander first, then by place number
        val commander = all.filter { it.place == "commander" }
        val rest = all.filter { it.place != "commander" }
            .sortedBy { it.place.toIntOrNull() ?: Int.MAX_VALUE }
        commander + rest
    } catch (e: Exception) {
        emptyList()
    }
}