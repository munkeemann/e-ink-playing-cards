#include <WiFi.h>
#include <HTTPClient.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <epd_driver.h>
#include <esp_jpg_decode.h>
#include <firasans.h>

#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
#define PI_SERVER_IP    "192.168.4.1"
#define PI_SERVER_PORT  5050
#define SLEEVE_ID       1

#define EPD_WIDTH       960
#define EPD_HEIGHT      540

#define CARD_W          760
#define UI_X            760
#define ZONE_W          160
#define LABEL_X         920
#define LABEL_W         40

#define BTN_CYCLE       21
#define ZONE_CONFIRM_MS 5000

const char* ZONE_LABELS[] = { "EXL", "GRV", "BTFLD", "HND", "LIB" };
const int   ZONE_COUNT    = 5;
int currentZone = 4;

uint8_t *framebuffer     = nullptr;
uint8_t *cardFramebuffer = nullptr;
AsyncWebServer server(80);
uint8_t *jpegBuf   = nullptr;
size_t   jpegBytes = 0;
volatile bool newImageReady = false;
volatile bool decoding      = false;

// ── pixel helpers ────────────────────────────────────────────────

void setPixel(int x, int y, uint8_t gray4) {
    if (x < 0 || x >= EPD_WIDTH || y < 0 || y >= EPD_HEIGHT) return;
    int idx = (y * EPD_WIDTH + x) / 2;
    if (x % 2 == 0)
        framebuffer[idx] = (framebuffer[idx] & 0x0F) | (gray4 << 4);
    else
        framebuffer[idx] = (framebuffer[idx] & 0xF0) | gray4;
}

uint8_t getPixel(int x, int y) {
    if (x < 0 || x >= EPD_WIDTH || y < 0 || y >= EPD_HEIGHT) return 0x0F;
    int idx = (y * EPD_WIDTH + x) / 2;
    if (x % 2 == 0)
        return (framebuffer[idx] >> 4) & 0x0F;
    else
        return framebuffer[idx] & 0x0F;
}

void fillRect(int x, int y, int w, int h, uint8_t gray4) {
    for (int row = y; row < y + h; row++)
        for (int col = x; col < x + w; col++)
            setPixel(col, row, gray4);
}

// ── JPEG decode ──────────────────────────────────────────────────

struct JpegSrc { uint8_t *data; size_t size; };

static size_t my_jpg_reader(void *arg, size_t index, uint8_t *buf, size_t len) {
    JpegSrc *src = (JpegSrc*)arg;
    if (index >= src->size) return 0;
    size_t available = src->size - index;
    if (len > available) len = available;
    if (buf) memcpy(buf, src->data + index, len);
    return len;
}

static bool my_jpg_writer(void *arg, uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint8_t *data) {
    if (!data) return true;
    for (int row = 0; row < h; row++) {
        for (int col = 0; col < w; col++) {
            uint8_t *px = data + (row * w + col) * 3;
            uint8_t gray = (uint8_t)(px[0] * 0.299f + px[1] * 0.587f + px[2] * 0.114f);
            gray = (uint8_t)min(255, (int)(gray * 1.5f));
            uint8_t gray4 = gray >> 4;
            int fbX = y + row;
            int fbY = EPD_HEIGHT - 1 - (x + col);
            setPixel(fbX, fbY, gray4);
        }
    }
    return true;
}

// ── UI strip ─────────────────────────────────────────────────────

