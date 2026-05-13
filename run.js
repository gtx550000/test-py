// ไฟล์: run.js
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('=======================================');
console.log('   🤖 เลือกรัน Automation แยกตามประเภท Visa');
console.log('=======================================');
console.log('1. WGC (Wealthy Global Citizen)');
console.log('2. HSP (Highly-Skilled Professional)');
console.log('3. LTR (Long-Term Resident)');
console.log('4. รันทั้งหมด ทุกประเภท (ALL)');
console.log('=======================================');

rl.question('👉 พิมพ์หมายเลข (1-4) แล้วกด Enter: ', (answer) => {
    let testFile = '';
    
    // 💡 เปลี่ยนจากการส่ง Environment Variable มาเป็นการชี้เป้าไปที่ไฟล์ตรงๆ
    if (answer === '1') testFile = 'test/wgc-register.spec.js';
    else if (answer === '2') testFile = 'test/hsp-register.spec.js';
    else if (answer === '3') testFile = 'test/ltr-register.spec.js';
    else if (answer === '4') testFile = 'test/*.spec.js'; // สั่งรันทุกไฟล์ในโฟลเดอร์ test
    else {
        console.log('⚠️ เลือกไม่ถูกต้อง จะทำการรันทั้งหมด');
        testFile = 'test/*.spec.js';
    }

    console.log(`\n🚀 กำลังเริ่มรันไฟล์ทดสอบ: ${testFile} ...\n`);
    rl.close();

    try {
        // สั่งรัน Playwright โดยระบุชื่อไฟล์ตรงๆ
        execSync(`npx playwright test ${testFile} --headed`, { stdio: 'inherit' });
    } catch (error) {
        console.log('\n🛑 การทดสอบสิ้นสุดลง (หรือมีข้อผิดพลาด)');
    }
});







/* ไฟล์: run.js
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('=======================================');
console.log('   🤖 เลือกรัน Automation แยกตามประเภท Visa');
console.log('=======================================');
console.log('1. WGC (Wealthy Global Citizen)');
console.log('2. HSP (Highly-Skilled Professional)');
console.log('3. WP (Wealthy Pensioner)');
console.log('4. รันทั้งหมด (ALL - ดึงตามในไฟล์ CSV)');
console.log('=======================================');

rl.question('👉 พิมพ์หมายเลข (1-4) แล้วกด Enter: ', (answer) => {
    let selectedVisa = 'ALL';
    
    if (answer === '1') selectedVisa = 'WGC';
    else if (answer === '2') selectedVisa = 'HSP';
    else if (answer === '3') selectedVisa = 'WP';
    else if (answer !== '4') {
        console.log('⚠️ เลือกไม่ถูกต้อง จะทำการรันแบบทั้งหมด (ALL)');
    }

    console.log(`\n🚀 กำลังเริ่มรันเทสต์สำหรับกลุ่ม: ${selectedVisa} ...\n`);
    rl.close();

    // สั่งรัน Playwright โดยส่งค่า selectedVisa เข้าไปผ่าน Environment Variable
    try {
        execSync(`npx playwright test test/ltr-test.spec.js`, {
            stdio: 'inherit', // เพื่อให้เห็น log ของ Playwright ในหน้าจอเดิม
            env: { ...process.env, TARGET_VISA: selectedVisa } // โยนตัวแปรเข้าไป
        });
    } catch (error) {
        console.log('\n🛑 การทดสอบสิ้นสุดลง (หรือมีข้อผิดพลาด)');
    }
});
*/
