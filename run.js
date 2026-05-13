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