void drawUIStrip() {
    // Zone strip
    fillRect(UI_X, 0, ZONE_W, EPD_HEIGHT, 0x0F);
    fillRect(UI_X, 0, 2, EPD_HEIGHT, 0x00);

    int cellH = EPD_HEIGHT / ZONE_COUNT;

    for (int i = 0; i < ZONE_COUNT; i++) {
        int cellY = i * cellH;
        bool active = (i == currentZone);

        uint8_t bg = active ? 0x00 : 0x0F;
        fillRect(UI_X + 2, cellY, ZONE_W - 2, cellH, bg);

        if (i > 0) fillRect(UI_X + 2, cellY, ZONE_W - 2, 2, 0x00);

        int32_t cursor_x = UI_X + 8;
        int32_t cursor_y = cellY + cellH / 2 + 10;

        if (active) {
            FontProperties props;
            props.fg_color = 0x0F;
            props.bg_color = 0x00;
            props.fallback_glyph = 0;
            props.flags = 0;
            write_mode(&FiraSans, ZONE_LABELS[i], &cursor_x, &cursor_y, framebuffer, WHITE_ON_BLACK, &props);
        } else {
            writeln(&FiraSans, ZONE_LABELS[i], &cursor_x, &cursor_y, framebuffer);
        }
    }

    // ── Label strip ───────────────────────────────────────────────
    // Clear label area
    fillRect(LABEL_X, 0, LABEL_W, EPD_HEIGHT, 0x0F);
    fillRect(LABEL_X, 0, 2, EPD_HEIGHT, 0x00);

    // Build label string
    char label[16];
    if (SLEEVE_ID == 1) {
        strcpy(label, "Commander");
    } else {
        snprintf(label, sizeof(label), "Card %d", SLEEVE_ID - 1);
    }

    // Strategy: render text horizontally into a spare region of the framebuffer
    // (below the visible EPD area is not possible, so use top-left corner temporarily)
    // We'll use a scratch region at y=0..LABEL_W-1, x=0..EPD_HEIGHT-1
    // Save that region first, render text, read pixels, rotate into label strip, restore

    // Save scratch region (top LABEL_W rows, full width)
    int scratchH = LABEL_W;  // 40 rows
    int scratchW = EPD_WIDTH; // 960 cols
    int scratchSize = scratchW * scratchH / 2;
    uint8_t *scratch = (uint8_t*)ps_malloc(scratchSize);
    if (!scratch) {
        // fallback: just write sideways as before
        int32_t cx = LABEL_X + 4;
        int32_t cy = EPD_HEIGHT / 2 + 10;
        writeln(&FiraSans, label, &cx, &cy, framebuffer);
        return;
    }

    // Save original pixels in scratch region
    memcpy(scratch, framebuffer, scratchSize);

    // Clear scratch region to white
    for (int row = 0; row < scratchH; row++)
        for (int col = 0; col < scratchW; col++)
            setPixel(col, row, 0x0F);

    // Render text horizontally into scratch region
    int32_t cursor_x = 10;
    int32_t cursor_y = scratchH / 2 + 8;
    writeln(&FiraSans, label, &cursor_x, &cursor_y, framebuffer);

    // Read rendered pixels from scratch region and rotate 90° CCW into label strip
    // Rotation: scratch(tx, ty) → label strip(LABEL_X + ty, EPD_HEIGHT - 1 - tx)
    for (int ty = 0; ty < scratchH; ty++) {
        for (int tx = 0; tx < EPD_HEIGHT; tx++) {
            uint8_t pix = getPixel(tx, ty);
            int destX = LABEL_X + 2 + ty;
            int destY = EPD_HEIGHT - 1 - tx;
            // Write directly to framebuffer bypassing setPixel bounds check inline
            if (destX >= 0 && destX < EPD_WIDTH && destY >= 0 && destY < EPD_HEIGHT) {
                int idx = (destY * EPD_WIDTH + destX) / 2;
                if (destX % 2 == 0)
                    framebuffer[idx] = (framebuffer[idx] & 0x0F) | (pix << 4);
                else
                    framebuffer[idx] = (framebuffer[idx] & 0xF0) | pix;
            }
        }
    }

    // Restore scratch region from saved data
    memcpy(framebuffer, scratch, scratchSize);

    // Now write the rotated label pixels back (they were computed from scratch region
    // but we need to re-apply them since we just restored)
    // Re-render into scratch region again
    for (int row = 0; row < scratchH; row++)
        for (int col = 0; col < scratchW; col++)
            setPixel(col, row, 0x0F);

    cursor_x = 10;
    cursor_y = scratchH / 2 + 8;
    writeln(&FiraSans, label, &cursor_x, &cursor_y, framebuffer);

    // Store rendered text pixels
    uint8_t *textPixels = (uint8_t*)ps_malloc(scratchSize);
    if (textPixels) {
        memcpy(textPixels, framebuffer, scratchSize);

        // Restore card pixels in scratch region
        memcpy(framebuffer, scratch, scratchSize);

        // Now rotate text pixels into label strip
        for (int ty = 0; ty < scratchH; ty++) {
            for (int tx = 0; tx < EPD_HEIGHT; tx++) {
                // Read from textPixels
                int sidx = (ty * EPD_WIDTH + tx) / 2;
                uint8_t pix;
                if (tx % 2 == 0)
                    pix = (textPixels[sidx] >> 4) & 0x0F;
                else
                    pix = textPixels[sidx] & 0x0F;

                if (pix == 0x0F) continue; // skip white pixels

                int destX = LABEL_X + 2 + ty;
                int destY = EPD_HEIGHT - 1 - tx;
                setPixel(destX, destY, pix);
            }
        }
        free(textPixels);
    }

    free(scratch);
}

