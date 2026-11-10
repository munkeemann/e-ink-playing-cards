package com.example.androidapp

data class CardDetails(
    val baseName: String,
    val imagePath: String,
    val bwImagePath: String = "",
    val set: String,
    val rules: String,
    val colorIdentity: List<String>
)
