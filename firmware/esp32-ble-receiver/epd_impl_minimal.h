
#pragma once

#include <Arduino.h>
#include <SPI.h>

// Pin definitions (adapt if needed)
#define PIN_SPI_SCK  13
#define PIN_SPI_DIN  14
#define PIN_SPI_CS   15
#define PIN_SPI_BUSY 25
#define PIN_SPI_RST  26
#define PIN_SPI_DC   27

#define LOW             0
#define HIGH            1
#define GPIO_PIN_SET    1
#define GPIO_PIN_RESET  0

#define IMAGE_WIDTH 300
#define IMAGE_HEIGHT 400


void EPD_initSPI() {
    pinMode(PIN_SPI_BUSY,  INPUT);
    pinMode(PIN_SPI_RST , OUTPUT);
    pinMode(PIN_SPI_DC  , OUTPUT);
    pinMode(PIN_SPI_SCK, OUTPUT);
    pinMode(PIN_SPI_DIN, OUTPUT);
    pinMode(PIN_SPI_CS , OUTPUT);

    digitalWrite(PIN_SPI_CS , HIGH);
    digitalWrite(PIN_SPI_SCK, LOW);
}

void EpdSpiTransferCallback(byte data) {
    digitalWrite(PIN_SPI_CS, GPIO_PIN_RESET);
    for (int i = 0; i < 8; i++) {
        digitalWrite(PIN_SPI_DIN, (data & 0x80) ? GPIO_PIN_SET : GPIO_PIN_RESET);
        data <<= 1;
        digitalWrite(PIN_SPI_SCK, GPIO_PIN_SET);
        digitalWrite(PIN_SPI_SCK, GPIO_PIN_RESET);
    }
    digitalWrite(PIN_SPI_CS, GPIO_PIN_SET);
}

void EPD_SendCommand(byte command) {
    digitalWrite(PIN_SPI_DC, LOW);
    EpdSpiTransferCallback(command);
}

void EPD_SendData(byte data) {
    digitalWrite(PIN_SPI_DC, HIGH);
    EpdSpiTransferCallback(data);
}

void EPD_Reset() {
    digitalWrite(PIN_SPI_RST, HIGH); 
    delay(200);    
    digitalWrite(PIN_SPI_RST, LOW);    
    delay(5);
    digitalWrite(PIN_SPI_RST, HIGH); 
    delay(200);    
}

void EPD_WaitUntilIdle() {
    while(digitalRead(PIN_SPI_BUSY) == 0) delay(100);    
}

void EPD_WaitUntilIdle_high() {
    Serial.print("⏳ Waiting for BUSY...");
    while (digitalRead(PIN_SPI_BUSY) == HIGH) {
        delay(10);
    }
    Serial.println("✅ Display is ready.");
}


void EPD_Send_1(byte c, byte v1) {
    EPD_SendCommand(c);
    EPD_SendData(v1);
}

void EPD_Send_2(byte c, byte v1, byte v2) {
    EPD_SendCommand(c);
    EPD_SendData(v1);
    EPD_SendData(v2);
}

void EPD_Send_3(byte c, byte v1, byte v2, byte v3) {
    EPD_SendCommand(c);
    EPD_SendData(v1);
    EPD_SendData(v2);
    EPD_SendData(v3);
}

void EPD_Send_4(byte c, byte v1, byte v2, byte v3, byte v4) {
    EPD_SendCommand(c);
    EPD_SendData(v1);
    EPD_SendData(v2);
    EPD_SendData(v3);
    EPD_SendData(v4);
}

void EPD_Send_5(byte c, byte v1, byte v2, byte v3, byte v4, byte v5) {
    EPD_SendCommand(c);
    EPD_SendData(v1);
    EPD_SendData(v2);
    EPD_SendData(v3);
    EPD_SendData(v4);
    EPD_SendData(v5);
}

// Only include minimal display init for 4.2" V2 panel
void EPD_Init_4in2_V2() {
    EPD_Reset();
    EPD_WaitUntilIdle_high();

    EPD_SendCommand(0x12);  // SWRESET
    EPD_WaitUntilIdle_high();

    EPD_Send_1(0x3C, 0x05);       // Border waveform
    EPD_Send_1(0x11, 0x03);       // Data Entry Mode
    EPD_Send_2(0x44, 0x00, 0x31); // RAM X address start/end (0–49 for 300px)
    EPD_Send_4(0x45, 0x00, 0x00, 0x2B, 0x01); // RAM Y range (0–399)
    EPD_Send_1(0x4E, 0x00);       // Set RAM X address to 0
    EPD_Send_2(0x4F, 0x00, 0x00); // Set RAM Y address to 0
}



void EPD_4IN2_V2_Show() {
    EPD_SendCommand(0x22);
    EPD_SendData(0xF7);
    EPD_SendCommand(0x20);  // DISPLAY REFRESH
    EPD_WaitUntilIdle();
}

void EPD_ClearScreen() {
    EPD_SendCommand(0x24);  // Write RAM (black channel)
    for (int i = 0; i < (IMAGE_WIDTH * IMAGE_HEIGHT / 8); ++i) {
        EPD_SendData(0xFF);  // All white
    }

    EPD_4IN2_V2_Show();  // Refresh with white screen
    delay(500);  // Let it settle
}