// ── render ───────────────────────────────────────────────────────

void refreshScreen() {
    memcpy(framebuffer, cardFramebuffer, EPD_WIDTH * EPD_HEIGHT / 2);
    drawUIStrip();
    epd_poweron();
    epd_clear();
    epd_draw_grayscale_image(epd_full_screen(), framebuffer);
    epd_poweroff();
    Serial.println("[EPD] Done");
}

void decodeAndShow() {
    Serial.printf("[JPEG] Decoding %d bytes...\n", jpegBytes);
    memset(framebuffer, 0xFF, EPD_WIDTH * EPD_HEIGHT / 2);
    JpegSrc src = { jpegBuf, jpegBytes };
    esp_err_t ret = esp_jpg_decode(jpegBytes, JPG_SCALE_NONE, my_jpg_reader, my_jpg_writer, &src);
    memcpy(cardFramebuffer, framebuffer, EPD_WIDTH * EPD_HEIGHT / 2);
    Serial.printf("[JPEG] Result: %s\n", ret == ESP_OK ? "OK" : esp_err_to_name(ret));
    refreshScreen();
}

// ── WiFi ─────────────────────────────────────────────────────────

void connectWifi() {
    Serial.printf("[WiFi] Connecting to %s...\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int tries = 0;
    while (WiFi.status() != WL_CONNECTED && tries < 30) {
        delay(500); Serial.print("."); tries++;
    }
    if (WiFi.status() == WL_CONNECTED)
        Serial.printf("\n[WiFi] Connected - IP: %s\n", WiFi.localIP().toString().c_str());
    else
        Serial.println("\n[WiFi] Failed - will retry");
}

void registerWithPi() {
    if (WiFi.status() != WL_CONNECTED) return;
    HTTPClient http;
    String url = "http://" + String(PI_SERVER_IP) + ":" + String(PI_SERVER_PORT) + "/register";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(10000);
    StaticJsonDocument<128> doc;
    doc["sleeve_id"] = SLEEVE_ID;
    doc["ip"]        = WiFi.localIP().toString();
    String body; serializeJson(doc, body);
    int code = http.POST(body);
    Serial.printf("[REG] HTTP code: %d\n", code);
    http.end();
}

void reportZoneToPi() {
    if (WiFi.status() != WL_CONNECTED) return;
    HTTPClient http;
    String url = "http://" + String(PI_SERVER_IP) + ":" + String(PI_SERVER_PORT) + "/zone_update";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    StaticJsonDocument<128> doc;
    doc["sleeve_id"] = SLEEVE_ID;
    doc["zone"]      = currentZone;
    doc["zone_name"] = ZONE_LABELS[currentZone];
    String body; serializeJson(doc, body);
    http.POST(body);
    http.end();
}

// ── routes ───────────────────────────────────────────────────────

void setupRoutes() {
    server.on("/ping", HTTP_GET, [](AsyncWebServerRequest *req) {
        StaticJsonDocument<64> doc;
        doc["sleeve_id"] = SLEEVE_ID;
        doc["status"]    = "ok";
        String resp; serializeJson(doc, resp);
        req->send(200, "application/json", resp);
    });

    server.on("/zone", HTTP_POST, [](AsyncWebServerRequest *req) {
        if (req->hasParam("zone")) {
            int z = req->getParam("zone")->value().toInt();
            if (z >= 0 && z < ZONE_COUNT) {
                currentZone = z;
                refreshScreen();
            }
        }
        req->send(200, "text/plain", "OK");
    });

    server.on("/display", HTTP_POST,
        [](AsyncWebServerRequest *req) {
            req->send(200, "application/json",
                "{\"ok\":true,\"sleeve_id\":\"" + String(SLEEVE_ID) + "\",\"ip\":\"" + WiFi.localIP().toString() + "\"}");
        },
        nullptr,
        [](AsyncWebServerRequest *req, uint8_t *data, size_t len, size_t index, size_t total) {
            if (index == 0) {
                if (decoding) {
                    Serial.println("[HTTP] Ignoring — already decoding");
                    return;
                }
                if (jpegBuf) { free(jpegBuf); jpegBuf = nullptr; }
                jpegBuf = (uint8_t*)ps_malloc(total);
                jpegBytes = total;
                if (!jpegBuf) { Serial.println("[ERR] ps_malloc failed"); return; }
            }
            if (jpegBuf) memcpy(jpegBuf + index, data, len);
            if (index + len >= total) {
                Serial.printf("[HTTP] Received %d bytes\n", total);
                if (!decoding) {
                    newImageReady = true;
                } else {
                    Serial.println("[HTTP] Ignoring — already decoding");
                }
            }
        }
    );

    server.begin();
    Serial.println("[HTTP] Server on :80");
}

// ── setup / loop ─────────────────────────────────────────────────

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.printf("\n=== MTG Sleeve #%d ===\n", SLEEVE_ID);

    epd_init();

    framebuffer     = (uint8_t*)ps_malloc(EPD_WIDTH * EPD_HEIGHT / 2);
    cardFramebuffer = (uint8_t*)ps_malloc(EPD_WIDTH * EPD_HEIGHT / 2);
    if (!framebuffer || !cardFramebuffer) {
        Serial.println("[FATAL] PSRAM not available!");
        while (1) delay(1000);
    }
    memset(framebuffer,     0xFF, EPD_WIDTH * EPD_HEIGHT / 2);
    memset(cardFramebuffer, 0xFF, EPD_WIDTH * EPD_HEIGHT / 2);
    Serial.println("[EPD] Framebuffer OK");

    epd_poweron();
    epd_clear();
    epd_poweroff();

    connectWifi();
    setupRoutes();
    if (WiFi.status() == WL_CONNECTED) {
        delay(500);
        registerWithPi();
    }

    pinMode(BTN_CYCLE, INPUT_PULLUP);
    Serial.println("[BOOT] Ready");
}

