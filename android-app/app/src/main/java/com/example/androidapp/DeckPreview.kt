package com.example.androidapp

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.androidapp.ui.theme.Deck
import com.example.androidapp.ble.BleImageSender
import com.example.androidapp.utils.DeckPacker
import com.example.androidapp.wifi.WifiImageSender
import androidx.compose.ui.platform.LocalContext
import java.io.File
import com.example.androidapp.utils.InGameActions
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeckPreview(
    deck: Deck,
    onBack: () -> Unit,
    onStartGame: () -> Unit
) {
    val context = LocalContext.current
    val bleSender = BleImageSender(context)
    val wifiSender = WifiImageSender(context)

    Scaffold(
        topBar = {
            SmallTopAppBar(
                title = { Text(deck.name) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
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
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val buttonModifier = Modifier.weight(1f)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val buttonModifier = Modifier.weight(1f)

                    Button(
                        onClick = {
                            InGameActions.beginGame(
                                context = context,
                                deckName = deck.name,
                                piIp = "192.168.86.193"
                            )
                            onStartGame() // <-- add this line
                        },
                        modifier = buttonModifier,
                        shape = MaterialTheme.shapes.medium
                    ) {
                        Text("Begin Game")
                    }

                    Button(
                        onClick = {
                            val path =
                                deck.cards?.firstOrNull { it.place == "commander" }?.details?.bwImagePath
                            if (!path.isNullOrBlank()) {
                                val file = File(path)
                                if (file.exists()) {
                                    bleSender.sendImage(file)
                                }
                            }
                        },
                        modifier = buttonModifier,
                        shape = MaterialTheme.shapes.medium
                    ) {
                        Text("Sync with deck")
                    }

                    Button(
                        onClick = {
                            val packedDeckFile = DeckPacker.packageDeck(
                                context,
                                deck.name,
                                deck.cards ?: emptyList()
                            )
                            if (packedDeckFile != null) {
                                wifiSender.sendFile(packedDeckFile, "192.168.86.193")
                            }
                        },
                        modifier = buttonModifier,
                        shape = MaterialTheme.shapes.medium
                    ) {
                        Text("Sync WiFi")
                    }
                }
            }



                Spacer(modifier = Modifier.height(16.dp))

            LazyColumn {
                val grouped = deck.cards?.groupBy { it.baseName } ?: emptyMap()
                items(grouped.entries.toList()) { entry ->
                    val (name, group) = entry
                    Text(
                        text = "${group.size} × $name",
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.padding(vertical = 8.dp)
                    )
                }
            }
        }
    }
}
