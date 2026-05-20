const path = require('path');
const { faker } = require('@faker-js/faker');
const WgcBasePage = require('./WgcBasePage');

class WgcStep4_Health_Insurance extends WgcBasePage {
    constructor(page, generatedData) {
        super(page); // ส่ง page ให้คลาสแม่จัดการ
        this.generatedData = generatedData;
    }

    // ฟังก์ชันหลักสำหรับจัดการหน้าฟอร์ม Health Insurance
    async fillHealthInsuranceStep4() {
        console.log('🔘 [WGC Form - Step 4] เริ่มจัดการข้อมูล Health Insurance');

        try {
            // 💡 0. ตรวจสอบว่าหน้าโหลดเสร็จ
            const investmentHeader = this.page.getByText(/Health insurance policy/i).first();
            await investmentHeader.waitFor({ state: 'visible', timeout: 15000 });
            console.log('   ✅ พบส่วนของ Health Insurance แล้ว กำลังกรอกข้อมูล...');
            
            // 💡 1. ติ๊ก Radio: Insurance Type (แก้บั๊กคลิกไม่โดน)
            // เปลี่ยนท่า: หา input[type="radio"] โดยตรงแล้วสั่ง check บังคับติ๊ก เพื่อให้ฟอร์มด้านล่างกางออก
            console.log('   🔲 กำลังเลือก Insurance Type...');
            const insuranceRadio = this.page.locator('input[type="radio"]').first();
            await insuranceRadio.waitFor({ state: 'attached', timeout: 5000 });
            await insuranceRadio.check({ force: true });
            console.log('   ✅ เลือก Insurance Type สำเร็จ (รอฟอร์มขยาย...)');

            // 💡 2. กรอกชื่อบริษัทประกัน (Health Insurance Company)
            const fakeCompanyName = faker.company.name() + ' Hospital';
            const insuranceCompanyInput = this.page.locator('#health_insurance_company');
            await insuranceCompanyInput.waitFor({ state: 'visible', timeout: 5000 }); // รอจนกว่าช่องจะโผล่มา
            await insuranceCompanyInput.fill(fakeCompanyName);
            console.log(`   ✅ กรอก Health Insurance Company สำเร็จ (${fakeCompanyName})`);

            // 💡 3. กรอกวงเงินคุ้มครอง (Coverage Amount) -> ใช้ name="coverage_amount"
            // ใช้ .or() เพื่อรองรับทั้ง name และ id ป้องกันเว็บเปลี่ยนโครงสร้าง
            const coverageAmountInput = this.page.locator('input[name="coverage_amount"]').or(this.page.locator('#coverage_amount')).first();
            const randomCoverage = faker.number.int({ min: 55000, max: 150000 }).toString();
            await coverageAmountInput.fill(randomCoverage); 
            console.log(`   ✅ กรอก Coverage Amount สำเร็จ (${randomCoverage})`);

            // 💡 4. จัดการวันเริ่มต้นคุ้มครอง (Start Coverage Date)
            const today = new Date();
            const dd = String(today.getDate()).padStart(2, '0');
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const yyyyPast = today.getFullYear() - 2; 
            
            const dynamicPastDate = `${dd}/${mm}/${yyyyPast}`; 
            console.log(`   📅 กำลังกรอก Start Coverage Date: ${dynamicPastDate}`);

            try {
                const startDateInput = this.page.locator('#start_coverage_date')
                    .or(this.page.locator('.ant-form-item').filter({ hasText: /Start Coverage Date/i }).locator('input'))
                    .first();
                await startDateInput.waitFor({ state: 'visible', timeout: 5000 });
                
                // 🚨 กฎเหล็ก Ant Design: ปฏิทินห้ามใช้ .fill() ต้องคลิกแล้วพิมพ์ (.type) เท่านั้น
                await startDateInput.click({ force: true });
                await startDateInput.clear();
                await startDateInput.pressSequentially(dynamicPastDate, { delay: 50 });
                await this.page.keyboard.press('Enter');
                console.log('   ✅ กรอก Start Coverage Date ด้วยวันคำนวณเสร็จสิ้น');
            } catch (dateErr) {
                console.log(`   ⚠️ ท่าหลักติดขัด กำลังใช้แผนสำรอง กรอกวันที่ฟิกซ์ 10/02/2020...`);
                const fallbackDateInput = this.page.locator('#start_coverage_date').first();
                await fallbackDateInput.click({ force: true });
                await fallbackDateInput.clear();
                await fallbackDateInput.pressSequentially('10/02/2020', { delay: 50 });
                await this.page.keyboard.press('Enter');
                console.log('   ✅ กรอก Start Coverage Date ด้วยท่าสำรองสำเร็จ (10/02/2020)');
            }

            // 💡 5. ติ๊ก Checkbox ยอมรับเงื่อนไข
            console.log('   🔲 กำลังค้นหาและติ๊กเลือก Checkbox ยอมรับเงื่อนไข...');
            const insuranceCheckboxLabel = this.page.locator('label').filter({ 
                hasText: /I purchased an insurance policy from the company and have been renewing it for over a year now/i 
            }).first();

            await insuranceCheckboxLabel.waitFor({ state: 'visible', timeout: 5000 });
            await insuranceCheckboxLabel.scrollIntoViewIfNeeded();
            await insuranceCheckboxLabel.click({ force: true }); 
            console.log('   ✅ ติ๊กเลือก Checkbox เงื่อนไขประกันสำเร็จ');

        } catch (error) {
            console.error('❌ เกิดข้อผิดพลาดระหว่างกรอกข้อมูล Health Insurance:', error.message);
            throw error;
        }

            // 💡 6. อัปโหลดเอกสารสำหรับหัวข้อ Health Insurance
            console.log('   📤 กำลังอัปโหลดไฟล์เอกสาร...');
            const filePath = path.join(__dirname, '../data/uploads/file/Screenshot 2026-04-22 165119.png');
            try {
                // ใช้ .last() เพื่อบังคับให้อัปโหลดใส่กล่องที่อยู่ล่างสุด 
                const fileInput = this.page.locator('.ant-upload').filter({ has: this.page.locator('[data-icon="file-add"]') }).locator('input[type="file"]').last();
                await fileInput.waitFor({ state: 'attached', timeout: 5000 });
                await fileInput.setInputFiles(filePath);
                await this.page.waitForTimeout(3000); 
            } catch (error) {
                try {
                    const backupFileInput = this.page.locator('input[type="file"]').last();
                    await backupFileInput.setInputFiles(filePath);
                    await this.page.waitForTimeout(3000);
                } catch (innerError) {}
            }

            //7. กดปุ่ม Continue เพื่อไปหน้าถัดไป
            try {
            console.log('   🔘 กำลังกดปุ่ม Continue เพื่อไปหน้า Review...');
            const submitBtn = this.page.locator('button[type="submit"]').first();
            await submitBtn.waitFor({ state: 'attached', timeout: 5000 });
            await submitBtn.scrollIntoViewIfNeeded();
            await submitBtn.click();
            
            // 💡 รอแท็บของหน้า Review โผล่ขึ้นมายืนยันว่าเปลี่ยนหน้าสำเร็จ (ค้นหาจากข้อความ)
            const ReviewTab = this.page.getByText(/Review/i).first();
            await ReviewTab.waitFor({ state: 'visible', timeout: 15000 });
            console.log('      ✅ เปลี่ยนหน้าสำเร็จ! ตอนนี้อยู่บนแท็บ Review แล้ว');
        } catch (error) {
            console.log(`      ❌ เกิดข้อผิดพลาดตอนเปลี่ยนหน้า: ${error.message}`);
            // 💡 โยน Error ออกไปเพื่อหยุดการทำงานหากไม่สามารถเปลี่ยนหน้าได้
            throw error; 
        }
    }
}



module.exports = WgcStep4_Health_Insurance;