void loop() {
    static bool lastBtnState       = HIGH;
    static int  pendingZone        = -1;
    static unsigned long lastCycleTime = 0;
    static unsigned long lastBtnTime   = 0;

    if (millis() - lastBtnTime > 50) {
        bool btnState = digitalRead(BTN_CYCLE);

        if (btnState == LOW && lastBtnState == HIGH) {
            if (pendingZone == -1) pendingZone = currentZone;
            pendingZone = (pendingZone + 1) % ZONE_COUNT;
            currentZone = pendingZone;
            lastCycleTime = millis();
            refreshScreen();
            Serial.printf("[BTN] Zone preview: %s\n", ZONE_LABELS[currentZone]);
        }

        if (pendingZone != -1 && millis() - lastCycleTime > ZONE_CONFIRM_MS) {
            pendingZone = -1;
            Serial.printf("[BTN] Zone confirmed: %s\n", ZONE_LABELS[currentZone]);
            reportZoneToPi();
        }

        lastBtnState = btnState;
        lastBtnTime  = millis();
    }

    if (newImageReady && jpegBuf && !decoding) {
        newImageReady = false;
        decoding = true;
        decodeAndShow();
        free(jpegBuf);
        jpegBuf   = nullptr;
        jpegBytes = 0;
        decoding  = false;
    }

    if (WiFi.status() != WL_CONNECTED) {
        connectWifi();
        if (WiFi.status() == WL_CONNECTED) registerWithPi();
    }
}