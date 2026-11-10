// Minimal BMP-to-E-Ink screen test
// Goal: Only replicate mapping logic, then show a white screen

#include <Arduino.h>
#include <SPI.h>
#include "epd_impl_minimal.h"

#define WIDTH 300
#define HEIGHT 400

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("🧪 Starting BMP mapping test...");

  // Pin setup (match your wiring)
  pinMode(EPD_BUSY, INPUT);
  pinMode(EPD_RST, OUTPUT);
  digitalWrite(EPD_RST, HIGH);

  SPI.begin(18, -1, 23, EPD_CS); // SCK, MISO (unused), MOSI, SS
  EPD_initSPI();

  // Minimal V2 init — no refresh, no clear
  EPD_Reset();
  EPD_WaitUntilIdle_high();
  EPD_SendCommand(0x12);  // SWRESET
  EPD_WaitUntilIdle_high();

  EPD_Send_2(0x21, 0x40, 0x00);
  EPD_Send_1(0x3C, 0x05);
  EPD_Send_1(0x11, 0x03);

  EPD_Send_2(0x44, 0x00, 0x31);                    // X RAM start/end
  EPD_Send_4(0x45, 0x00, 0x00, 0x2B, 0x01);        // Y RAM start/end
  EPD_Send_1(0x4E, 0x00);                          // Set RAM X address
  EPD_Send_2(0x4F, 0x00, 0x00);                    // Set RAM Y address

  // Write all white (0xFF)
  Serial.println("🧽 Filling screen with white...");
  EPD_SendCommand(0x24);
  for (int i = 0; i < WIDTH * HEIGHT / 8; ++i) {
    EPD_SendData(0xFF);
  }

  // Refresh
  EPD_4IN2_V2_Show();
  Serial.println("✅ Done: White screen should be shown.");
}

void loop() {
  // Nothing
}