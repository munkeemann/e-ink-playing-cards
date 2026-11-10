package com.example.androidapp.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.androidapp.CardDetails
import com.example.androidapp.CardInstance
import com.example.androidapp.fetchCardDetails
import kotlinx.coroutines.launch
import androidx.compose.ui.platform.LocalContext
import com.example.androidapp.utils.getManaSymbolResId

@Composable
fun CardBrowserScreen(cards: List<CardInstance>) {
    var loadedCards by remember { mutableStateOf<Map<String, CardDetails>>(emptyMap()) }
    val context = LocalContext.current

    LaunchedEffect(cards) {
        val cardData = cards
            .distinctBy { it.baseName }
            .associate { card ->
                val details = fetchCardDetails(context, card.baseName)
                card.baseName to (
                        details ?: CardDetails(
                            baseName = card.baseName,
                            imagePath = "",
                            set = "Unknown",
                            rules = "No rules text.",
                            colorIdentity = emptyList()
                        )
                        )
            }
        loadedCards = cardData
    }

    Column(modifier = Modifier.padding(16.dp)) {
        Text("Deck Preview", style = MaterialTheme.typography.headlineSmall)

        cards.forEach { card ->
            val details = loadedCards[card.baseName]

            Text(
                text = buildString {
                    append(card.displayName)
                    append(" — ")
                    append(details?.set ?: "Unknown set")
                    append(" | ")
                    append(details?.rules ?: "No rules text")
                },
                modifier = Modifier.padding(vertical = 4.dp)
            )
        }
    }
}
