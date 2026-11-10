package com.example.androidapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import com.example.androidapp.ui.theme.Deck
import com.example.androidapp.utils.loadDeckFromJson
import com.example.androidapp.ui.DeckScreenWithNav

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val context = this

        setContent {
            com.example.androidapp.ui.theme.AndroidAppTheme {
                var decks by remember { mutableStateOf<List<Deck>>(emptyList()) }

                LaunchedEffect(true) {
                    val files = context.filesDir.listFiles { file -> file.extension == "json" } ?: emptyArray()
                    decks = files.mapNotNull { loadDeckFromJson(it) }
                }

                DeckScreenWithNav(
                    context = context,
                    decks = decks,
                    onDecksUpdated = { decks = it }
                )
            }
        }
    }
}