// test/ltr-test.spec.js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
// 💡 1. เพิ่มการ Import Faker เข้ามาใช้งาน
const { faker } = require('@faker-js/faker');

// ปรับให้รับค่า visaType เพื่อแยกโฟลเดอร์และไฟล์ Excel
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

const records = parse(fs.readFileSync('./data/TT - ชีต.csv'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true 
});

// ประกาศตัวแปรนับเลขไว้นอกลูป (สำหรับ Auto-Increment)
let emailCounter = 1;

test.describe('LTR Visa Semi-Auto Flow', () => {
    const targetVisa = process.env.TARGET_VISA || 'ALL'; 
     
     for (const record of records) {
        // ดึงประเภท Visa ถ้าไม่มีให้เป็น LTR
        const rowVisa = (record.VisaType || 'LTR').toUpperCase();

        // ข้ามแถวที่ประเภท Visa ไม่ตรงกับที่เลือก
        if (targetVisa !== 'ALL' && rowVisa !== targetVisa) {
            continue; 
        }

        if (!record.Email || record.Email.trim() === "" || record.Subject !== 'Register') {
            continue;
        }

        test(`Register [${rowVisa}]: ${record.Email}`, async ({ page }) => {
            test.setTimeout(0); 
            
            // ==========================================================
            // สร้างอีเมลแบบลูกครึ่ง (Auto-Increment + Random 3 chars)
            // ==========================================================
            const paddedNum = String(emailCounter).padStart(2, '0');
            const basePrefix = record.Email.split('@')[0].replace(/[0-9]/g, ''); 
            const visaTypeStr = rowVisa.toLowerCase();
            const randomStr = Math.random().toString(36).substring(2, 5);
            const uniqueId = `${paddedNum}_${randomStr}`;

            const genEmail = `${visaTypeStr}${basePrefix}${uniqueId}@mailinator.com`;
            
            // บวก counter เพื่อเตรียมใช้กับแถวถัดไป
            emailCounter++;

            // 💡 2. สุ่มชื่อและนามสกุลด้วย Faker (ประกาศไว้ตรงนี้เพื่อให้บล็อก finally ดึงไปเซฟผลได้)
            const randomFirstName = faker.person.firstName();
            const randomLastName = faker.person.lastName();

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
                // 💡 3. เปลี่ยนมาเติมข้อมูลด้วยชื่อที่สุ่มจาก Faker
                await page.locator('#firstName').fill(randomFirstName);
                await page.locator('#lastName').fill(randomLastName);

                // 3. รอ CAPTCHA และกดปุ่ม Register (id="register-button")
                console.log(`📢 กรุณาแก้ CAPTCHA สำหรับ: ${genEmail}`);
                const submitBtn = page.locator('#register-button');
                
                await expect(submitBtn).toBeEnabled({ timeout: 150000 });
                console.log('🔘 CAPTCHA เรียบร้อย! กำลังกดปุ่ม Register...');
                await submitBtn.click();

                // 4. จัดการ Popup หลังสมัครสำเร็จ
                console.log('⏳ รอ Success Popup ปรากฏ...');
                await expect(page.getByText(/thanks for signing up/i)).toBeVisible({ timeout: 30000 });
                await page.waitForTimeout(2000); 
                
                // 5. ค้นหาปุ่ม "Back to Login"
                console.log('🔘 กำลังค้นหาปุ่มเพื่อกลับไปหน้า Login...');
                const backToLoginBtn = page.getByText(/back to login/i).first();

                // รอจนกว่าปุ่มจะโผล่มา
                await expect(backToLoginBtn).toBeVisible({ timeout: 15000 });

                console.log('🔘 เจอปุ่มแล้ว กำลังคลิก...');
                await backToLoginBtn.click();

                // รอให้เปลี่ยนหน้าไป URL ที่มีคำว่า login
                console.log('⏳ รอโหลดกลับไปหน้า Login...');
                await page.waitForURL(/.*login/, { timeout: 15000 });
                console.log('✅ สมัครสำเร็จและกลับไปหน้า Login เรียบร้อย');
                
                // 💡 ตั้งเป็น true ไว้ตรงนี้ชั่วคราว เพราะส่วน Mailinator ด้านล่างถูก Comment ปิดไว้
                isPassed = true; 
                
                // ==========================================================
                // 6. เข้า Mailinator ทางหน้าแรก (Homepage)
                // ==========================================================
                console.log(`\n📧 กำลังไปยังหน้าแรก https://www.mailinator.com/`);
                const mailinatorPage = await page.context().newPage();
                
                // ปิดป้ายสถานะ WebDriver เพื่อให้คลิกผ่าน Cloudflare ได้
                await mailinatorPage.addInitScript(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                });

                await mailinatorPage.goto('https://www.mailinator.com/', { waitUntil: 'domcontentloaded' });
                console.log('🚧 ตรวจสอบ Cloudflare... (หากติดหน้าติ๊กถูก กรุณากดด้วยตนเอง มีเวลารอ 2 นาที)');
                
                const searchInput = mailinatorPage.locator('input[placeholder*="Search"], #search, #search-mobile').first();
                await searchInput.waitFor({ state: 'visible', timeout: 120000 });
                console.log('✅ เข้าหน้าแรกสำเร็จ! กำลังกรอกอีเมลค้นหา...');

                // 7. พิมพ์ชื่อ Inbox แล้วกด Enter
                const inboxName = genEmail.split('@')[0];
                await searchInput.fill(inboxName);
                await searchInput.press('Enter');

                // ==========================================================
                // 8. รอรับอีเมลและดึงลิงก์ (ใช้ toPass)
                // ==========================================================
                console.log('⏳ รออีเมลยืนยันส่งเข้ามา...');
                const emailRow = mailinatorPage.locator('table tbody tr').filter({ hasText: /verify|register|LTR/i }).first();
                await emailRow.waitFor({ state: 'visible', timeout: 30000 });
                console.log('🔘 เจออีเมลแล้ว กำลังคลิกเปิดอ่าน...');
                await emailRow.click();

                console.log('🔍 กำลังดึงลิงก์ยืนยัน...');
                let verifyUrl = '';

                // ลองทำซ้ำจนกว่าจะหาปุ่มและดึงลิงก์สำเร็จ (สูงสุด 60 วินาที)
                await expect(async () => {
                    const emailFrame = mailinatorPage.frameLocator('#html_msg_body');
                    const verifyBtn = emailFrame.getByRole('link', { name: /verify/i }).first(); 
                    await expect(verifyBtn).toBeVisible({ timeout: 5000 });
                    verifyUrl = await verifyBtn.getAttribute('href');
                    expect(verifyUrl).toBeTruthy(); 
                }).toPass({ timeout: 60000 });

                console.log(`🔗 ได้ลิงก์ยืนยันแล้ว: ${verifyUrl}`);
                await mailinatorPage.close(); 

                // ==========================================================
                // 9. *** ขั้นตอนที่ 3: เปิดลิงก์ยืนยันและ Login เข้าสู่ระบบ ***
                // ==========================================================
                console.log('⏳ กำลังเปิดลิงก์ยืนยันในหน้าหลัก...');
                await page.goto(verifyUrl, { waitUntil: 'networkidle' });

                // ค้นหาปุ่ม "Go to Login" หลังจากหน้า Verify โหลดเสร็จ
                console.log('🔘 กำลังค้นหาปุ่ม "Go to Login"...');
                const goToLoginBtn = page.getByRole('button', { name: /go to login/i }).first();
                
                // รอให้ปุ่มปรากฏและคลิก
                await expect(goToLoginBtn).toBeVisible({ timeout: 15000 });
                await goToLoginBtn.click();

                // รอให้เปลี่ยนเส้นทางกลับมาหน้า Login
                console.log('⏳ รอโหลดหน้า Login...');
                await page.waitForURL(/.*login/, { timeout: 15000 });

                // กรอก Email และ Password ที่เราเพิ่งสมัครและ Verified ผ่าน
                console.log(`🔐 กำลัง Login ด้วย: ${genEmail}`);
                await page.locator('#email').fill(genEmail);
                await page.locator('#password').fill('P@ssw0rd'); 

                // กดปุ่ม Login (ตรวจสอบตัวเลือกปุ่มให้ตรงกับหน้างานจริง)
                const loginSubmitBtn = page.getByRole('button', { name: /login/i }).first();
                await loginSubmitBtn.click();

                // ==========================================================
                // 10. *** ตรวจสอบการเข้าสู่หน้า Welcome ***
                // ==========================================================
                console.log('⏳ กำลังรอเข้าสู่หน้า Welcome...');
                await page.waitForURL(/.*welcome/, { timeout: 20000 });
                await expect(page).toHaveURL(/.*welcome/);
                
                console.log('🎉 เข้าสู่หน้า Welcome สำเร็จ! พร้อมสำหรับการสมัคร Visa ต่อไป');
                await page.waitForTimeout(5000);
                
                // เมื่อรัน Flow เต็มจบสำเร็จ ให้เซตเป็น true ตรงนี้แทน
                isPassed = true; 

            } catch (error) {
                errorMessage = error.message;
                console.error(`❌ เกิดข้อผิดพลาดในขั้นตอน: ${errorMessage}`);
                throw error;
            } finally {
                // ==========================================================
                // แยกการจัดเก็บผลลัพธ์ใส่โฟลเดอร์ตาม Visa Type
                // ==========================================================
                const dirPath = `data/${rowVisa}`;
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }

                // 💡 4. ส่งค่าชื่อที่ได้จาก Faker เข้าไปบันทึกในไฟล์ JSON
                const result = {
                    testName: `Register [${rowVisa}]: ${record.Email}`,
                    email: genEmail,
                    visaType: rowVisa,
                    firstName: randomFirstName,
                    lastName: randomLastName,
                    originalEmailFromCSV: record.Email,
                    status: isPassed ? 'Success' : errorMessage,
                    result: isPassed ? 'PASS' : 'FAIL',
                    timestamp: new Date().toLocaleString('en-GB')
                };

                const baseFileName = `${dirPath}/TestResult_${basePrefix}_${uniqueId}`;
                fs.writeFileSync(`${baseFileName}.json`, JSON.stringify(result, null, 2), 'utf-8');

                // 💡 5. ส่งค่าชื่อที่ได้จาก Faker เข้าไปบันทึกใน Excel
                await saveToExcel({ 
                    newEmail: genEmail, 
                    newFirstName: randomFirstName,
                    newLastName: randomLastName,
                    status: result.status, 
                    result: result.result 
                }, rowVisa); 
            }
        });
    }
});