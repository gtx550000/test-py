// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test', //ระบุโฟลเดอร์ให้ตรงกับที่มีจริง
  fullyParallel: false, // ปรับเป็น false เพราะต้องรอคนแก้ CAPTCHA ทีละจอ
  workers: 1, // สำคัญ: ให้รันทีละ 1 หน้าต่างเพื่อไม่ให้สับสนตอนแก้ CAPTCHA
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});