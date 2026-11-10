package com.example.androidapp.ui.theme


import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.androidapp.utils.saveDeckToFile
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import com.example.androidapp.utils.clearFocusAndHideKeyboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.input.pointer.pointerInput
@Composable
fun ImportDeckScreen(
    context: Context,
    onDeckImported: () -> Unit
) {
    var deckListText by remember { mutableStateOf("") }
    var deckName by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    Surface( // ✅ applies theme background automatically
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colors.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
                .pointerInput(Unit) {
                    detectTapGestures(onTap = { focusManager.clearFocus() })
                },
            verticalArrangement = Arrangement.Top,
            horizontalAlignment = Alignment.Start
        ){
            OutlinedTextField(
                value = deckName,
                onValueChange = { deckName = it },
                label = { Text("Deck Name") }, // ✅ MaterialTheme handles text color
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = deckListText,
                onValueChange = { deckListText = it },
                label = { Text("Deck List") },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 200.dp),
                maxLines = 20
            )

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    if (deckName.isNotBlank() && deckListText.isNotBlank()) {
                        scope.launch {
                            saveDeckToFile(context, deckName, deckListText)
                            onDeckImported()
                            clearFocusAndHideKeyboard(context, focusManager)
                            deckName = ""
                            deckListText = ""
                        }
                    }
                },
                modifier = Modifier.align(Alignment.End)
            ) {
                Text("Submit")
            }
        }
    }
}
