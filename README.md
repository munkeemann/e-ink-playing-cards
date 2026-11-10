# E-ink playing cards for Magic: The Gathering

Playing cards with small e-paper displays, so one set of physical cards can become any deck. A phone app picks the deck, a Raspberry Pi hub sends each card's image to its display, and the cards sit in a 3D-printed deck box with USB-C connections.

I built this over about a year, from May 2025 to May 2026, through a lot of trial and error across three apps, two display platforms, and enclosure designs through version 11. Much of the software was written by directing Claude Code.

## How it fits together

| Folder | What it is |
|---|---|
| repository root (`app/`, `src/`) | iOS app (Expo, React Native, TypeScript). Imports decklists, pulls card images from the Scryfall API, and sends card images to the displays during a game, including shuffling and scrying. |
| `pi/` | Raspberry Pi hub. Runs a Wi-Fi access point and a Flask server that registers cards, checks they're reachable, converts images, and forwards display commands. Also includes Bluetooth experiments. |
| `firmware/esp32-ble-receiver/` | ESP32 card firmware that receives card images over Bluetooth and drives the e-paper panel. |
| `firmware/wifi-card/` | Card firmware that joins the Pi's network and receives images over Wi-Fi. |
| `firmware/screen-check/` | Display test sketch. |
| `android-app/` | Earlier Android app (Kotlin, Jetpack Compose) that sent images over Bluetooth and Wi-Fi. |
| `desktop-prototype/` | First prototype (Python, Tkinter): parse a decklist or Moxfield link, fetch cards from Scryfall, and convert images for e-paper. |
| `hardware/cad/` | Card cases, LilyGo T5 button and lid enclosures (through v11), and deck boxes that hold 24 cards with USB-C pass-throughs, plus design renders. |

## Timeline

- **May 2025:** desktop prototype on a Waveshare 4.2-inch e-paper panel; first card case designs (v1 to v3).
- **2025 to early 2026:** Android app; ESP32 Bluetooth receiver firmware.
- **March to April 2026:** Raspberry Pi hub and iOS app.
- **April to May 2026:** deck box v8 to v9.2 and LilyGo T5 enclosures through v11.

## Setup notes

Wi-Fi credentials in the firmware are placeholders. Set `YOUR_WIFI_SSID` and `YOUR_WIFI_PASSWORD` before flashing. The Pi hub serves on `192.168.4.1:5050` on its own access point.

## Credits

E-paper display drivers in `pi/` and `firmware/esp32-ble-receiver/` are adapted from Waveshare's examples, with their original headers kept. Card data and images come from the [Scryfall API](https://scryfall.com/docs/api) at runtime.

Magic: The Gathering is a trademark of Wizards of the Coast. This project is not affiliated with or endorsed by Wizards of the Coast or Scryfall.
