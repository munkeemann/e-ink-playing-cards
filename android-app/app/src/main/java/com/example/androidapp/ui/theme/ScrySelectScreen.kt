package com.example.androidapp.ui.theme

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController

@Composable
fun ScrySelectScreen(deckName: String, navController: NavController) {
    var scryCount by remember { mutableStateOf("") }

    Column(modifier = Modifier.padding(16.dp)) {
        OutlinedTextField(
            value = scryCount,
            onValueChange = { scryCount = it },
            label = { Text("Scry Amount") }
        )

        Spacer(modifier = Modifier.height(8.dp))

        Button(onClick = {
            if (scryCount.isNotBlank()) {
                navController.navigate("scry/$deckName/${scryCount.toInt()}")
            }
        }) {
            Text("Begin Scry")
        }
    }
}
