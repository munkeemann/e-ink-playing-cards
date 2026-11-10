package com.example.androidapp

import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.io.BufferedReader
import java.io.InputStreamReader
import com.example.androidapp.utils.parseDeckListWithCommander
import com.example.androidapp.utils.loadDeckFromJson
import com.example.androidapp.utils.saveDeckToJson
import com.example.androidapp.R



suspend fun loadCardInstancesFromAssets(context: Context, fileName: String): List<CardInstance> {
    val inputStream = context.assets.open(fileName)
    val lines = BufferedReader(InputStreamReader(inputStream)).readLines()
    val parsedCards = parseDeckListWithCommander(lines)

    return parsedCards.mapIndexed { index, cardInstance ->
        val details = fetchCardDetails(context, cardInstance.baseName)
            ?: CardDetails(
                baseName = cardInstance.baseName,
                imagePath = "",
                set = "Unknown",
                rules = "No rules text.",
                colorIdentity = emptyList()
            )

        val isDuplicate = parsedCards.count { it.baseName == cardInstance.baseName } > 1
        val displayName = if (isDuplicate) "${cardInstance.baseName} ${index + 1}" else cardInstance.baseName

        cardInstance.copy(
            displayName = displayName,
            place = if (index == 0) "commander" else index.toString(),
            details = details
        )
    }
}