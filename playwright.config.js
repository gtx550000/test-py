const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test', // ตรวจสอบว่าชื่อโฟลเดอร์คือ test (ไม่มี s)
  fullyParallel: false,
  workers: 1, // สำคัญ: รันทีละหน้าจอเพื่อรอคนแก้ CAPTCHA
  reporter: 'html',
  
  /* ยุบรวมการตั้งค่าทั้งหมดมาไว้ใน use ก้อนเดียว */
  use: {
    headless: false, // เปิดหน้าจอเบราว์เซอร์ให้คุณเห็น
    screenshot: 'on',
    trace: 'on', // บันทึกไฟล์ Trace เฉพาะตอนที่เทสต์พัง
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});