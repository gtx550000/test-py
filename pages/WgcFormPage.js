// ไฟล์: pages/WgcFormPage.js
const path = require('path');

class WgcFormPage {
    constructor(page) {
        this.page = page;
    }

    getPassportFilePath(fileName) {
        return path.resolve(process.cwd(), 'data/uploads/passport', fileName);
    }

    async handlePassportWarning() {
        await this.page.locator('body').click(); 
        await this.page.waitForTimeout(2000);

        const warningHeader = this.page.getByText('Passport Validity Warning');
        if (await warningHeader.isVisible()) {
            console.log('⚠️ [WGC Form] ตรวจพบ Popup: Passport Validity Warning');
            try {
                const popupBox = this.page.locator('[role="dialog"], .ant-modal-content, .modal-content').filter({ has: warningHeader }).first();
                const closeBtn = popupBox.locator('[aria-label="Close"], [data-icon="close"], .ant-modal-close, button.close').first();
                if (await closeBtn.isVisible()) {
                    await closeBtn.click();
                    console.log('✅ [WGC Form] ปิด Popup สำเร็จ');
                } else {
                    await this.page.keyboard.press('Escape');
                }
            } catch (error) {
                await this.page.keyboard.press('Escape');
            }
            await this.page.waitForTimeout(1000); 
        }
    }

    async uploadPassportStep1(fileName) {
        console.log(`🔘 [WGC Form - Step 1] เริ่ม Upload Visa OCR ด้วยไฟล์: ${fileName}`);

        // ======================================================
        // 1. Upload Passport
        // ======================================================
        const fileChooserPromise = this.page.waitForEvent('filechooser');
        await this.page.getByRole('button', { name: /Scan OCR Local GPU/i }).click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(this.getPassportFilePath(fileName));

        console.log('   ⏳ รอ OCR Processing...');
        await this.page.waitForTimeout(5000);
        
        // ดัก Popup ครั้งที่ 1 (หลัง OCR ทำงานเสร็จ)
        await this.handlePassportWarning(); 

        // ======================================================
        // 2. Fill Place of Birth
        // ======================================================
        console.log('   📝 กรอก Place of Birth...');
        await this.page.locator('#birth_place').fill('Bangkok, Thailand');

        // ======================================================
        // 3. Fill Passport Dates
        // ======================================================
        console.log('   📅 กำลังจัดการวันที่...');
        
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const currentYear = today.getFullYear();
        
        // 👉 3.1 Date of Issue
        console.log('      👉 กำลังตั้งค่า Date of Issue...');
        const issueDateStr = `${day}/${month}/${currentYear}`;
        const issueInput = this.page.locator('#date_of_issue');
        
        await issueInput.waitFor({ state: 'visible', timeout: 10000 });
        await issueInput.fill(issueDateStr);
        await issueInput.press('Enter');
        await this.page.keyboard.press('Escape'); // ปิดปฏิทิน
        
        // ดัก Popup ครั้งที่ 2 (เผื่อเด้งหลังแก้ Date of Issue)
        await this.handlePassportWarning();

        // 👉 3.2 Date of Expired
        console.log('      👉 กำลังตั้งค่า Date of Expired...');
        const expiredYear = currentYear + 2;
        const expiredDateStr = `${day}/${month}/${expiredYear}`;
        const expiredInput = this.page.locator('#date_of_expire'); 
        
        await expiredInput.waitFor({ state: 'visible', timeout: 10000 });
        await expiredInput.fill(expiredDateStr);
        await expiredInput.press('Enter');
        await this.page.keyboard.press('Escape'); // ปิดปฏิทิน
        
        // ดัก Popup ครั้งที่ 3 (ตามภาพ h16.png เคลียร์หลังแก้ Date of Expired)
        await this.handlePassportWarning();

        console.log(`      ✅ ตั้งค่าวันที่สำเร็จ`);

        // ======================================================
        // 4. Continue
        // ======================================================
        console.log('   🔘 กด Continue...');
        await this.page.getByRole('button', { name: /Continue/i }).click();

        console.log('✅ ผ่านหน้า Upload Visa (Step 1) สำเร็จ');
        
        // ======================================================
        // 5. Pause Execution
        // ======================================================
        console.log('⏸️ หยุดการทำงานของสคริปต์ชั่วคราวเพื่อตรวจสอบผลลัพธ์...');
        await this.page.waitForTimeout(30000); // หยุดรอ 30 วินาที
    }
}

module.exports = WgcFormPage;