import os
import tkinter as tk
from tkinter import filedialog, messagebox
from deck_setup_logic import assign_deck_positions, print_deck_order, export_deck_order
import random
import json

# Globals
deck_data = []
deck_name = ""

# GUI Setup
window = tk.Tk()
window.title("E-Deck Gameplay")
window.geometry("400x600")

frame = tk.Frame(window)
frame.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)

# NEW: Deck listbox (top-left area for saved decks)
deck_listbox = tk.Listbox(frame, height=5)
deck_listbox.pack(fill=tk.X, pady=(0, 10))

deck_listbox = tk.Listbox(frame, height=5)
deck_listbox.pack(fill=tk.BOTH, expand=False, pady=5)

def list_available_decks():
    base_path = r"C:\e-cards\Desktop app\Scryfall Images"
    decks = []
    for name in os.listdir(base_path):
        deck_path = os.path.join(base_path, name, "converted", "deck.json")
        if os.path.isfile(deck_path):
            decks.append(name)
    return decks


def refresh_deck_listbox():
    deck_listbox.delete(0, tk.END)
    for deck in list_available_decks():
        deck_listbox.insert(tk.END, deck)

refresh_deck_listbox()

def load_deck():
    global deck_data, deck_name
    selection = deck_listbox.curselection()
    if not selection:
        messagebox.showerror("No Deck Selected", "Please select a deck from the list.")
        return

    deck_name = deck_listbox.get(selection[0])
    deck_path = os.path.join(
        r"C:\e-cards\Desktop app\Scryfall Images", deck_name, "converted", "deck.json"
    )

    with open(deck_path, "r") as f:
        deck_data = json.load(f)

    assign_deck_positions(deck_data["cards"], deck_data["commander"])
    refresh_listbox()
    messagebox.showinfo("Deck Loaded", f"Deck '{deck_name}' loaded successfully.")


def start_game():
    global deck_data
    if not deck_data:
        return

    cards = deck_data["cards"]
    commander = next((card for card in cards if card.get("is_commander")), None)
    rest = [card for card in cards if not card.get("is_commander")]
    random.shuffle(rest)

    if commander:
        cards = [commander] + rest
    else:
        cards = rest

    assign_deck_positions(cards, commander["name"] if commander else None)
    deck_data["cards"] = cards
    refresh_listbox()
    export_deck_order(cards, deck_name)

def tutor_for_card():
    global deck_data
    cards = deck_data["cards"]

    selection = listbox.curselection()
    if not selection:
        return

    index = selection[0]
    selected_card = cards[index]

    # Move the card to the top
    cards.remove(selected_card)
    cards.insert(0, selected_card)
    assign_deck_positions(cards, selected_card["name"])
    refresh_listbox()
    export_deck_order(cards, deck_name)


def refresh_listbox():
    listbox.delete(0, tk.END)
    for card in deck_data["cards"]:
        label = f"{card['place']:02d}: {card['display_name']}"
        listbox.insert(tk.END, label)




load_button = tk.Button(frame, text="Load Deck", command=load_deck)
load_button.pack(fill=tk.X, pady=5)

start_button = tk.Button(frame, text="Start Game", command=start_game)
start_button.pack(fill=tk.X, pady=5)

tutor_button = tk.Button(frame, text="Tutor for Selected Card", command=tutor_for_card)
tutor_button.pack(fill=tk.X, pady=5)

listbox = tk.Listbox(frame)
listbox.pack(fill=tk.BOTH, expand=True, pady=10)

window.mainloop()
