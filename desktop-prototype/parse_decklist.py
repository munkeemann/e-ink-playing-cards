import re
import tkinter as tk
from tkinter import simpledialog
import os
from convert_images import convert_all_images
from import_moxfield import get_deck_from_moxfield
from scryfall_call import fetch_card_image
from generate_deck_json import generate_deck_json


def extract_card_name(line):
    # Remove quantity at the start
    line = re.sub(r"^\d+\s+", "", line)
    # Remove set codes and collector numbers like (SET) 123, 123p, etc.
    line = re.sub(r"\s+\([A-Z0-9]+\)\s+\d+[a-zA-Z]*", "", line)
    # Remove foil markers and stars
    line = line.replace("*F*", "").replace("★", "").strip()
    # Remove any leftover (SET) without collector number
    line = re.sub(r"\s+\([A-Z0-9]+\)", "", line)
    return line.strip()

def parse_decklist(deck_text):
    cards = []
    lines = deck_text.strip().split("\n")

    for line in lines:
        original_line = line.strip()
        if not original_line:
            continue

        # Extract quantity (default to 1 if not found)
        match = re.match(r"^(\d+)?\s*(.*)", original_line)
        quantity = int(match.group(1)) if match.group(1) else 1
        line = match.group(2)

        # Clean card name
        name = extract_card_name(line)

        # Only add a base name if quantity == 1
        if quantity == 1:
            cards.append({
                "name": name,
                "raw": original_line,
                "display_name": name
            })
        else:
            for i in range(1, quantity + 1):
                cards.append({
                    "name": name,
                    "raw": original_line,
                    "display_name": f"{name}_{i}"
                })

    return cards


# Create custom Tkinter popup
def get_decklist_from_user():
    result = {"text": None}

    def submit():
        result["text"] = text_box.get("1.0", tk.END)
        window.destroy()

    window = tk.Tk()
    window.title("Paste Decklist")
    window.geometry("500x400")

    tk.Label(window, text="Paste your decklist below:").pack(pady=5)

    text_box = tk.Text(window, wrap=tk.WORD, height=20)
    text_box.pack(padx=10, pady=5, expand=True, fill=tk.BOTH)

    submit_btn = tk.Button(window, text="Submit", command=submit)
    submit_btn.pack(pady=10)

    window.mainloop()
    return result["text"]

# Run GUI and parse
decklist = get_decklist_from_user()
deck_name = simpledialog.askstring("Deck Name", "Enter a name for this deck:")

parsed = parse_decklist(decklist)
output_folder = os.path.join(r"C:\e-cards\Desktop app\Scryfall Images", deck_name)
converted_folder = os.path.join(output_folder, "converted")

# Ensure output and converted folders exist
os.makedirs(converted_folder, exist_ok=True)

if parsed:
    # Commander = first card in parsed list
    commander_name = parsed[0]["name"]

    # Save commander name to converted/commander.txt
    with open(os.path.join(converted_folder, "commander.txt"), "w") as f:
        f.write(commander_name)

    # Download images
    for card in parsed:
        fetch_card_image(card["name"], output_folder, filename_override=card["display_name"])

else:
    print("No decklist entered.")
    
# Existing image conversion
convert_all_images(output_folder)

# 🆕 Automatically create deck.json
# Convert color images to black & white
converted_folder = convert_all_images(output_folder)

# ✅ Only now generate deck.json inside converted_folder
generate_deck_json(converted_folder)
