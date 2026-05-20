const path = require('path');
const WgcBasePage = require('./WgcBasePage');

class WgcStep3_Income extends WgcBasePage {
    // รับ instance ของ page สำหรับควบคุมเบราว์เซอร์ และ generatedData ที่สุ่ม/อ่านได้จาก Step 1
    constructor(page, generatedData) {
        super(page); // ส่ง page ให้คลาสแม่จัดการ
        this.generatedData = generatedData;
    }

    // ฟังก์ชันหลักสำหรับจัดการหน้าฟอร์ม Income & Assets
    async fillIncomeAndAssetsStep3() {
        console.log('🔘 [WGC Form - Step 3] เริ่มจัดการข้อมูล Income & Assets');

        try {
            // ตรวจสอบว่าหน้าโหลดเสร็จและพร้อมทำงาน โดยหาข้อความ Header ของส่วนนี้
            const investmentHeader = this.page.getByText('Details of investment in Thailand').first();
            await investmentHeader.waitFor({ state: 'visible', timeout: 15000 });

            // =========================================================
            // หัวข้อที่ 1: Details of investment in Thailand (Bonds)
            // =========================================================
            console.log('   💰 [หัวข้อ 1] เริ่มจัดการ Thai Government Bonds...');
            
            // 💡 1.1 ติ๊ก Checkbox: Thai Government Bonds (ใช้ Fallback คลิก Label ถ้าระบบซ่อน Input)
            const govBondLabel = this.page.locator('label').filter({ hasText: /Thai Government Bonds/i }).first();
            await govBondLabel.waitFor({ state: 'attached', timeout: 5000 });
            
            try {
                await govBondLabel.locator('input[type="checkbox"]').check({ force: true });
            } catch (error) {
                await govBondLabel.click({ force: true });
            }

            // 💡 1.2 ชี้เป้าช่องกรอกข้อมูล (ใช้ .or เพื่อครอบคลุมทั้ง ID และ Label)
            const bondSymbolInput = this.page.locator('#bond_symbol').or(this.page.locator('.ant-form-item').filter({ hasText: /Bond Symbol/i }).locator('input')).first();
            const purchasingAmountInput = this.page.locator('#purchase_amount').or(this.page.locator('input[placeholder*="Amount" i]')).first();

            // 💡 1.3 สุ่มเลข 3 หลักเพื่อสร้าง Bond Symbol (เช่น TB458) 
            const randomDigits = Math.floor(Math.random() * 900) + 100; 
            await bondSymbolInput.waitFor({ state: 'visible', timeout: 5000 });
            await bondSymbolInput.fill(`TB${randomDigits}`);

            // กรอกจำนวนเงิน
            await purchasingAmountInput.fill('1000000');
            
            // 💡 1.4 เลือกระบุสกุลเงินเป็น USD โดยมีท่าสำรอง 4 แบบเผื่อ UI ของ Ant Design เปลี่ยนแปลง
            console.log('      💲 กำลังเลือกสกุลเงินเป็น USD...');
            try {
                const currencySelect = this.page.locator('.ant-form-item').filter({ hasText: /Currency|สกุลเงิน/i }).locator('.ant-select-selector')
                    .or(this.page.locator('#currency').locator('.ant-select-selector'))
                    .or(this.page.locator('.ant-input-group-addon .ant-select-selector'))
                    .or(this.page.locator('.ant-select-selector').filter({ hasText: /THB/i }))
                    .first();
                await currencySelect.waitFor({ state: 'attached', timeout: 5000 });
                await currencySelect.scrollIntoViewIfNeeded();
                await currencySelect.click({ force: true });
                
                const visibleDropdown = this.page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
                await visibleDropdown.waitFor({ state: 'visible', timeout: 5000 });

                const usdOption = visibleDropdown.locator('.ant-select-item-option').filter({ hasText: 'USD' }).first();
                await usdOption.scrollIntoViewIfNeeded();
                await usdOption.click();
            } catch (err) {
                // ท่าสำรอง: ใช้การพิมพ์คำว่า USD ลงในช่องค้นหาแล้วกด Enter
                try {
                    const currencyInput = this.page.locator('input#currency')
                        .or(this.page.locator('.ant-input-group-addon input.ant-select-selection-search-input'))
                        .or(this.page.locator('.ant-form-item').filter({ hasText: /Currency|สกุลเงิน/i }).locator('input[type="search"]'))
                        .first();
                    await currencyInput.fill('USD');
                    await this.page.waitForTimeout(500);
                    await this.page.keyboard.press('Enter');
                } catch (backupErr) {
                    console.log(`      ❌ เกิดข้อผิดพลาดในการคลิกเลือกสกุลเงิน: ${backupErr.message}`);
                }
            }

            // 💡 1.5 เตรียมข้อมูลวันที่: Issue Date (วันปัจจุบัน) และ Maturity Date (บวกไป 5 ปี)
            const today = new Date();
            const dd = String(today.getDate()).padStart(2, '0');
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const yyyy = today.getFullYear();

            const issueDateValue = `${dd}/${mm}/${yyyy}`;
            const maturityDateValue = `${dd}/${mm}/${yyyy + 5}`;

            // กรอก Issue Date (ใช้เทคนิค Ctrl+A -> Backspace ลบค่าเก่าเพื่อแก้บั๊ก DatePicker ของ React)
            console.log(`      📅 [1.5] กำลังกรอก Issue Date: ${issueDateValue}`);
            try {
                const issueDateInput = this.page.locator('#issue_date').or(this.page.locator('.ant-form-item').filter({ hasText: /Issue Date/i }).locator('input')).first();
                await issueDateInput.waitFor({ state: 'attached', timeout: 5000 });
                await issueDateInput.scrollIntoViewIfNeeded();
                await issueDateInput.click({ force: true });
                await this.page.waitForTimeout(500); 
                
                await issueDateInput.press('Control+A');
                await issueDateInput.press('Backspace');
                await issueDateInput.pressSequentially(issueDateValue, { delay: 100 });
                await this.page.waitForTimeout(500);
                await issueDateInput.press('Enter');
                await this.page.keyboard.press('Escape');
            } catch (err) {}

            // กรอก Maturity Date
            console.log(`      📅 [1.6] กำลังกรอก Maturity Date (+5 ปี): ${maturityDateValue}`);
            try {
                const maturityDateInput = this.page.locator('#maturity_date').or(this.page.locator('.ant-form-item').filter({ hasText: /Maturity Date/i }).locator('input')).first();
                await maturityDateInput.waitFor({ state: 'attached', timeout: 5000 });
                await maturityDateInput.scrollIntoViewIfNeeded();
                await maturityDateInput.click({ force: true });
                await this.page.waitForTimeout(500);
                
                await maturityDateInput.press('Control+A');
                await maturityDateInput.press('Backspace');
                await maturityDateInput.pressSequentially(maturityDateValue, { delay: 100 });
                await this.page.waitForTimeout(500);
                await maturityDateInput.press('Enter');
                await this.page.keyboard.press('Escape');
            } catch (err) {}

        } catch (error) {
            // หากเกิด Error ร้ายแรงในหัวข้อที่ 1 ให้โยน Error กลับไปให้ตัว Runner รับทราบเพื่อปรับสถานะเป็น FAIL
            throw error; 
        }

        // 💡 1.6 อัปโหลดเอกสารสำหรับหัวข้อที่ 1 (ค้นหาปุ่มจากไอคอน file-add)
        console.log('   📤 กำลังอัปโหลดไฟล์เอกสาร (ข้อ 1)...');
        const filePath = path.join(__dirname, '../data/uploads/file/Screenshot 2026-04-22 165119.png');
        try {
            // ใช้ท่าหลัก: หาปุ่มที่มี class .ant-upload
            const fileInput = this.page.locator('.ant-upload').filter({ has: this.page.locator('[data-icon="file-add"]') }).locator('input[type="file"]');
            await fileInput.waitFor({ state: 'attached', timeout: 5000 });
            await fileInput.setInputFiles(filePath);
            await this.page.waitForTimeout(3000); 
        } catch (error) {
            // ท่าสำรอง: หา input ประเภทไฟล์อันแรกสุดของหน้าจอ
            try {
                const backupFileInput = this.page.locator('input[type="file"]').first();
                await backupFileInput.setInputFiles(filePath);
                await this.page.waitForTimeout(3000);
            } catch (innerError) {
                console.error(`      ❌ อัปโหลดไฟล์เอกสาร (ข้อ 1) ท่าสำรองล้มเหลว: ${innerError.message}`);
            }
        } 

        // =========================================================
        // ส่วนที่ 2: Types of assets which the applicant has possessed (Deposit)
        // =========================================================
        console.log('   💰 [หัวข้อ 2] เริ่มจัดการ Deposit Assets...');
        try {
            // 💡 2.1 ติ๊ก Checkbox เลือก Deposit
            const depositLabel = this.page.locator('label').filter({ hasText: /^Deposit$/i }).first();
            await depositLabel.waitFor({ state: 'visible', timeout: 5000 });
            await depositLabel.click({ force: true });

            const countryDropdown = this.page.locator('#country_code');
            const bankNameInput = this.page.locator('#bank_name');
            const accountNumInput = this.page.locator('#account_number');
            const investmentAmountInput = this.page.locator('#investment_value_amount');

            await countryDropdown.waitFor({ state: 'attached', timeout: 5000 });

            // 💡 2.2 ดึงข้อมูลประเทศจาก OCR (Step 1) ถ้าไม่มีใช้ Canada และสุ่มเลขบัญชี 4 หลัก
            const ocrCountry = this.generatedData?.country || 'Canada'; 
            const bankNameValue = `${ocrCountry} Bank`;
            const randomAccountNumber = String(Math.floor(1000 + Math.random() * 9000)); 

            // 💡 2.3 เลือกประเทศใน Dropdown
            console.log(`      🌍 กำลังเลือกประเทศ: ${ocrCountry}...`);
            await countryDropdown.click({ force: true });
            await this.page.waitForTimeout(500);
            
            try {
                // ท่าหลัก: พิมพ์ชื่อประเทศค้นหาเพื่อแก้ปัญหา Virtual Scrolling ของ Ant Design
                const countrySearchInput = countryDropdown.locator('input').first().or(this.page.locator('input#country_code'));
                await countrySearchInput.fill(ocrCountry);
                await this.page.waitForTimeout(1000);
                await this.page.keyboard.press('Enter');
            } catch (error) {
                const visibleCountryDropdown = this.page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
                await visibleCountryDropdown.waitFor({ state: 'visible', timeout: 5000 });
                const countryOption = visibleCountryDropdown.locator('.ant-select-item-option').filter({ hasText: ocrCountry }).first();
                await countryOption.scrollIntoViewIfNeeded();
                await countryOption.click();
            }

            // กรอกชื่อธนาคาร บัญชี และจำนวนเงิน
            await bankNameInput.fill(bankNameValue);
            await accountNumInput.fill(randomAccountNumber);
            await investmentAmountInput.fill('2000');
            
            // 💡 2.4 เลือกระบุสกุลเงินเป็น USD (ถ้ามีช่องให้เลือก)
            try {
                const depositAmountFormItem = this.page.locator('.ant-form-item').filter({ has: this.page.locator('#investment_value_amount') });
                const depositCurrencySelect = depositAmountFormItem.locator('.ant-select-selector').first();
                
                // ให้เวลารอแค่ 3 วิ เพื่อป้องกันสคริปต์ค้างในกรณีที่หน้าเว็บไม่มีช่องให้เลือกสกุลเงินสำหรับหัวข้อนี้
                await depositCurrencySelect.waitFor({ state: 'attached', timeout: 3000 });
                await depositCurrencySelect.click({ force: true, timeout: 3000 });
                
                const visibleDepCurrencyDropdown = this.page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
                await visibleDepCurrencyDropdown.waitFor({ state: 'visible', timeout: 3000 });
                
                const usdDepOption = visibleDepCurrencyDropdown.locator('.ant-select-item-option').filter({ hasText: 'USD' }).first();
                await usdDepOption.click({ timeout: 3000 });
            } catch (currencyErr) {}

            // 💡 2.5 อัปโหลดเอกสารสำหรับหัวข้อที่ 2
            console.log('   📤 กำลังอัปโหลดไฟล์เอกสาร (ข้อ 2)...');
            try {
                // ใช้ .last() เพื่อบังคับให้อัปโหลดใส่กล่องที่อยู่ล่างสุด (กล่องของหัวข้อ Deposit) ไม่ให้ไปทับกล่องของหัวข้อ Bonds
                const fileInput = this.page.locator('.ant-upload').filter({ has: this.page.locator('[data-icon="file-add"]') }).locator('input[type="file"]').last();
                await fileInput.waitFor({ state: 'attached', timeout: 5000 });
                await fileInput.setInputFiles(filePath);
                await this.page.waitForTimeout(3000); 
            } catch (error) {
                try {
                    const backupFileInput = this.page.locator('input[type="file"]').last();
                    await backupFileInput.setInputFiles(filePath);
                    await this.page.waitForTimeout(3000);
                } catch (innerError) {
                    console.error(`      ❌ อัปโหลดไฟล์เอกสาร (ข้อ 2) ท่าสำรองล้มเหลว: ${innerError.message}`);
                }
            }

            // 2.6 กดปุ่ม Continue เพื่อไปหน้าต่อไป (Step 4: Health Insurance)
            try {
            console.log('   🔘 กำลังกดปุ่ม Continue เพื่อไปหน้า Health Insurance...');
            const submitBtn = this.page.locator('button[type="submit"]').first();
            await submitBtn.waitFor({ state: 'attached', timeout: 5000 });
            await submitBtn.scrollIntoViewIfNeeded();
            await submitBtn.click();
            
            // รอแท็บของ Step 4 โผล่ขึ้นมายืนยันว่าเปลี่ยนหน้าสำเร็จ
            const healthInsuranceTab = this.page.locator('.intro-health-insurance-tab');
            await healthInsuranceTab.waitFor({ state: 'visible', timeout: 15000 });
            console.log('      ✅ เปลี่ยนหน้าสำเร็จ! ตอนนี้อยู่บนแท็บ Health Insurance แล้ว');
        } catch (error) {
            console.log(`      ❌ เกิดข้อผิดพลาดตอนเปลี่ยนหน้า: ${error.message}`);
            // 💡 โยน Error ออกไปเพื่อหยุดไม่ให้ Step 4 ทำงานต่อทั้งที่ยังอยู่หน้าเดิม
            throw error; 
        }
        } catch (error) {
            // หากเกิด Error ร้ายแรงในหัวข้อที่ 2 ให้โยน Error กลับไปให้ตัว Runner รับทราบเพื่อปรับสถานะเป็น FAIL
            throw error; 
        }
        
           
    }
}
module.exports = WgcStep3_Income;