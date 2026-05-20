const path = require('path');
const { faker, fakerTH, fakerEN_CA, fakerEN_US, fakerJP } = require('@faker-js/faker');
const WgcBasePage = require('./WgcBasePage');

class WgcStep1_OCR extends WgcBasePage {
    // รับ instance ของ page สำหรับควบคุมเบราว์เซอร์
    constructor(page) {
        super(page); // ส่ง page ให้คลาสแม่จัดการ
        this.generatedData = null; // เก็บข้อมูลไว้ส่งต่อให้ Step 2 และ 3
    }

    // 🛠️ ฟังก์ชันสำหรับแปลงชื่อไฟล์ให้เป็น Path เต็มที่พร้อมสำหรับการอัปโหลด
    getPassportFilePath(fileName) {
        return path.resolve(process.cwd(), 'data/uploads/passport', fileName);
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
     * 🧠 ฟังก์ชันสุ่มที่อยู่และเบอร์โทรตามสัญชาติ (Locale) ที่ระบบ OCR อ่านได้
     */
    generateDynamicPersonalInfo(nationality) {
        const nat = (nationality || '').toLowerCase().trim();
        let localeFaker = faker; 
        let countryName = 'United Kingdom'; 
        let countryCode = '+44';
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
            permanentAddress: dynamicAddress,
            phoneNumber: localeFaker.phone.number(),
            country: countryName,
            countryCode: countryCode
        };
    }

    // ==========================================================
    // 🗂️ ฟังก์ชันหลักสำหรับจัดการหน้า Upload Passport (Step 1)
    // ==========================================================
    async uploadPassportStep1(fileName) {
        console.log(`🔘 [WGC Form - Step 1] เริ่ม Upload Visa OCR ด้วยไฟล์: ${fileName}`);

        await this.handleIntroTour();

        // 💡 1.1 อัปโหลดรูปภาพ Passport
        const fileChooserPromise = this.page.waitForEvent('filechooser');
        await this.page.getByRole('button', { name: /Scan OCR Local GPU/i }).click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(this.getPassportFilePath(fileName));

        console.log('   ⏳ รอ OCR Processing...');
        // รอระบบประมวลผลรูปภาพ
        await this.page.waitForTimeout(5000);
        await this.handlePassportWarning(); 

        // 💡 1.2 ดึงข้อมูลสัญชาติจากผลลัพธ์ OCR
        console.log('   🕵️‍♂️ ดึงข้อมูลสัญชาติจากหน้าจอ...');
        const nationalityLocator = this.page.locator('.ant-select-selection-item').first();
        await nationalityLocator.waitFor({ state: 'visible', timeout: 5000 }); 
        
        const nationalityText = await nationalityLocator.textContent();
        console.log(`      ✅ ระบบอ่านสัญชาติได้: ${nationalityText}`);

        // 💡 1.3 สร้างข้อมูลจำลอง (Fake Data) จากสัญชาติที่ได้
        this.generatedData = this.generateDynamicPersonalInfo(nationalityText);
        
        // 💡 1.4 กรอก Place of Birth (ที่เกิด)
        console.log(`   📝 กรอก Place of Birth: ${this.generatedData.birthPlace}`);
        await this.page.locator('#birth_place').fill(this.generatedData.birthPlace);

        // 💡 1.5 จัดการวันที่ออกและวันหมดอายุของพาสปอร์ต
        console.log('   📅 กำลังจัดการวันที่...');
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const currentYear = today.getFullYear();
        
        // กรอก Date of Issue (วันปัจจุบัน)
        await this.page.locator('#date_of_issue').fill(`${day}/${month}/${currentYear}`);
        await this.page.locator('#date_of_issue').press('Enter');
        
        // กรอก Date of Expiry (บวกเพิ่มไป 2 ปี)
        await this.page.locator('#date_of_expire').fill(`${day}/${month}/${currentYear + 2}`);
        await this.page.locator('#date_of_expire').press('Enter');
        await this.page.keyboard.press('Escape'); 
        
        await this.handlePassportWarning();

        // 💡 1.6 กดปุ่ม Continue เพื่อไปหน้าต่อไป (Step 2)
        await this.page.getByRole('button', { name: /Continue/i }).click();
        
        return this.generatedData; // 💡 รีเทิร์นข้อมูลกลับไปให้สคริปต์หลัก
    }
}
module.exports = WgcStep1_OCR;