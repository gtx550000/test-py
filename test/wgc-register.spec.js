// ไฟล์: test/wgc-register.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const { faker } = require('@faker-js/faker');

// 💡 นำเข้าคลาสที่แยกเป็น 3 ขั้นตอน (ปรับ Path ให้ชี้ไปที่ pages/ ตรงๆ)
const WgcStep1_OCR = require('../pages_wgc/WgcStep1_OCR');
const WgcStep2_PersonalInfo = require('../pages_wgc/WgcStep2_PersonalInfo');
const WgcStep3_Income = require('../pages_wgc/WgcStep3_Income');
const WgcStep4_Health_Insurance = require('../pages_wgc/WgcStep4_Health_Insurance'); 
const WgcStep5_Review = require('../pages_wgc/WgcStep5_Review');

// ... (ฟังก์ชัน saveToExcel เหมือนเดิม) ...
async function saveToExcel(dataRow, visaType) {
    const dirPath = `./data/${visaType}`;
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    const fileName = `${dirPath}/Test_Report_${visaType}.xlsx`;
    const workbook = new ExcelJS.Workbook();
    let sheet;
    try {
        if (fs.existsSync(fileName)) {
            await workbook.xlsx.readFile(fileName);
            sheet = workbook.getWorksheet('Results');
        } else {
            sheet = workbook.addWorksheet('Results');
            sheet.columns = [
                { header: 'Timestamp', key: 'timestamp', width: 25 },
                { header: 'Generated Email', key: 'newEmail', width: 40 },
                { header: 'First Name', key: 'newFirstName', width: 20 },
                { header: 'Last Name', key: 'newLastName', width: 20 },
                { header: 'Status', key: 'status', width: 30 },
                { header: 'Result', key: 'result', width: 15 }
            ];
        }
        sheet.addRow({
            timestamp: new Date().toLocaleString('en-GB'),
            newEmail: dataRow.newEmail,
            newFirstName: dataRow.newFirstName,
            newLastName: dataRow.newLastName,
            status: dataRow.status,
            result: dataRow.result
        });
        await workbook.xlsx.writeFile(fileName);
    } catch (e) { console.log('Excel write error:', e.message); }
}

const records = parse(fs.readFileSync('./data/TT - ชีต.csv'), {
    columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true 
});

