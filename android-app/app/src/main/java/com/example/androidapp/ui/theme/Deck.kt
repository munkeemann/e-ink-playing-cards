package com.example.androidapp.ui.theme

import com.example.androidapp.CardInstance

data class Deck(
    val name: String,
    val commanderImagePath: String,
    val colors: List<String>,
    val cards: List<CardInstance>? = null  // Add this
)

