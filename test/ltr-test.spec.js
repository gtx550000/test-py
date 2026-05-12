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
}

// ======================================================
// READ CSV
// ======================================================
const records = parse(
    fs.readFileSync('./data/TT - ชีต.csv'),
    {
        columns: true,
        skip_empty_lines: true
    }
);

// ======================================================
// TEST
// ======================================================
test.describe('LTR Visa Semi-Auto Flow', () => {

    for (const record of records) {

        if (record.Subject !== 'Register') continue;

        test(`Register: ${record.Email}`, async ({ page, context }) => {

            // ปิด timeout เพราะรอ CAPTCHA
            test.setTimeout(0);

            const uniqueId = Date.now();

            const prefix = record.Email.split('@')[0];

            const genEmail =
                `${prefix}_${uniqueId}@mailinator.com`;

            const genFirstName =
                `${record.Firstname}_${uniqueId}`;

            const genLastName =
                `${record.Lastname || 'bb'}_${uniqueId}`;

            const password = 'P@ssw0rd';

            try {

                // ======================================================
                // OPEN WEBSITE
                // ======================================================
                console.log('\n🌐 Opening website...');

                await page.goto(
                    'https://dev.bedrockltr.com/login',
                    {
                        waitUntil: 'domcontentloaded'
                    }
                );

                await page.getByRole('button', {
                    name: 'Register'
                }).click();

                // ======================================================
                // FILL REGISTER FORM
                // ======================================================
                console.log('📝 Filling register form...');

                await page.locator('#email').fill(genEmail);

                await page.locator('#password')
                    .fill(password);

                await page.locator('#firstName')
                    .fill(genFirstName);

                await page.locator('#lastName')
                    .fill(genLastName);

                // ======================================================
                // WAIT HUMAN CAPTCHA
                // ======================================================
                console.log('\n================================================');
                console.log(`📢 กรุณาแก้ CAPTCHA และกด Submit`);
                console.log(`📧 EMAIL: ${genEmail}`);
                console.log('================================================\n');

                // รอข้อความหลัง submit สำเร็จ
                await expect(
                    page.getByText(/check your email/i)
                ).toBeVisible({
                    timeout: 120000
                });

                console.log('✅ Register success');

                // ======================================================
                // OPEN MAILINATOR
                // ======================================================
                console.log('📬 Opening Mailinator...');

                const mailPage = await context.newPage();

                await mailPage.goto(
                    `https://www.mailinator.com/v4/public/inboxes.jsp?to=${prefix}_${uniqueId}`,
                    {
                        waitUntil: 'domcontentloaded'
                    }
                );

                // ======================================================
                // WAIT EMAIL
                // ======================================================
                console.log('⏳ Waiting for email...');

                let emailFound = false;

                const maxRetry = 12;

                for (let i = 0; i < maxRetry; i++) {

                    await mailPage.waitForLoadState('networkidle');

                    // selector ของ row email
                    const rows = mailPage.locator('tr');

                    const count = await rows.count();

                    console.log(
                        `🔍 Attempt ${i + 1}/${maxRetry} -> Found ${count} rows`
                    );

                    if (count > 0) {
                        emailFound = true;
                        break;
                    }

                    await mailPage.waitForTimeout(5000);

                    await mailPage.reload();
                }

                if (!emailFound) {
                    throw new Error(
                        '❌ Email not received within timeout'
                    );
                }

                // ======================================================
                // OPEN EMAIL
                // ======================================================
                console.log('📨 Opening email...');

                const emailRow =
                    mailPage.locator('tr').first();

                await emailRow.waitFor({
                    state: 'visible',
                    timeout: 60000
                });

                await emailRow.click();

                // ======================================================
                // WAIT EMAIL BODY
                // ======================================================
                console.log('📄 Waiting email body...');

                const emailFrame =
                    mailPage.frameLocator('#html_msg_body');

                const verifyLink =
                    emailFrame.locator(
                        'a[href*="verify-email"]'
                    );

                await verifyLink.waitFor({
                    state: 'visible',
                    timeout: 60000
                });

                // ======================================================
                // CLICK VERIFY LINK
                // ======================================================
                console.log('🔗 Clicking verify link...');

                const [verifyPage] = await Promise.all([
                    context.waitForEvent('page'),
                    verifyLink.click()
                ]);

                // ======================================================
                // WAIT WELCOME PAGE
                // ======================================================
                console.log('⏳ Waiting welcome page...');

                await verifyPage.waitForLoadState(
                    'domcontentloaded'
                );

                await verifyPage.waitForURL(
                    '**/welcome',
                    {
                        timeout: 60000
                    }
                );

                console.log('🎉 Welcome page reached!');

                // ======================================================
                // SAVE PASS RESULT
                // ======================================================
                await saveToExcel({
                    oldEmail: record.Email,
                    newEmail: genEmail,
                    status: 'Reached Welcome Page',
                    result: 'PASS'
                });

                console.log(
                    `📝 Saved PASS result for ${genEmail}`
                );

                await mailPage.close();

            } catch (error) {

                console.error('\n❌ TEST FAILED');
                console.error(error);

                // ======================================================
                // SCREENSHOT FAIL
                // ======================================================
                const screenshotName =
                    `error_${Date.now()}.png`;

                await page.screenshot({
                    path: screenshotName,
                    fullPage: true
                });

                console.log(
                    `📸 Screenshot saved: ${screenshotName}`
                );

                // ======================================================
                // SAVE FAIL RESULT
                // ======================================================
                await saveToExcel({
                    oldEmail: record.Email,
                    newEmail: genEmail,
                    status: error.message,
                    result: 'FAIL'
                });

                throw error;
            }
        });
    }
});