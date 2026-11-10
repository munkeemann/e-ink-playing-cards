package com.example.androidapp.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.material3.Typography
import androidx.compose.material3.Shapes

private val CustomColors = lightColorScheme(
    primary = Color(0xFF8083D3),      // accent blue-purple
    onPrimary = Color(0xFF0C1F29),    // dark background for contrast
    secondary = Color(0xFF88DBD9),    // teal accent
    onSecondary = Color(0xFF0C1F29),
    background = Color(0xFF0C1F29),   // dark background
    onBackground = Color(0xFF8AA2AE),// readable text on dark
    surface = Color(0xFF0C1F29),      // match background
    onSurface = Color(0xFF8AA2AE)     // readable text
)

@Composable
fun AndroidAppTheme(
    useDarkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = CustomColors,
        typography = Typography(),
        shapes = Shapes(),
        content = content
    )
}
