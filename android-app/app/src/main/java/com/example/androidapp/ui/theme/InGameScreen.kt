package com.example.androidapp.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.navigation.NavController
import com.example.androidapp.utils.loadDeckFromJson
import com.example.androidapp.utils.InGameActions
import com.example.androidapp.utils.clearFocusAndHideKeyboard
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.navigation.compose.currentBackStackEntryAsState
import android.util.Log
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InGameScreen(
    deckName: String,
    navController: NavController
) {
    val context = LocalContext.current
    val focusManager = LocalFocusManager.current
    var deck by remember { mutableStateOf(loadDeck(context, deckName)) }
    var tutorName by remember { mutableStateOf("") }
    var showScryDialog by remember { mutableStateOf(false) }
    var scryInput by remember { mutableStateOf("") }
    val graveyardCount = remember { mutableStateOf(0) }

    val lifecycleOwner = LocalLifecycleOwner.current
    val currentBackStackEntry by navController.currentBackStackEntryAsState()
    val isCurrentScreen = currentBackStackEntry?.destination?.route == "inGame/{deckName}"

    LaunchedEffect(isCurrentScreen) {
        if (isCurrentScreen) {
            withContext(Dispatchers.IO) {
                val freshDeck = loadDeck(context, deckName)
                withContext(Dispatchers.Main) {
                    deck = freshDeck
                }
            }
        }
    }

    // Poll Pi for graveyard count
    LaunchedEffect(deck) {
        try {
            val client = okhttp3.OkHttpClient()
            val request = okhttp3.Request.Builder()
                .url("http://192.168.86.193:5050/zones")
                .build()
            val response = withContext(Dispatchers.IO) { client.newCall(request).execute() }
            val body = response.body?.string() ?: return@LaunchedEffect
            val zones = org.json.JSONObject(body).getJSONObject("zones")
            graveyardCount.value = zones.keys().asSequence()
                .count { zones.getString(it) == "GRV" }
        } catch (e: Exception) { }
    }

    Scaffold(
        topBar = {
            SmallTopAppBar(
                title = { Text(deckName) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .pointerInput(Unit) {
                    detectTapGestures(onTap = { focusManager.clearFocus() })
                },
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Button(onClick = {
                InGameActions.shuffleDeck(context, deckName)
                deck = loadDeck(context, deckName)
                Log.d("SHUFFLE", "Top 5 after shuffle: ${deck?.cards?.take(5)?.map { it.baseName }}")
                InGameActions.beginGame(context, deckName, "192.168.86.193")
            }) {
                Text("Shuffle")
            }

            Button(onClick = { showScryDialog = true }) {
                Text("Scry")
            }

            Button(onClick = {
                val encodedName = java.net.URLEncoder.encode(deckName, "UTF-8")
                navController.navigate("graveyard/$encodedName")
            }) {
                Text("Graveyard (${graveyardCount.value})")
            }

            OutlinedTextField(
                value = tutorName,
                onValueChange = { tutorName = it },
                label = { Text("Tutor: exact card name") },
                modifier = Modifier.fillMaxWidth()
            )

            Button(onClick = {
                InGameActions.tutorCard(context, deckName, tutorName)
                deck = loadDeck(context, deckName)
                tutorName = ""
                clearFocusAndHideKeyboard(context, focusManager)
                InGameActions.beginGame(context, deckName, "192.168.86.193")
            }) {
                Text("Tutor to Top")
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (deck != null) {
                LazyColumn {
                    val grouped = deck?.cards?.groupBy { it.baseName } ?: emptyMap()
                    items(grouped.entries.toList()) { entry ->
                        val (name, group) = entry
                        Text(
                            text = "${group.size} × $name",
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                    }
                }
            } else {
                Text("Failed to load deck.")
            }
        }
    }

    if (showScryDialog) {
        AlertDialog(
            onDismissRequest = { showScryDialog = false },
            title = { Text("Scry") },
            text = {
                OutlinedTextField(
                    value = scryInput,
                    onValueChange = { scryInput = it },
                    label = { Text("How many cards?") },
                    singleLine = true
                )
            },
            confirmButton = {
                Button(onClick = {
                    val count = scryInput.toIntOrNull() ?: 0
                    if (count > 0) {
                        showScryDialog = false
                        scryInput = ""
                        val encoded = java.net.URLEncoder.encode(deckName, "UTF-8")
                        navController.navigate("scry/$encoded/$count")
                    }
                }) {
                    Text("Begin Scry")
                }
            },
            dismissButton = {
                TextButton(onClick = { showScryDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

private fun loadDeck(context: android.content.Context, deckName: String): Deck? {
    val file = File(context.filesDir, "$deckName.json")
    return if (file.exists()) {
        loadDeckFromJson(file)
    } else null
}