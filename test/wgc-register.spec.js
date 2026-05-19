// ไฟล์: test/wgc-register.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const { faker } = require('@faker-js/faker');

// 💡 ดึงหน้า WGC Form ที่เราแยกไฟล์ไว้ออกมาใช้งาน
const Qualification_wgc = require('../pages/Qualification_wgc'); 

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
            
            // 💡 ล็อคอีเมลไว้เพื่อทดสอบฟอร์มโดยเฉพาะ
            const genEmail = 'wgctest01_5bq@mailinator.com'; 
            const basePrefix = genEmail.split('@')[0];
            const uniqueId = 'form_testing';

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

                await page.waitForURL(/.*welcome/, { timeout: 20000 });
                
                // เข้าสู่หน้า WGC Application
                await page.getByText('Wealthy Global Citizen', { exact: true }).click();
                const applyBtn = page.getByRole('button', { name: /Apply Application/i });
                await applyBtn.waitFor({ state: 'visible', timeout: 5000 });
                await applyBtn.click();

                await page.waitForURL(/.*application.*/, { timeout: 15000 });
                console.log('🚀 เข้าสู่หน้า Application Form สำเร็จ!');

                // ==========================================================
                // 💡 เรียกใช้ Class WgcFormPage ที่เราแยกไฟล์ไว้
                // ==========================================================
                const wgcForm = new Qualification_wgc(page);

                // ระบุชื่อไฟล์รูป Passport ที่อยู่ในโฟลเดอร์ data/uploads/passport/
                await wgcForm.uploadPassportStep1('Passport-2.png');
                // ==========================================================
                
                // 💡 เรียกใช้ฟังก์ชัน Step 2 (บอทจะอ่านเพศจากหน้าจออัตโนมัติแล้วเลือกคำนำหน้าให้)
                await wgcForm.fillPersonalInformationStep2();

                // ให้หน้าจอค้างไว้ให้เราดูผลงาน
                await page.waitForTimeout(50000); 

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

        break; // รันรอบเดียว
    }
});