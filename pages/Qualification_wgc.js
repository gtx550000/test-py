// ไฟล์: pages/WgcFormPage.js
const path = require('path');
const { faker, fakerTH, fakerEN_CA, fakerEN_US, fakerJP } = require('@faker-js/faker');

class WgcFormPage {
    constructor(page) {
        this.page = page;
        this.generatedData = null; // 💡 เก็บข้อมูลไว้ส่งต่อให้ Step 2
    }

    getPassportFilePath(fileName) {
        return path.resolve(process.cwd(), 'data/uploads/passport', fileName);
    }

    /**
     * 🛡️ ฟังก์ชันสำหรับดักจับและปิด Intro Tour (หน้าต่างสอนใช้งาน)
     */
    async handleIntroTour() {
        const skipBtn = this.page.locator('.introjs-skipbutton');
        try {
            await skipBtn.waitFor({ state: 'visible', timeout: 5000 });
            console.log('💡 [WGC Form] ตรวจพบ Intro Tour หน้าเว็บ กำลังกดปุ่ม Skip...');
            await skipBtn.click();
            await this.page.waitForTimeout(1000); 
            console.log('      ✅ ปิด Intro Tour สำเร็จ หน้าจอโล่งแล้ว');
        } catch (error) {
            console.log('   ⏭️ ไม่พบ Intro Tour ในรอบนี้ (ข้ามไปทำสเตปต่อไป)');
        }
    }

