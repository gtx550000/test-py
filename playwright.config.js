const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test', // ตรวจสอบว่าชื่อโฟลเดอร์คือ test (ไม่มี s)
  fullyParallel: false,
  workers: 1, // สำคัญ: รันทีละหน้าจอเพื่อรอคนแก้ CAPTCHA
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: false, // เปิดหน้าจอเบราว์เซอร์ให้คุณเห็น
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});