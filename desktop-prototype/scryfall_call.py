# scryfall_call.py
import os
import re
import requests

def fetch_card_image_url(card_name):
    response = requests.get(f"https://api.scryfall.com/cards/named?fuzzy={card_name}")
    if response.status_code != 200:
        print(f"Failed to fetch data for {card_name}")
        return None

    data = response.json()
    if "image_uris" in data:
        return data["image_uris"]["normal"]
    elif "card_faces" in data:
        return data["card_faces"][0]["image_uris"]["normal"]
    else:
        print(f"No image URL found for {card_name}")
        return None

def fetch_card_image(card_name, output_folder="card_images", filename_override=None):
    os.makedirs(output_folder, exist_ok=True)
    image_url = fetch_card_image_url(card_name)
    if image_url is None:
        return

    # Use filename override or default to card name
    safe_name = filename_override if filename_override else card_name
    safe_name = re.sub(r'[\\/*?:"<>|]', "", safe_name)  # remove unsafe chars

    filename = os.path.join(output_folder, f"{safe_name}.jpg")

    response = requests.get(image_url)
    if response.status_code == 200:
        with open(filename, "wb") as f:
            f.write(response.content)
        print(f"Saved {filename}")
    else:
        print(f"Failed to download image for {card_name}")