    /**
     * 🛡️ ฟังก์ชันสำหรับดักจับและปิด Popup แจ้งเตือนเรื่องอายุพาสปอร์ต
     */
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
                } else {
                    await this.page.keyboard.press('Escape');
                }
            } catch (error) {
                await this.page.keyboard.press('Escape');
            }
            await this.page.waitForTimeout(1000); 
        }
    }

    /**
     * 🧠 ฟังก์ชันสุ่มที่อยู่และเบอร์โทรตาม Locale
     */
    generateDynamicPersonalInfo(nationality) {
        const nat = (nationality || '').toLowerCase().trim();
        let localeFaker = faker; 
        let countryName = 'United Kingdom'; 
        let countryCode = '+44'; // 💡 กำหนดค่าเริ่มต้น
        let dynamicAddress = '';

        if (nat.includes('thai')) {
            localeFaker = fakerTH;
            countryName = 'Thailand';
            countryCode = '+66';
            dynamicAddress = `${localeFaker.location.streetAddress()}, ${localeFaker.location.city()}, ${localeFaker.location.state()}, ${localeFaker.location.zipCode()}, Thailand`;
        } else if (nat.includes('canadian')) {
            localeFaker = fakerEN_CA;
            countryName = 'Canada';
            countryCode = '+1';
            // 💡 สุ่มประกอบร่างให้ได้ฟอร์แมตคล้าย: 200 Elizabeth Street, Toronto, ON M5G 2C4, Canada
            dynamicAddress = `${localeFaker.location.streetAddress()}, ${localeFaker.location.city()}, ${localeFaker.location.state({ abbreviated: true })} ${localeFaker.location.zipCode()}, Canada`;
        } else if (nat.includes('american') || nat.includes('usa')) {
            localeFaker = fakerEN_US;
            countryName = 'USA';
            countryCode = '+1';
            dynamicAddress = `${localeFaker.location.streetAddress()}, ${localeFaker.location.city()}, ${localeFaker.location.state({ abbreviated: true })} ${localeFaker.location.zipCode()}, USA`;
        } else if (nat.includes('japanese')) {
            localeFaker = fakerJP;
            countryName = 'Japan';
            countryCode = '+81';
            dynamicAddress = `${localeFaker.location.streetAddress()}, ${localeFaker.location.city()}, ${localeFaker.location.zipCode()}, Japan`;
        } else {
            dynamicAddress = `${localeFaker.location.streetAddress()}, ${localeFaker.location.city()}, ${localeFaker.location.zipCode()}, ${countryName}`;
        }

        return {
            birthPlace: `${localeFaker.location.city()}, ${countryName}`,
            permanentAddress: dynamicAddress, // 💡 ใช้ที่อยู่ที่สุ่มและประกอบร่างขึ้นมาใหม่ทุกรอบ
            phoneNumber: localeFaker.phone.number(),
            country: countryName,
            countryCode: countryCode // 💡 ส่งรหัสประเทศออกไปใช้งาน
        };
    }

    // ==========================================================
    // 🗂️ Step 1: Upload Passport & Gen Data
    // ==========================================================
    async uploadPassportStep1(fileName) {
        console.log(`🔘 [WGC Form - Step 1] เริ่ม Upload Visa OCR ด้วยไฟล์: ${fileName}`);

        await this.handleIntroTour();

        // 1. Upload Passport
        const fileChooserPromise = this.page.waitForEvent('filechooser');
        await this.page.getByRole('button', { name: /Scan OCR Local GPU/i }).click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(this.getPassportFilePath(fileName));

        console.log('   ⏳ รอ OCR Processing...');
        await this.page.waitForTimeout(5000);
        await this.handlePassportWarning(); 

        // 2. Fill Place of Birth (Dynamic Data)
        console.log('   🕵️‍♂️ ดึงข้อมูลสัญชาติจากหน้าจอ...');
        const nationalityLocator = this.page.locator('.ant-select-selection-item').first();
        await nationalityLocator.waitFor({ state: 'visible', timeout: 5000 }); 
        
        const nationalityText = await nationalityLocator.textContent();
        console.log(`      ✅ ระบบอ่านสัญชาติได้: ${nationalityText}`);

        // 🚨 แก้ไขชื่อฟังก์ชันให้ตรงกันแล้วตรงนี้!
        this.generatedData = this.generateDynamicPersonalInfo(nationalityText);
        
        console.log(`   📝 กรอก Place of Birth: ${this.generatedData.birthPlace}`);
        await this.page.locator('#birth_place').fill(this.generatedData.birthPlace);

        // 3. Fill Passport Dates
        console.log('   📅 กำลังจัดการวันที่...');
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const currentYear = today.getFullYear();
        
        // 👉 3.1 Date of Issue
        const issueDateStr = `${day}/${month}/${currentYear}`;
        const issueInput = this.page.locator('#date_of_issue');
        await issueInput.waitFor({ state: 'visible', timeout: 10000 });
        await issueInput.fill(issueDateStr);
        await issueInput.press('Enter');
        await this.page.keyboard.press('Escape'); 
        await this.handlePassportWarning();

        // 👉 3.2 Date of Expired
        const expiredYear = currentYear + 2;
        const expiredDateStr = `${day}/${month}/${expiredYear}`;
        const expiredInput = this.page.locator('#date_of_expire'); 
        await expiredInput.waitFor({ state: 'visible', timeout: 10000 });
        await expiredInput.fill(expiredDateStr);
        await expiredInput.press('Enter');
        await this.page.keyboard.press('Escape'); 
        await this.handlePassportWarning();

        console.log(`      ✅ ตั้งค่าวันที่สำเร็จ`);

        // 4. Continue
        console.log('   🔘 กด Continue ไป Step 2...');
        await this.page.getByRole('button', { name: /Continue/i }).click();
    }

    // ==========================================================
    // 🗂️ Step 2: Personal Information (Upgraded Smart Locators)
    // ==========================================================
    async fillPersonalInformationStep2(expectedTitle = null) {
        console.log('🔘 [WGC Form - Step 2] เริ่มกรอก Personal Information');

        // รอให้หน้า Step 2 โหลดเสร็จและระบบ UI นิ่ง
        await this.page.waitForLoadState('networkidle');
        await this.handleIntroTour();

        // 💡 1. ดึงค่า Gender ที่ได้จากระบบ OCR เพื่อมากำหนด Title แบบ Dynamic
        let targetTitle = expectedTitle;
        if (!targetTitle) {
            console.log('   🕵️‍♂️ กำลังตรวจสอบเพศ (Gender) ที่ระบบอ่านได้จาก OCR...');
            try {
                // ค้นหาฟิลด์เพศ โดยหาจาก Label ที่มีคำว่า Gender หรือ Sex
                const genderField = this.page.locator('.ant-form-item').filter({ has: this.page.locator('label', { hasText: /Gender|Sex/i }) }).locator('.ant-select-selection-item, input').first();
                await genderField.waitFor({ state: 'attached', timeout: 5000 });
                
                let detectedGender = '';
                const tagName = await genderField.evaluate(el => el.tagName.toLowerCase());
                if (tagName === 'input') {
                    detectedGender = await genderField.inputValue();
                } else {
                    detectedGender = await genderField.textContent();
                }
                
                detectedGender = detectedGender.trim().toUpperCase();
                console.log(`      ✅ ระบบ OCR ระบุเพศเป็น: ${detectedGender}`);
                
                // แปลงเพศเป็นคำนำหน้า
                targetTitle = (detectedGender === 'MALE' || detectedGender === 'M') ? 'MR.' : 'MISS';
                
            } catch (error) {
                console.log('      ⚠️ ไม่สามารถอ่านค่าเพศได้จากหน้าจอ จะใช้ค่าเริ่มต้นเป็น MISS');
                targetTitle = 'MISS';
            }
        }

        // 2. Title (เลือกคำนำหน้า)
        // ---------------------------------------------------------
        console.log(`   👨‍🦰 กำลังคลิกเลือก Title เป็น: ${targetTitle} ...`);
        try {
            // 💡 อัปเกรดความแม่นยำ: ใช้ locator.or() เพื่อให้ครอบคลุมทุกเคสของ Ant Design
            const titleTarget = this.page.locator('.ant-form-item').filter({ has: this.page.locator('label', { hasText: 'Title' }) }).locator('.ant-select-selector')
                .or(this.page.locator('input#title'))
                .or(this.page.locator('#title .ant-select-selector'))
                .first();
                
            await titleTarget.waitFor({ state: 'attached', timeout: 10000 });
            await titleTarget.scrollIntoViewIfNeeded();
            
            // คลิกรอบแรกเพื่อเปิด Dropdown
            await titleTarget.click({ force: true });
            console.log('      🖱️ คลิกที่ Dropdown แล้ว รอรายการปรากฏ...');
            
            // รอให้ตัวเลือก (Option) ปรากฏขึ้นมา (Ant Design มักจะใช้คลาส .ant-select-item-option)
            // 💡 แปลง expectedTitle ให้เป็น Regex เพื่อค้นหาแบบ Exact Match (ไม่สนใจตัวพิมพ์เล็ก-ใหญ่)
            const titleRegex = new RegExp(`^${targetTitle.replace('.', '\\.')}$`, 'i');
            const optionTarget = this.page.locator('.ant-select-item-option').filter({ hasText: titleRegex }).first();
            await optionTarget.waitFor({ state: 'visible', timeout: 5000 });
            
            console.log(`      👉 กำลังเลือกตัวเลือก ${targetTitle} ...`);
            await optionTarget.click(); 
            
            console.log('      ✅ เลือก Title สำเร็จ');

        } catch (error) {
            console.log(`      ❌ เกิดข้อผิดพลาดในการเลือก Title: ${error.message}`);
            // ท่าสำรอง: ถ้าคลิกไม่ได้จริงๆ ลองใช้การพิมพ์แล้ว Enter
            try {
                console.log('      👉 สำรอง: ค้นหา Input และพิมพ์ค่าลงไปโดยตรง...');
                const titleInput = this.page.locator('input#title').or(this.page.locator('.ant-form-item').filter({ has: this.page.locator('label', { hasText: 'Title' }) }).locator('input')).first();
                await titleInput.fill(targetTitle);
                await this.page.waitForTimeout(500); // รอ UI กรองข้อมูลสักครู่
                await this.page.keyboard.press('Enter');
                console.log(`      ✅ เลือก Title ด้วยท่าสำรองสำเร็จ (${targetTitle})`);
            } catch (innerError) {
                console.log(`      ❌ สำรองก็ไม่ได้ผล: ${innerError.message}`);
            }
        }

        // 3. Permanent Address
        // ---------------------------------------------------------
        console.log(`   📝 กำลังกรอก Permanent Address: ${this.generatedData?.permanentAddress}`);
        try {
            // 💡 อัปเดต Locator ให้ยืดหยุ่นขึ้น โดยเพิ่ม name="home_country_address" ตามที่แนะนำ
            const addressInput = this.page.locator('[name="home_country_address"]') // 1. ลองหาจาก name attribute ก่อน
                .or(this.page.locator('input#permanent_address, textarea#permanent_address')) // 2. ลองหาจาก ID
                .or(this.page.locator('.ant-form-item').filter({ has: this.page.locator('label', { hasText: /Permanent Address/i }) }).locator('input, textarea')) // 3. ลองหาจาก Label
                .first();

            await addressInput.waitFor({ state: 'attached', timeout: 5000 });
            await addressInput.scrollIntoViewIfNeeded();
            await addressInput.fill(this.generatedData?.permanentAddress || '123 Default Street, Unknown City, Country');
            console.log('      ✅ กรอก Permanent Address สำเร็จ');
        } catch (error) {
            console.log(`      ❌ เกิดข้อผิดพลาดในการกรอก Permanent Address: ${error.message}`);
        }
        
        

        // ---------------------------------------------------------
        // 5. Phone Number (อ้างอิงจาก id="phone")
        // ---------------------------------------------------------
        // เตรียมข้อมูล: ลบตัวอักษรพิเศษออกให้เหลือแค่ตัวเลข
        const rawPhoneNumber = this.generatedData?.phoneNumber || '0812345678';
        const cleanPhoneNumber = rawPhoneNumber.replace(/\D/g, ''); 

        console.log(`   📞 [Step 5] กำลังกรอกหมายเลขโทรศัพท์: ${cleanPhoneNumber}`);

        try {
            // 💡 ชี้เป้าด้วย ID ถาวร #phone ตามที่ระบุ
            const phoneInput = this.page.locator('#phone');
            
            // รอให้ช่อง Input ถูก Render ลงใน DOM
            await phoneInput.waitFor({ state: 'attached', timeout: 5000 });
            await phoneInput.scrollIntoViewIfNeeded();
            
            // จำลองพฤติกรรมมนุษย์ (Native Interaction) เพื่อกระตุ้น React State
            await phoneInput.click();
            await phoneInput.clear();
            await phoneInput.type(cleanPhoneNumber, { delay: 50 });
            
            console.log('      ✅ กรอกเบอร์โทรศัพท์สำเร็จ');

        } catch (error) {
            console.log(`      ❌ เกิดข้อผิดพลาดใน Step 5 (Phone Number): ${error.message}`);
            
            // 🔄 ท่าสำรอง (Fallback) กรณี #phone มีปัญหา จะใช้ Placeholder แทน
            try {
                console.log('      🔄 กำลังใช้ท่าสำรองโดยค้นหาจาก Placeholder...');
                const backupPhoneInput = this.page.getByPlaceholder('Phone number');
                await backupPhoneInput.waitFor({ state: 'attached', timeout: 3000 });
                await backupPhoneInput.click();
                await backupPhoneInput.clear();
                await backupPhoneInput.type(cleanPhoneNumber, { delay: 50 });
                console.log('      ✅ กรอกเบอร์โทรศัพท์ (ท่าสำรอง) สำเร็จ');
            } catch (backupError) {
                console.log(`      ❌ ท่าสำรองล้มเหลว: ${backupError.message}`);
            }
        }
    }
}

module.exports = WgcFormPage;