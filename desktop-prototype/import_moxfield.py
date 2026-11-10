import requests
from requests_html import HTMLSession

def extract_deck_id(url):
    # Clean up the URL and extract deck ID
    url = url.strip().rstrip("/")
    if "decks/" in url:
        return url.split("decks/")[-1]
    raise ValueError("Invalid Moxfield URL format")



def get_deck_from_moxfield(url):
    deck_id = extract_deck_id(url)
    export_url = f"https://www.moxfield.com/decks/export/{deck_id}?format=txt"
    print(f"📥 Downloading export: {export_url}")

    session = HTMLSession()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/113.0.0.0 Safari/537.36"
    }

    try:
        res = session.get(export_url, headers=headers)
        res.raise_for_status()
    except Exception as e:
        print(f"❌ Request failed: {e}")
        raise Exception("Failed to fetch deck from Moxfield")

    decklist_text = res.text
    deck_name = f"MoxfieldDeck_{deck_id}"

    return deck_name, decklist_text