test.describe('WGC Visa Flow', () => {
    
    for (const record of records) {
        const rowVisa = (record.VisaType || 'LTR').toUpperCase();

        if (rowVisa !== 'WGC') continue; 
        if (!record.Email || record.Email.trim() === "" || record.Subject !== 'Register') continue;

        test(`Register & Create Profile [WGC]: ${record.Email}`, async ({ page }) => {
            test.setTimeout(0); 
            
            // ==========================================================
            // 💡 ดึงอีเมลและสร้างรหัสอ้างอิงจากไฟล์ CSV แบบไดนามิก
            // ==========================================================
             const genEmail = 'wgctest01_5bq@mailinator.com'; // (คอมเมนต์แบบล็อกอีเมลไว้)
            //const genEmail = record.Email; 
            const basePrefix = genEmail.split('@')[0].replace(/[0-9]/g, '');
            const uniqueId = Math.random().toString(36).substring(2, 7);

            const randomFirstName = faker.person.firstName();
            const randomLastName = faker.person.lastName();

            let isPassed = false;
            let errorMessage = '';

            try {
                console.log(`\n🚀 เริ่มทดสอบการกรอกฟอร์ม WGC: ${genEmail}`);
                await page.goto('https://dev.bedrockltr.com/login', { waitUntil: 'networkidle' });

                // -------------------------------------------------------------
                // ล็อกอินเข้าระบบด้วยไอดีที่มีอยู่แล้ว
                // -------------------------------------------------------------
                console.log(`🔐 กำลังเข้าสู่ระบบ: ${genEmail}`);
                await page.locator('#email').fill(genEmail);
                await page.locator('#password').fill('P@ssw0rd'); 
                await page.getByRole('button', { name: /login/i }).first().click();
                // 💡 ลองรอให้ URL เปลี่ยน หรือไม่ก็รอให้ Popup Error เด้งขึ้นมา
                try {
                    await page.waitForURL(/.*welcome/, { timeout: 15000 });
                } catch (timeoutError) {
                    // ถ้า Timeout ให้เช็คก่อนว่าเว็บด่าว่ารหัสผิดหรือเปล่า
                    const loginFailedMsg = page.getByText('Invalid email or password');
                    if (await loginFailedMsg.isVisible()) {
                        throw new Error('ล็อกอินไม่สำเร็จ: อีเมลหรือรหัสผ่านไม่ถูกต้อง (กรุณาเช็คฐานข้อมูลอีกครั้ง)');
                    }
                    // ถ้าไม่ใช่เรื่องรหัสผิด ก็โยน Error ทิ้งไปตามปกติ
                    throw timeoutError; 
                }

                // เข้าสู่หน้า WGC Application
                await page.getByText('Wealthy Global Citizen', { exact: true }).click();
                const applyBtn = page.getByRole('button', { name: /Apply Application/i });
                await applyBtn.waitFor({ state: 'visible', timeout: 5000 });
                await applyBtn.click();

                await page.waitForURL(/.*application.*/, { timeout: 15000 });
                console.log('🚀 เข้าสู่หน้า Application Form สำเร็จ!');

                // ==========================================================
                // 💡 เรียกใช้งาน Step 1: อัปโหลด Passport และสุ่มข้อมูล
                // ==========================================================
                const step1 = new WgcStep1_OCR(page);
                const generatedData = await step1.uploadPassportStep1('Passport-2.png');
                
                // ==========================================================
                // 💡 เรียกใช้งาน Step 2: กรอกข้อมูลส่วนตัว (ส่ง generatedData ไปด้วย)
                // ==========================================================
                const step2 = new WgcStep2_PersonalInfo(page, generatedData);
                await step2.fillPersonalInformationStep2();

                // ==========================================================
                // 💡 เรียกใช้งาน Step 3: กรอกรายได้และสินทรัพย์
                // ==========================================================
                const step3 = new WgcStep3_Income(page, generatedData);
                await step3.fillIncomeAndAssetsStep3();

                // ==========================================================
                // 💡 เรียกใช้งาน Step 4: Health Insurance
                // ==========================================================
                // 💡 ต้องพิมพ์ให้ตรงกับตัวแปรที่ require มาด้านบน
                const step4 = new WgcStep4_Health_Insurance(page, generatedData); 
                await step4.fillHealthInsuranceStep4();

                // ==========================================================
                // 💡 เรียกใช้งาน Step 5: Review and Submit
                // ==========================================================
                const step5 = new WgcStep5_Review(page, generatedData);
                await step5.fillReviewStep5();
                await page.waitForTimeout(5000); // รอ 5 วินาทีหลัง Submit เพื่อดูผล

                isPassed = true; 

            } catch (error) {
                errorMessage = error.message;
                console.error(`❌ ข้อผิดพลาด: ${errorMessage}`);
                throw error;
            } finally {
                const dirPath = `data/WGC`;
                if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

                const result = {
                    testName: `Register [WGC]: ${record.Email}`,
                    email: genEmail,
                    visaType: 'WGC',
                    firstName: randomFirstName,
                    lastName: randomLastName,
                    status: isPassed ? 'Success' : errorMessage,
                    result: isPassed ? 'PASS' : 'FAIL',
                    timestamp: new Date().toLocaleString('en-GB')
                };

                const baseFileName = `${dirPath}/TestResult_${basePrefix}_${uniqueId}`;
                fs.writeFileSync(`${baseFileName}.json`, JSON.stringify(result, null, 2), 'utf-8');

                await saveToExcel({ 
                    newEmail: genEmail, newFirstName: randomFirstName, newLastName: randomLastName,
                    status: result.status, result: result.result 
                }, 'WGC'); 
            }
        });

        // ปลดล็อก break; ออก เพื่อให้ลูปทำงานกับทุก Record ใน CSV
        // break; 
    }
});