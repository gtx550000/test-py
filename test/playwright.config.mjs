// tests/ltr-test.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');

// ======================================================
// SAVE RESULT TO EXCEL
// ======================================================
async function saveToExcel(dataRow) {
    const fileName = 'Test_Report_LTR.xlsx';
    const workbook = new ExcelJS.Workbook();
    let sheet;

    // ล็อคคิวการเขียนไฟล์เบื้องต้นด้วยการตรวจสอบไฟล์
    try {
        if (fs.existsSync(fileName)) {
            await workbook.xlsx.readFile(fileName);
            sheet = workbook.getWorksheet('Results');
        } else {
            sheet = workbook.addWorksheet('Results');
            sheet.columns = [
                { header: 'Timestamp', key: 'timestamp', width: 25 },
                { header: 'Original Email', key: 'oldEmail', width: 35 },
                { header: 'Generated Email', key: 'newEmail', width: 40 },
                { header: 'Status', key: 'status', width: 30 },
                { header: 'Result', key: 'result', width: 15 }
            ];
            sheet.getRow(1).font = { bold: true };
        }

        sheet.addRow({
            timestamp: new Date().toLocaleString(),
            oldEmail: dataRow.oldEmail,
            newEmail: dataRow.newEmail,
            status: dataRow.status,
            result: dataRow.result
        });

        await workbook.xlsx.writeFile(fileName);
    } catch (err) {
        console.error('⚠️ ไม่สามารถบันทึก Excel ได้ (อาจเพราะเปิดไฟล์ค้างไว้):', err.message);
    }
}

// ======================================================
// READ CSV
// ======================================================
const records = parse(fs.readFileSync('./data/TT - ชีต.csv'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true 
});

// ======================================================
// TEST
// ======================================================
test.describe('LTR Visa Semi-Auto Flow', () => {

    for (const record of records) {
        // กรองเฉพาะเคส Register และต้องมี Email
        if (!record.Email || record.Subject !== 'Register') continue;

        test(`Register: ${record.Email}`, async ({ page, context }) => {
            test.setTimeout(0); // รอ CAPTCHA นานแค่ไหนก็ได้

            const uniqueId = Date.now();
            const prefix = record.Email.split('@')[0];
            const genEmail = `${prefix}_${uniqueId}@mailinator.com`;
            const genFirstName = `${record.Firstname}_${uniqueId}`;
            const genLastName = `${record.Lastname || 'bb'}_${uniqueId}`;
            const password = 'P@ssw0rd';

            try {
                console.log(`\n🚀 Starting test for: ${genEmail}`);

                // 1. หน้าลงทะเบียน
                await page.goto('https://dev.bedrockltr.com/login', { waitUntil: 'networkidle' });
                await page.getByRole('button', { name: 'Register' }).click();

                await page.locator('#email').fill(genEmail);
                await page.locator('#password').fill(password);
                await page.locator('#firstName').fill(genFirstName);
                await page.locator('#lastName').fill(genLastName);

                console.log('📢 [ACTION REQUIRED]: แก้ CAPTCHA และกด Submit ในหน้าเบราว์เซอร์');

                // รอจนกว่าจะสมัครสำเร็จ (เช็คจากข้อความแจ้งเตือน)
                await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 150000 });
                console.log('✅ Register form submitted');

                // 2. ไปที่ Mailinator
                const mailPage = await context.newPage();
                await mailPage.goto(`https://www.mailinator.com/v4/public/inboxes.jsp?to=${prefix}_${uniqueId}`);

                // รออีเมลเข้าด้วยระบบ Retry
                let emailFound = false;
                for (let i = 0; i < 15; i++) {
                    await mailPage.reload();
                    // เจาะจงแถวใน inbox table
                    const rows = mailPage.locator('#reallogs tr'); 
                    if (await rows.count() > 0) {
                        emailFound = true;
                        break;
                    }
                    await mailPage.waitForTimeout(5000);
                }

                if (!emailFound) throw new Error('❌ หาอีเมลไม่เจอใน Mailinator');

                // 3. เปิดเมลและยืนยัน
                await mailPage.locator('#reallogs tr').first().click();
                const emailFrame = mailPage.frameLocator('#html_msg_body');
                const verifyLink = emailFrame.locator('a[href*="verify-email"]');
                
                await verifyLink.waitFor({ state: 'visible', timeout: 30000 });
                
                const [verifyPage] = await Promise.all([
                    context.waitForEvent('page'),
                    verifyLink.click()
                ]);

                // 4. ตรวจสอบหน้า Welcome
                await verifyPage.waitForURL('**/welcome', { timeout: 60000 });
                console.log('🎊 REACHED WELCOME PAGE!');

                await saveToExcel({
                    oldEmail: record.Email,
                    newEmail: genEmail,
                    status: 'Success',
                    result: 'PASS'
                });

                await mailPage.close();
                await verifyPage.close();

            } catch (error) {
                console.error(`❌ เคส ${genEmail} พัง:`, error.message);
                
                const screenshotName = `error_${prefix}_${uniqueId}.png`;
                await page.screenshot({ path: screenshotName, fullPage: true });

                await saveToExcel({
                    oldEmail: record.Email,
                    newEmail: genEmail,
                    status: error.message,
                    result: 'FAIL'
                });
                
                throw error; // เพื่อให้ Playwright สรุปผลเป็น Fail
            }
        });
    }
});