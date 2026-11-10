package com.example.androidapp

import com.example.androidapp.CardDetails

data class CardInstance(
    val baseName: String,
    val displayName: String,
    val details: CardDetails,
    var place: String = "main",
    var zone: String = "LIB"
)
