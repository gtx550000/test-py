// test/ltr-test.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');

async function saveToExcel(dataRow) {
    const fileName = 'Test_Report_LTR.xlsx';
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
            timestamp: new Date().toLocaleString(),
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
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true 
});

test.describe('LTR Visa Semi-Auto Flow', () => {
    for (const record of records) {
        if (!record.Email || record.Email.trim() === "" || record.Subject !== 'Register') {
            continue;
        }

        test(`Register: ${record.Email}`, async ({ page }) => {
            test.setTimeout(0); 
            const uniqueId = Date.now();
            const prefix = record.Email.split('@')[0];
            const genEmail = `${prefix}_${uniqueId}@mailinator.com`;

            let isPassed = false;
            let errorMessage = '';

            try {
                console.log(`\n🚀 เริ่มทดสอบ: ${genEmail}`);
                await page.goto('https://dev.bedrockltr.com/login', { waitUntil: 'networkidle' });

                // 1. ไปหน้าสมัครสมาชิก
                const navRegisterBtn = page.getByText('Register', { exact: true }).first();
                await navRegisterBtn.waitFor({ state: 'visible', timeout: 10000 });
                await navRegisterBtn.evaluate(el => el.click());

                await page.waitForSelector('#firstName', { state: 'visible', timeout: 15000 });

                // 2. กรอกข้อมูล
                await page.locator('#email').fill(genEmail);
                await page.locator('#password').fill('P@ssw0rd');
                await page.locator('#firstName').fill(record.Firstname || 'Tes');
                await page.locator('#lastName').fill(record.Lastname || 'User');

                // 3. รอ CAPTCHA และกดปุ่ม Register (id="register-button")
                console.log(`📢 กรุณาแก้ CAPTCHA สำหรับ: ${genEmail}`);
                const submitBtn = page.locator('#register-button');
                
                // รอจนกว่าปุ่มจะ Enabled (หลังจากแก้ CAPTCHA เสร็จ)
                await expect(submitBtn).toBeEnabled({ timeout: 150000 });
                console.log('🔘 CAPTCHA เรียบร้อย! กำลังกดปุ่ม Register...');
                await submitBtn.click();

                // 4. *** จัดการ Popup หลังสมัครสำเร็จ ***
                console.log('⏳ รอ Success Popup ปรากฏ...');
                await expect(page.getByText(/thanks for signing up/i)).toBeVisible({ timeout: 30000 });
                
                // ให้เวลาเว็บโหลด Modal ให้นิ่งที่สุด
                await page.waitForTimeout(2000); 
                
                // 5. ค้นหาปุ่ม "Back to Login"
                console.log('🔘 กำลังค้นหาปุ่มใน Modal...');
                const dialog = page.locator('dialog, [role="dialog"]').last();
                const backToLoginBtn = dialog.getByRole('button', { name: /back to login/i });

                // รอจนกว่าปุ่มจะปรากฏ
                await expect(backToLoginBtn).toBeVisible({ timeout: 15000 });

                // 💡 ยิง Event Click ไปที่ปุ่ม
                console.log('🔘 กำลังยิง Event Click ไปที่ปุ่ม...');
                try {
                    await backToLoginBtn.dispatchEvent('click');
                } catch (err) {
                    console.log('⚠️ dispatchEvent ไม่สำเร็จ กำลังลองใช้วิธีที่ 2: คีย์บอร์ด...');
                    await backToLoginBtn.focus();
                    await page.keyboard.press('Enter');
                }

                // รอให้ Modal ปิดลง (เป็นการยืนยันว่ากดติดแล้ว)
                await expect(dialog).toBeHidden({ timeout: 10000 });

                // ยืนยันการกลับไปหน้า Login
                console.log('⏳ รอโหลดกลับไปหน้า Login...');
                await page.waitForURL(/.*login/, { timeout: 15000 });
                
                isPassed = true; 
                console.log('✅ สมัครสำเร็จและกลับไปหน้า Login เรียบร้อย');

                
                

            } catch (error) {
                errorMessage = error.message;
                throw error;
            } finally {
                // บันทึกผลลงทั้ง Excel และ JSON ในโฟลเดอร์ data
                const result = {
                    testName: `Register: ${record.Email}`,
                    email: genEmail,
                    status: isPassed ? 'Success' : errorMessage,
                    result: isPassed ? 'PASS' : 'FAIL',
                    timestamp: new Date().toISOString()
                };

                fs.mkdirSync('data', { recursive: true });
                const baseFileName = `data/TestResult_${prefix}_${uniqueId}`;
                fs.writeFileSync(`${baseFileName}.json`, JSON.stringify(result, null, 2), 'utf-8');

                await saveToExcel({ 
                    newEmail: genEmail, 
                    newFirstName: record.Firstname || 'Test',
                    newLastName: record.Lastname || 'User',
                    //status: isPassed ? 'Success' : errorMessage, 
                    result: isPassed ? 'PASS' : 'FAIL' 
                });
            }
        });
    }
});