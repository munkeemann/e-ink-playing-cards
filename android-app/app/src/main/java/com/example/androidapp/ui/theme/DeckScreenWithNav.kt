package com.example.androidapp.ui

import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.*
import androidx.navigation.compose.*
import com.example.androidapp.ui.theme.Deck
import com.example.androidapp.ui.theme.DeckListScreen
import com.example.androidapp.ui.theme.InGameScreen
import com.example.androidapp.ui.theme.ScryScreen
import com.example.androidapp.ui.theme.GraveyardScreen
import com.example.androidapp.utils.loadDeckFromJson
import com.example.androidapp.ui.theme.ImportDeckScreen
import java.io.File
import java.net.URLEncoder
import java.net.URLDecoder
import com.example.androidapp.DeckPreview

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeckScreenWithNav(
    context: Context,
    decks: List<Deck>,
    onDecksUpdated: (List<Deck>) -> Unit
) {
    val navController = rememberNavController()

    NavHost(navController, startDestination = "deckList") {

        composable("deckList") {
            Scaffold(
                topBar = {
                    SmallTopAppBar(title = { Text("Decks") })
                },
                floatingActionButton = {
                    FloatingActionButton(onClick = { navController.navigate("import") }) {
                        Text("+")
                    }
                }
            ) { contentPadding ->
                DeckListScreen(
                    decks = decks,
                    onDeckClicked = { deck ->
                        navController.navigate("deckPreview/${URLEncoder.encode(deck.name, "UTF-8")}")
                    },
                    modifier = Modifier.padding(contentPadding)
                )
            }
        }

        composable("deckPreview/{deckName}", arguments = listOf(
            navArgument("deckName") { type = NavType.StringType }
        )) { backStackEntry ->
            val deckName = URLDecoder.decode(
                backStackEntry.arguments?.getString("deckName") ?: "", "UTF-8"
            )
            val ctx = LocalContext.current
            val deck = remember(deckName) {
                val file = File(ctx.filesDir, "$deckName.json")
                if (file.exists()) loadDeckFromJson(file) else null
            }

            deck?.let {
                DeckPreview(
                    deck = it,
                    onBack = { navController.popBackStack() },
                    onStartGame = {
                        navController.navigate("inGame/${URLEncoder.encode(it.name, "UTF-8")}")
                    }
                )
            }
        }

        composable("import") {
            ImportDeckScreen(
                context = context,
                onDeckImported = {
                    val updated = context.filesDir
                        .listFiles { file -> file.name.endsWith(".json") }
                        ?.mapNotNull { loadDeckFromJson(it) }
                        ?: emptyList()
                    onDecksUpdated(updated)
                    navController.popBackStack()
                }
            )
        }

        // ScryScreen now handles the amount input itself via a dialog
        composable("scry/{deckName}/{scryCount}", arguments = listOf(
            navArgument("deckName") { type = NavType.StringType },
            navArgument("scryCount") { type = NavType.IntType }
        )) { backStackEntry ->
            val deckName = URLDecoder.decode(
                backStackEntry.arguments?.getString("deckName") ?: "", "UTF-8"
            )
            val scryCount = backStackEntry.arguments?.getInt("scryCount") ?: 0
            ScryScreen(
                deckName = deckName,
                scryCount = scryCount,
                navController = navController
            )
        }

        composable("inGame/{deckName}", arguments = listOf(
            navArgument("deckName") { type = NavType.StringType }
        )) { backStackEntry ->
            val deckName = URLDecoder.decode(
                backStackEntry.arguments?.getString("deckName") ?: "", "UTF-8"
            )
            InGameScreen(
                deckName = deckName,
                navController = navController
            )
        }

        composable("graveyard/{deckName}", arguments = listOf(
            navArgument("deckName") { type = NavType.StringType }
        )) { backStackEntry ->
            val deckName = URLDecoder.decode(
                backStackEntry.arguments?.getString("deckName") ?: "", "UTF-8"
            )
            GraveyardScreen(
                deckName = deckName,
                navController = navController
            )
        }
    }
}