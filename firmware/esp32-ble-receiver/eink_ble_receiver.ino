#include <Arduino.h>
#include <SPI.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "epd_impl_minimal.h"

#define IMAGE_WIDTH 300
#define IMAGE_HEIGHT 400
#define EXPECTED_IMAGE_SIZE 16062  // includes BMP header

#define EPD_CS   5
#define EPD_DC   17
#define EPD_RST  26
#define EPD_BUSY 25

#define SERVICE_UUID        "12345678-1234-1234-1234-1234567890ab"
#define CHARACTERISTIC_UUID "abcd1234-abcd-1234-abcd-1234567890ab"

uint8_t* imageBuffer = nullptr;
size_t imageOffset = 0;
bool receivingImage = false;

void resetImageBuffer() {
  if (imageBuffer != nullptr) free(imageBuffer);
  imageBuffer = (uint8_t*) malloc(EXPECTED_IMAGE_SIZE);
  imageOffset = 0;
  receivingImage = imageBuffer != nullptr;
  Serial.println(receivingImage ? "🔄 Image buffer allocated." : "❌ Failed to allocate image buffer.");
}

// ---- Display BMP to e-Ink ----
void drawImage(const uint8_t* data, size_t length) {
  const int WIDTH = 300;
  const int HEIGHT = 400;
  const int ROW_BYTES = ((WIDTH + 31) / 32) * 4;
  const int PIXEL_OFFSET = 62;

  if (length < PIXEL_OFFSET + ROW_BYTES * HEIGHT) {
    Serial.println("❌ BMP too small");
    return;
  }

  const uint8_t* pixels = data + PIXEL_OFFSET;

  Serial.println("🔄 Initializing display...");
  EPD_Init_4in2_V2();
  EPD_WaitUntilIdle_high();
  delay(100);

  Serial.println("🧹 Clearing display...");
  EPD_SendCommand(0x24);
  for (int y = 0; y < HEIGHT; ++y) {
    for (int x = 0; x < WIDTH / 8; ++x) {
      EPD_SendData(0xFF);
    }
  }
  EPD_WaitUntilIdle_high();
  delay(100);

  Serial.println("🖼️ Writing image data...");
  EPD_SendCommand(0x24);
  for (int y = HEIGHT - 1; y >= 0; --y) {
    const uint8_t* row = pixels + y * ROW_BYTES;
    for (int x = 0; x < WIDTH / 8; ++x) {
      EPD_SendData(row[x]);
    }
  }

  EPD_WaitUntilIdle_high();
  delay(100);

  Serial.println("⚡ Refreshing screen...");
  EPD_4IN2_V2_Show();
  EPD_WaitUntilIdle_high();
  delay(500);
}

// ---- BLE Write Handler ----
class ImageReceiverCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) override {
    if (!receivingImage) resetImageBuffer();

    String valueStr = pCharacteristic->getValue();
    const char* data = valueStr.c_str();
    size_t chunkSize = valueStr.length();

    Serial.print("🔎 Chunk start bytes: ");
    for (int i = 0; i < min((size_t)16, chunkSize); ++i) {
      Serial.print((uint8_t)data[i], HEX); Serial.print(" ");
    }
    Serial.println();

    if (imageOffset + chunkSize <= EXPECTED_IMAGE_SIZE) {
      memcpy(imageBuffer + imageOffset, data, chunkSize);
      imageOffset += chunkSize;

      Serial.printf("📦 Received %d bytes (Total: %d)\n", (int)chunkSize, (int)imageOffset);

      if (imageOffset >= EXPECTED_IMAGE_SIZE) {
        Serial.println("✅ Image complete. Rendering...");
        drawImage(imageBuffer, EXPECTED_IMAGE_SIZE);
        free(imageBuffer);
        imageBuffer = nullptr;
        imageOffset = 0;
        receivingImage = false;
        Serial.println("🧹 Ready for next image.");
      }
    } else {
      Serial.println("❌ Too much data received. Aborting.");
      free(imageBuffer);
      imageBuffer = nullptr;
      imageOffset = 0;
      receivingImage = false;
    }
  }
};

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("🚀 Booting BLE + e-Ink receiver...");

  pinMode(EPD_BUSY, INPUT);
  pinMode(EPD_RST, OUTPUT);
  digitalWrite(EPD_RST, HIGH);
  SPI.begin(18, -1, 23, EPD_CS);
  EPD_initSPI();

  BLEDevice::init("EInkReceiver");
  BLEServer* pServer = BLEDevice::createServer();
  BLEService* pService = pServer->createService(SERVICE_UUID);
  BLECharacteristic* pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pCharacteristic->setCallbacks(new ImageReceiverCallback());
  pCharacteristic->addDescriptor(new BLE2902());
  pService->start();
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->start();

  Serial.println("📡 BLE ready — waiting for image data.");
}

void loop() {
  // No logic needed here
}
