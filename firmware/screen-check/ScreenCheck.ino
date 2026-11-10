#include <SPI.h>

#define PIN_SPI_CS    5
#define PIN_SPI_RST   17
#define PIN_SPI_DC    16
#define PIN_SPI_BUSY  25

void EPD_Reset() {
  digitalWrite(PIN_SPI_RST, LOW);
  delay(200);
  digitalWrite(PIN_SPI_RST, HIGH);
  delay(200);
}

void EPD_SendCommand(uint8_t command) {
  digitalWrite(PIN_SPI_DC, LOW);
  digitalWrite(PIN_SPI_CS, LOW);
  SPI.transfer(command);
  digitalWrite(PIN_SPI_CS, HIGH);
}

void EPD_SendData(uint8_t data) {
  digitalWrite(PIN_SPI_DC, HIGH);
  digitalWrite(PIN_SPI_CS, LOW);
  SPI.transfer(data);
  digitalWrite(PIN_SPI_CS, HIGH);
}

void EPD_WaitUntilIdle() {
  Serial.print("Waiting for BUSY to go LOW (idle)...");
  while (digitalRead(PIN_SPI_BUSY) == HIGH) {
    delay(100);
  }
  Serial.println("ready.");
}

void EPD_Init_4in2_V2() {
  EPD_Reset();
  EPD_WaitUntilIdle();

  EPD_SendCommand(0x12);  // soft reset
  EPD_WaitUntilIdle();

  EPD_SendCommand(0x21);  // Display update control
  EPD_SendData(0x40);
  EPD_SendData(0x00);

  EPD_SendCommand(0x3C);  // BorderWaveform
  EPD_SendData(0x05);

  EPD_SendCommand(0x11);  // Data Entry Mode
  EPD_SendData(0x03);     // X increment; Y increment

  EPD_SendCommand(0x44);  // RAM X address start/end
  EPD_SendData(0x00);
  EPD_SendData(0x31);     // 49*8 = 400px

  EPD_SendCommand(0x45);  // RAM Y address start/end
  EPD_SendData(0x00);
  EPD_SendData(0x00);
  EPD_SendData(0x2B);     // 300px
  EPD_SendData(0x01);

  EPD_SendCommand(0x4E);  // Set RAM X address
  EPD_SendData(0x00);

  EPD_SendCommand(0x4F);  // Set RAM Y address
  EPD_SendData(0x00);
  EPD_SendData(0x00);

  EPD_WaitUntilIdle();
}

void EPD_Fill(uint8_t fill_byte) {
  EPD_SendCommand(0x24);  // Start RAM write

  for (int i = 0; i < 400 * 300 / 8; i++) {
    EPD_SendData(fill_byte);
  }

  EPD_SendCommand(0x22);  // Display update sequence
  EPD_SendData(0xF7);
  EPD_SendCommand(0x20);  // Master activation
  EPD_WaitUntilIdle();
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIN_SPI_CS, OUTPUT);
  pinMode(PIN_SPI_RST, OUTPUT);
  pinMode(PIN_SPI_DC, OUTPUT);
  pinMode(PIN_SPI_BUSY, INPUT);
  SPI.begin(18, 19, 23);

  Serial.println("⚡ EPD Resurrection Attempt Starting...");

  // 💥 Garbage poke
  Serial.println("Sending garbage commands...");
  EPD_SendCommand(0x00);
  EPD_SendData(0x00);
  EPD_SendCommand(0xFF);  // invalid command
  delay(200);

  // 🌙 Try deep sleep exit
  Serial.println("Sending deep sleep exit...");
  EPD_SendCommand(0x10);
  EPD_SendData(0x01);
  delay(100);

  // 🔁 Actual init
  Serial.println("Starting legit init...");
  EPD_Init_4in2_V2();
  Serial.println("Init done.");

  // 🧼 Attempt a full white clear
  Serial.println("Filling WHITE...");
  EPD_Fill(0xFF);
  Serial.println("Test complete.");
}

void loop() {
  // silence
}
