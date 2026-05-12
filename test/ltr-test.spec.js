// test/ltr-test.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');

// ฟังก์ชันบันทึกผลลง Excel
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
                { header: 'Status', key: 'status', width: 30 },
                { header: 'Result', key: 'result', width: 15 }
            ];
        }
        sheet.addRow({
            timestamp: new Date().toLocaleString(),
            newEmail: dataRow.newEmail,
            status: dataRow.status,
            result: dataRow.result
        });
        await workbook.xlsx.writeFile(fileName);
    } catch (e) { console.log('Excel write error:', e.message); }
}

// อ่าน CSV ด้วย Option ที่ปลอดภัยที่สุด
const records = parse(fs.readFileSync('./data/TT - ชีต.csv'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true // ป้องกัน Error หากบางแถวมีคอลัมน์ไม่ครบ
});

test.describe('LTR Visa Semi-Auto Flow', () => {
    for (const record of records) {
        if (record.Subject !== 'Register') continue;

        test(`Register: ${record.Email}`, async ({ page, context }) => {
            test.setTimeout(0); // ปิด Timeout เพื่อรอแก้ CAPTCHA
            const uniqueId = Date.now();
            const prefix = record.Email.split('@')[0];
            const genEmail = `${prefix}_${uniqueId}@mailinator.com`;

            try {
                await page.goto('https://dev.bedrockltr.com/login');
                await page.getByRole('button', { name: 'Register' }).click();
                
                await page.locator('#email').fill(genEmail);
                await page.locator('#password').fill('P@ssw0rd');
                await page.locator('#firstName').fill(record.Firstname || 'Test');
                await page.locator('#lastName').fill(record.Lastname || 'User');

                console.log(`📢 กรุณาแก้ CAPTCHA สำหรับ: ${genEmail}`);

                // รอจนกว่าจะสมัครสำเร็จ
                await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 150000 });
                
                await saveToExcel({ newEmail: genEmail, status: 'Success', result: 'PASS' });
            } catch (error) {
                await saveToExcel({ newEmail: genEmail, status: error.message, result: 'FAIL' });
                throw error;
            }
        });
    }
});