package com.example.androidapp.ui.theme

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import coil.compose.rememberAsyncImagePainter
import com.example.androidapp.R

@Composable
fun DeckListScreen(
    decks: List<Deck>,
    onDeckClicked: (Deck) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(decks) { deck ->
            DeckTile(deck = deck, onDeckClicked = onDeckClicked)
        }
    }
}

@Composable
fun DeckTile(deck: Deck, onDeckClicked: (Deck) -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(100.dp)
            .clickable { onDeckClicked(deck) }
    ) {
        Image(
            painter = rememberAsyncImagePainter(deck.commanderImagePath),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.7f)),
                        startY = 50f
                    )
                )
        )

        Column(modifier = Modifier.padding(8.dp)) {
            Text(text = deck.name, color = Color.White)

            Spacer(modifier = Modifier.height(4.dp))

            Row {
                deck.colors.forEach { color ->
                    Image(
                        painter = painterResource(getManaSymbolResId(color)),
                        contentDescription = "$color mana",
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
    }
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
