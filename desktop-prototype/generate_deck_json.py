import os
import json

def generate_deck_json(converted_folder):
    commander_txt = os.path.join(converted_folder, "commander.txt")
    try:
        with open(commander_txt, "r") as f:
            commander_name = f.read().strip()
    except FileNotFoundError:
        print("⚠️ commander.txt not found.")
        commander_name = None

    bmp_files = [
        f for f in os.listdir(converted_folder)
        if f.lower().endswith(".bmp")
    ]

    cards = []
    for i, filename in enumerate(sorted(bmp_files), 1):
        name = os.path.splitext(filename)[0]
        cards.append({
            "name": name,
            "display_name": name,
            "place": i,
            "is_commander": (name == commander_name)
        })

    deck = {
        "commander": commander_name,
        "cards": cards
    }

    output_path = os.path.join(converted_folder, "deck.json")
    with open(output_path, "w") as f:
        json.dump(deck, f, indent=2)

    print(f"✅ Deck JSON written to {output_path}")

