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

        if (nat.includes('thai')) {
            localeFaker = fakerTH;
            countryName = 'Thailand';
        } else if (nat.includes('canadian')) {
            localeFaker = fakerEN_CA;
            countryName = 'Canada';
        } else if (nat.includes('american') || nat.includes('usa')) {
            localeFaker = fakerEN_US;
            countryName = 'USA';
        } else if (nat.includes('japanese')) {
            localeFaker = fakerJP;
            countryName = 'Japan';
        }

        return {
            birthPlace: `${localeFaker.location.city()}, ${countryName}`,
            permanentAddress: `${localeFaker.location.streetAddress()}, ${localeFaker.location.city()}, ${localeFaker.location.zipCode()}, ${countryName}`,
            phoneNumber: localeFaker.phone.number(), 
            country: countryName 
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
    // 🗂️ Step 2: Personal Information
    // ==========================================================
    async fillPersonalInformationStep2(fileName) {
        console.log('🔘 [WGC Form - Step 2] เริ่มกรอก Personal Information');

        await this.page.waitForLoadState('networkidle');
        await this.handleIntroTour();

        // 1. Title
        console.log('   👨‍🦰 เลือก Title (คำนำหน้า)...');
        await this.page.locator('#title').click(); 
        await this.page.getByText('Mr.', { exact: true }).click(); 

        // 2. Permanent Address
        if (this.generatedData) {
            console.log(`   🏠 กรอก Permanent Address: ${this.generatedData.permanentAddress}`);
            const addressInput = this.page.locator('#permanent_address'); 
            await addressInput.fill(this.generatedData.permanentAddress);
        }

        // 3. Contact
        if (this.generatedData) {
            console.log(`   📞 จัดการ Contact (ประเทศ: ${this.generatedData.country})`);
            
            const countryCodeDropdown = this.page.locator('#phone_country_code'); 
            await countryCodeDropdown.click();
            await this.page.getByText(this.generatedData.country).first().click();

            const phoneInput = this.page.locator('#phone_number'); 
            const cleanPhoneNumber = this.generatedData.phoneNumber.replace(/\D/g, ''); 
            await phoneInput.fill(cleanPhoneNumber);
        }

        // 4. Copy of your current Passport
        console.log(`   📁 อัปโหลดไฟล์ Copy of Passport: ${fileName}`);
        const fileChooserPromise = this.page.waitForEvent('filechooser');
        
        // 💡 ตรวจสอบตรงนี้: อาจต้องปรับ name: ให้ตรงกับปุ่มอัปโหลดใน Step 2 ของจริง
        await this.page.getByRole('button', { name: /Upload Passport/i }).click(); 
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(this.getPassportFilePath(fileName));
        await this.page.waitForTimeout(3000); 

        // 5. Continue
        console.log('   🔘 กด Continue ไป Step ถัดไป...');
        await this.page.getByRole('button', { name: /Continue/i }).click();
        
        console.log('✅ ผ่านหน้า Personal Information (Step 2) สำเร็จ');
    }
}

module.exports = WgcFormPage;