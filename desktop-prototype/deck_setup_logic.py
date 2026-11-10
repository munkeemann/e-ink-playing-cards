import random


def assign_deck_positions(cards, commander_name):
    """
    Shuffles the deck, places the Commander on top, and assigns each card a place from top (1) to bottom (N).
    Modifies cards in-place and returns the updated list.
    """
    commander_card = None
    non_commander_cards = []

    for card in cards:
        if card["name"].lower() == commander_name.lower():
            commander_card = card
            card["is_commander"] = True
        else:
            non_commander_cards.append(card)

    if commander_card is None:
        raise ValueError(f"Commander '{commander_name}' not found in the deck.")

    random.shuffle(non_commander_cards)

    ordered = [commander_card] + non_commander_cards
    for i, card in enumerate(ordered):
        card["place"] = i + 1  # 1-based index: top = 1, bottom = N

    return ordered


def print_deck_order(cards):
    """
    Prints a plain-text list of card display names and their place in deck order.
    """
    for card in sorted(cards, key=lambda c: c["place"]):
        marker = " (Commander)" if card.get("is_commander") else ""
        print(f"{card['place']:>2}: {card['display_name']}{marker}")


def export_deck_order(cards, output_path):
    """
    Saves the ordered deck list to a text file.
    """
    with open(output_path, "w", encoding="utf-8") as f:
        for card in sorted(cards, key=lambda c: c["place"]):
            marker = " (Commander)" if card.get("is_commander") else ""
            f.write(f"{card['place']:>2}: {card['display_name']}{marker}\n")
