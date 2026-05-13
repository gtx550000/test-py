// ไฟล์: test/wgc-register.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const { faker } = require('@faker-js/faker');

// ฟังก์ชันบันทึกผลลง Excel (แยกโฟลเดอร์ data/WGC อัตโนมัติ)
async function saveToExcel(dataRow, visaType) {
    const dirPath = `./data/${visaType}`;
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

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

// อ่านข้อมูลจากไฟล์ CSV
const records = parse(fs.readFileSync('./data/TT - ชีต.csv'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true 
});

// ตัวนับลำดับอีเมลสำหรับการรันแบบลูกครึ่ง
let emailCounter = 1;

test.describe('WGC Visa Flow', () => {
    
    for (const record of records) {
        const rowVisa = (record.VisaType || 'LTR').toUpperCase();

        // 💡 คัดกรอง: สนใจเฉพาะแถวที่เป็น WGC เท่านั้น แถวอื่นข้ามหมด
        if (rowVisa !== 'WGC') {
            continue; 
        }

        if (!record.Email || record.Email.trim() === "" || record.Subject !== 'Register') {
            continue;
        }

        test(`Register & Create Profile [WGC]: ${record.Email}`, async ({ page }) => {
            test.setTimeout(0); 
            
            // ==========================================================
            // 💡 1. ใส่เมลจริงที่คุณเคยสมัครและยืนยันตัวตนผ่านแล้วไว้ตรงนี้
            // ==========================================================
            const genEmail = 'wgctest01_5bq@mailinator.com'; 
            
            const basePrefix = genEmail.split('@')[0];
            const uniqueId = 'existing_user';

            const randomFirstName = faker.person.firstName();
            const randomLastName = faker.person.lastName();

            let isPassed = false;
            let errorMessage = '';

            try {
                console.log(`\n🚀 เริ่มทดสอบทางลัด (Login -> Welcome) สำหรับอีเมล: ${genEmail}`);
                await page.goto('https://dev.bedrockltr.com/login', { waitUntil: 'networkidle' });

                /* =============================================================
                   🔒 ปิดสเตป 1 ถึง 5 (สมัครสมาชิกใหม่) เอาไว้เพื่อเปิดโหมดทางลัด
                   =============================================================
                // -------------------------------------------------------------
                // สเตปที่ 1: ไปหน้าสมัครสมาชิก และ กรอกข้อมูล
                // -------------------------------------------------------------
                const navRegisterBtn = page.getByText('Register', { exact: true }).first();
                await navRegisterBtn.waitFor({ state: 'visible', timeout: 10000 });
                await navRegisterBtn.evaluate(el => el.click());

                await page.waitForSelector('#firstName', { state: 'visible', timeout: 15000 });

                await page.locator('#email').fill(genEmail);
                await page.locator('#password').fill('P@ssw0rd');
                await page.locator('#firstName').fill(randomFirstName);
                await page.locator('#lastName').fill(randomLastName);

                // -------------------------------------------------------------
                // สเตปที่ 2: รอ Tester แก้ CAPTCHA และกดปุ่ม Register
                // -------------------------------------------------------------
                console.log(`📢 [WGC] กรุณาแก้ CAPTCHA บนหน้าเบราว์เซอร์ สำหรับ: ${genEmail}`);
                const submitBtn = page.locator('#register-button');
                await expect(submitBtn).toBeEnabled({ timeout: 150000 });
                await submitBtn.click();

                // -------------------------------------------------------------
                // สเตปที่ 3: จัดการ Success Popup และคลิกกลับไปหน้า Login
                // -------------------------------------------------------------
                await expect(page.getByText(/thanks for signing up/i)).toBeVisible({ timeout: 30000 });
                await page.waitForTimeout(2000); 
                const backToLoginBtn = page.getByText(/back to login/i).first();
                await expect(backToLoginBtn).toBeVisible({ timeout: 15000 });
                await backToLoginBtn.click();

                // -------------------------------------------------------------
                // สเตปที่ 4: บุก Mailinator หน้าแรก เพื่อดึงอีเมลยืนยันตัวตน
                // -------------------------------------------------------------
                const mailinatorPage = await page.context().newPage();
                await mailinatorPage.addInitScript(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                });
                await mailinatorPage.goto('https://www.mailinator.com/', { waitUntil: 'domcontentloaded' });
                const searchInput = mailinatorPage.locator('input[placeholder*="Search"], #search, #search-mobile').first();
                await searchInput.waitFor({ state: 'visible', timeout: 120000 });
                const inboxName = genEmail.split('@')[0];
                await searchInput.fill(inboxName);
                await searchInput.press('Enter');

                const emailRow = mailinatorPage.locator('table tbody tr').filter({ hasText: /verify|register|LTR/i }).first();
                await emailRow.waitFor({ state: 'visible', timeout: 30000 });
                await emailRow.click();

                let verifyUrl = '';
                await expect(async () => {
                    const emailFrame = mailinatorPage.frameLocator('#html_msg_body');
                    const verifyBtn = emailFrame.getByRole('link', { name: /verify/i }).first(); 
                    await expect(verifyBtn).toBeVisible({ timeout: 5000 });
                    verifyUrl = await verifyBtn.getAttribute('href');
                    expect(verifyUrl).toBeTruthy(); 
                }).toPass({ timeout: 60000 });
                await mailinatorPage.close(); 

                // -------------------------------------------------------------
                // สเตปที่ 5: เปิดลิงก์เปิดใช้งานอีเมล (หน้าคลิก Go to Login)
                // -------------------------------------------------------------
                await page.goto(verifyUrl, { waitUntil: 'networkidle' });
                const goToLoginBtn = page.getByRole('button', { name: /go to login/i }).first();
                await expect(goToLoginBtn).toBeVisible({ timeout: 15000 });
                await goToLoginBtn.click();
                =============================================================
                🔒 สิ้นสุดบล็อกปิดคอมเมนต์สเตปสมัครสมาชิก */

                // -------------------------------------------------------------
                // สเตปที่ 6: ล็อกอินเข้าระบบด้วยไอดีที่มีอยู่แล้ว (เอาบรรทัด waitForURL ที่เสี่ยงค้างออกแล้ว)
                // -------------------------------------------------------------
                console.log(`🔐 กำลังป้อนข้อมูลเข้าสู่ระบบด้วยไอดีเดิม: ${genEmail}`);
                await page.locator('#email').fill(genEmail);
                await page.locator('#password').fill('P@ssw0rd'); 

                const loginSubmitBtn = page.getByRole('button', { name: /login/i }).first();
                await loginSubmitBtn.click();

                // -------------------------------------------------------------
                // สเตปที่ 7: ยืนยันว่าถึงหน้า Welcome และ ลุยงานต่อเฉพาะของ WGC
                // -------------------------------------------------------------
                console.log('⏳ รอการเปลี่ยนหน้าเข้าสู่พื้นที่หน้า Welcome...');
                await page.waitForURL(/.*welcome/, { timeout: 20000 });
                await expect(page).toHaveURL(/.*welcome/);
                
                console.log('🎉 ยินดีด้วยครับ! เข้าสู่หน้า Welcome สำเร็จเรียบร้อย');

                // 1. คลิกเลือกประเภท "Wealthy Global Citizen"
                console.log('🔘 [WGC] กำลังเลือกประเภท: Wealthy Global Citizen...');
                const wgcCard = page.getByText('Wealthy Global Citizen', { exact: true });
                await wgcCard.waitFor({ state: 'visible', timeout: 15000 });
                await wgcCard.click();

                // 2. รอ Popup "Required Documents" ปรากฏขึ้นมา
                console.log('⏳ รอ Popup "Required Documents" แสดงผล...');
                const popupTitle = page.getByText(/Required Documents/i);
                await expect(popupTitle).toBeVisible({ timeout: 10000 });

                // 3. คลิกปุ่ม "Apply Application" ภายใน Popup
                console.log('🔘 [WGC] กำลังคลิกปุ่ม "Apply Application"...');
                const applyBtn = page.getByRole('button', { name: /Apply Application/i });
                await applyBtn.waitFor({ state: 'visible', timeout: 5000 });
                await applyBtn.click();

                // 4. ตรวจสอบว่าระบบพามารายังหน้ากรอกข้อมูล (Applications) สำเร็จ
                console.log('⏳ ตรวจสอบการเข้าสู่หน้า Application Form...');
                await page.waitForURL(/.*application.*/, { timeout: 15000 });
                
                const applicationHeader = page.locator('h1, h2').filter({ hasText: /Application/i }).first();
                await expect(applicationHeader).toBeVisible();

                console.log('🚀 ยอดเยี่ยม! ตอนนี้คุณอยู่ที่หน้ากรอกข้อมูล Applications ของ WGC แล้ว');

                await page.waitForTimeout(5000); 
                isPassed = true; 

            } catch (error) {
                errorMessage = error.message;
                console.error(`❌ ข้อผิดพลาดใน Flow WGC: ${errorMessage}`);
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
                    originalEmailFromCSV: record.Email,
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

        // 💡 ชี้เป้าความสำเร็จ: ใส่ break ตรงนี้เพื่อให้สร้างแค่ 1 เคสเทสต์ตอนพัฒนา ไม่วนลูปตาม CSV
        break; 
    }
});