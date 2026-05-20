const path = require('path');
const WgcBasePage = require('./WgcBasePage');

class WgcStep2_PersonalInfo extends WgcBasePage {
    // รับ instance ของ page และข้อมูลที่ได้จาก Step 1 (เช่น ประเทศ, เบอร์โทร, ที่อยู่)
    constructor(page, generatedData) {
        super(page); // ส่ง page ไปให้คลาสแม่ (WgcBasePage)
        this.generatedData = generatedData; 
    }

    // ฟังก์ชันหลักสำหรับจัดการหน้าฟอร์ม Personal Information
    async fillPersonalInformationStep2(expectedTitle = null) {
        console.log('🔘 [WGC Form - Step 2] เริ่มกรอก Personal Information');
        await this.page.waitForLoadState('networkidle');
        await this.handleIntroTour();

        // =========================================================
        // 💡 1. ดึงค่า Gender ที่ได้จากระบบ OCR เพื่อมากำหนด Title
        // =========================================================
        let targetTitle = expectedTitle;
        if (!targetTitle) {
            console.log('   🕵️‍♂️ กำลังตรวจสอบเพศ (Gender) ที่ระบบอ่านได้จาก OCR...');
            try {
                const genderField = this.page.locator('.ant-form-item').filter({ has: this.page.locator('label', { hasText: /Gender|Sex/i }) }).locator('.ant-select-selection-item, input').first();
                await genderField.waitFor({ state: 'attached', timeout: 5000 });
                
                let detectedGender = await genderField.evaluate(el => el.tagName.toLowerCase()) === 'input' 
                                        ? await genderField.inputValue() : await genderField.textContent();
                
                detectedGender = detectedGender.trim().toUpperCase();
                targetTitle = (detectedGender === 'MALE' || detectedGender === 'M') ? 'MR.' : 'MISS';
            } catch (error) {
                targetTitle = 'MISS';
            }
        }

        // =========================================================
        // 💡 2. Title (เลือกคำนำหน้า)
        // =========================================================
        console.log(`   👨‍🦰 กำลังคลิกเลือก Title เป็น: ${targetTitle} ...`);
        try {
            // ใช้ท่าหลัก: ค้นหาจาก Label หรือ ID
            const titleTarget = this.page.locator('.ant-form-item').filter({ has: this.page.locator('label', { hasText: 'Title' }) }).locator('.ant-select-selector')
                .or(this.page.locator('input#title'))
                .or(this.page.locator('#title .ant-select-selector')).first();
                
            await titleTarget.waitFor({ state: 'attached', timeout: 10000 });
            await titleTarget.scrollIntoViewIfNeeded();
            await titleTarget.click({ force: true });
            
            // ค้นหา Option แบบ Exact Match ป้องกันการเลือกผิด
            const titleRegex = new RegExp(`^${targetTitle.replace('.', '\\.')}$`, 'i');
            const optionTarget = this.page.locator('.ant-select-item-option').filter({ hasText: titleRegex }).first();
            await optionTarget.waitFor({ state: 'visible', timeout: 5000 });
            await optionTarget.click(); 
            console.log('      ✅ เลือก Title สำเร็จ');
        } catch (error) {
            // ท่าสำรอง: ใช้การพิมพ์ค้นหาแล้วกด Enter
            try {
                const titleInput = this.page.locator('input#title').or(this.page.locator('.ant-form-item').filter({ has: this.page.locator('label', { hasText: 'Title' }) }).locator('input')).first();
                await titleInput.fill(targetTitle);
                await this.page.waitForTimeout(500); 
                await this.page.keyboard.press('Enter');
            } catch (innerError) {
                console.log(`      ❌ เกิดข้อผิดพลาดในการเลือก Title: ${innerError.message}`);
            }
        }

        // =========================================================
        // 💡 3. กรอก Permanent Address (ที่อยู่ถาวร)
        // =========================================================
        console.log(`   📝 กำลังกรอก Permanent Address: ${this.generatedData?.permanentAddress}`);
        try {
            const addressInput = this.page.locator('[name="home_country_address"]') 
                .or(this.page.locator('input#permanent_address, textarea#permanent_address'))
                .or(this.page.locator('.ant-form-item').filter({ has: this.page.locator('label', { hasText: /Permanent Address/i }) }).locator('input, textarea')).first();

            await addressInput.waitFor({ state: 'attached', timeout: 5000 });
            await addressInput.fill(this.generatedData?.permanentAddress || '123 Default Street, Unknown City, Country');
        } catch (error) {
            // Ignore logs
        }
        
        // =========================================================
        // 💡 4. กรอก Phone Number
        // =========================================================
        // เตรียมข้อมูล: ลบตัวอักษรพิเศษออกให้เหลือแค่ตัวเลข
        const rawPhoneNumber = this.generatedData?.phoneNumber || '0812345678';
        const cleanPhoneNumber = rawPhoneNumber.replace(/\D/g, ''); 
        console.log(`   📞 กำลังกรอกหมายเลขโทรศัพท์: ${cleanPhoneNumber}`);
        try {
            const phoneInput = this.page.locator('#phone');
            await phoneInput.waitFor({ state: 'attached', timeout: 5000 });
            await phoneInput.click();
            await phoneInput.clear();
            await phoneInput.pressSequentially(cleanPhoneNumber, { delay: 50 });
        } catch (error) {
            const backupPhoneInput = this.page.getByPlaceholder('Phone number');
            await backupPhoneInput.click();
            await backupPhoneInput.clear();
            await backupPhoneInput.pressSequentially(cleanPhoneNumber, { delay: 50 });
        }

        // =========================================================
        // 💡 5. อัปโหลดไฟล์เอกสาร
        // =========================================================
        console.log('   📤 กำลังอัปโหลดไฟล์เอกสาร...');
        try {
            const filePath = path.join(__dirname, '../data/uploads/file/Screenshot 2026-04-22 165119.png');
            // เจาะพิกัดด้วยไอคอน file-add
            const fileInput = this.page.locator('.ant-upload')
                                  .filter({ has: this.page.locator('[data-icon="file-add"]') })
                                  .locator('input[type="file"]');

            await fileInput.waitFor({ state: 'attached', timeout: 5000 });
            await fileInput.setInputFiles(filePath);
            await this.page.waitForTimeout(3000); 
            console.log('      ✅ อัปโหลดไฟล์สำเร็จ');
        } catch (error) {
            // ท่าสำรอง: หา input ประเภทไฟล์อันแรกสุดของหน้าเว็บ
            try {
                const filePath = path.join(__dirname, '../data/uploads/file/Screenshot 2026-04-22 165119.png');
                const backupFileInput = this.page.locator('input[type="file"]').first();
                await backupFileInput.setInputFiles(filePath);
                await this.page.waitForTimeout(3000);
            } catch (innerError) {
                // Ignore logs
            }
        } 
        
        // =========================================================
        // 💡 6. Manual Intervention & ตรวจสอบการเปลี่ยนหน้า
        // =========================================================
        console.log('   ⏸️ [WGC Form] หยุดพักสคริปต์ให้จัดการรหัสประเทศด้วยมือ...');
        try {
            // 🔴 สคริปต์จะหยุดตรงนี้ รอให้คนกด Resume (ผ่าน Playwright Inspector)
            await this.page.pause();

            console.log('   🔘 กำลังกดปุ่ม Continue เพื่อไปหน้า Income & Assets...');
            const submitBtn = this.page.locator('button[type="submit"]').first();
            await submitBtn.waitFor({ state: 'attached', timeout: 5000 });
            await submitBtn.scrollIntoViewIfNeeded();
            await submitBtn.click();
            
            // รอแท็บของ Step 3 โผล่ขึ้นมายืนยันว่าเปลี่ยนหน้าสำเร็จ
            const incomeAssetsTab = this.page.locator('.intro-income-assets-tab');
            await incomeAssetsTab.waitFor({ state: 'visible', timeout: 15000 });
            console.log('      ✅ เปลี่ยนหน้าสำเร็จ! ตอนนี้อยู่บนแท็บ Income & Assets แล้ว');
        } catch (error) {
            console.log(`      ❌ เกิดข้อผิดพลาดตอนเปลี่ยนหน้า: ${error.message}`);
        }
    }
}
module.exports = WgcStep2_PersonalInfo;