const { faker } = require('@faker-js/faker');
const WgcBasePage = require('./WgcBasePage');

class WgcStep5_Review extends WgcBasePage {
    constructor(page, generatedData) {
        super(page); // ส่ง page ให้คลาสแม่จัดการ
        this.generatedData = generatedData;
    }

    // ฟังก์ชันหลักสำหรับจัดการหน้าฟอร์ม Review
    async fillReviewStep5() {
        console.log('🔘 [WGC Form - Step 5] เริ่มจัดการข้อมูล Review');

        try {
            // 💡 1. ใช้หัวข้อ Declaration and Consent เป็นสมอเรือ (Anchor)
            // ค้นหาคลาสหลักร่วมกับข้อความเพื่อความแม่นยำ ป้องกันการกดพลาดก่อน UI จะพร้อม
            console.log('   ⏳ รอโหลดส่วน Declaration and Consent...');
            const declarationHeader = this.page.locator('.ant-typography').filter({ hasText: /Declaration and Consent/i }).first();
            await declarationHeader.waitFor({ state: 'visible', timeout: 15000 });
            await declarationHeader.scrollIntoViewIfNeeded();
            console.log('   ✅ พบส่วน Declaration and Consent แล้ว');

            // 💡 2. ติ๊ก Checkbox ยืนยันข้อมูลทั้ง 3 ช่อง (แบบเจาะจงชื่อ)
            console.log('   🔲 กำลังติ๊ก Checkbox เงื่อนไขทั้ง 3 ช่อง...');
            
            const checkboxOcr = this.page.locator('input[name="accept_ocr_disclaimer"]');
            const checkboxCertify = this.page.locator('input[name="certify_information"]');
            const checkboxAuthorize = this.page.locator('input[name="authorize_sharing"]');

            // รอให้ตัวแรกปรากฏใน DOM ก่อนเริ่มกด
            await checkboxOcr.waitFor({ state: 'attached', timeout: 5000 });

            await checkboxOcr.check({ force: true });
            console.log('      ✅ ติ๊กช่องที่ 1: Accept OCR Disclaimer สำเร็จ');

            await checkboxCertify.check({ force: true });
            console.log('      ✅ ติ๊กช่องที่ 2: Certify Information สำเร็จ');

            await checkboxAuthorize.check({ force: true });
            console.log('      ✅ ติ๊กช่องที่ 3: Authorize Sharing สำเร็จ');

            // 💡 3. เลือกโหมดวาดลายเซ็น (Provide Your Signature)
            console.log('   ✍️ กำลังเลือกโหมด Sign in the box below...');
            
            // ชี้เป้าไปที่ตัวเลือก value="draw"
            const drawOptionInput = this.page.locator('input[value="draw"]');
            
            try {
                // ท่าหลัก: บังคับติ๊กที่ input โดยตรง
                await drawOptionInput.waitFor({ state: 'attached', timeout: 5000 });
                await drawOptionInput.check({ force: true });
                console.log('      ✅ เลือกโหมดวาดลายเซ็น (value="draw") สำเร็จ');
            } catch (error) {
                // ท่าสำรอง: กรณีที่ Framework ซ่อน input ไว้จนคลิกไม่ได้ ให้กวาดหา Label ที่ครอบมันอยู่แล้วคลิกแทน
                console.log('      ⚠️ ท่าหลักติดขัด กำลังลองคลิกที่ Label ของโหมดวาด...');
                const drawOptionLabel = this.page.locator('label').filter({ has: this.page.locator('input[value="draw"]') }).first();
                await drawOptionLabel.click({ force: true });
                console.log('      ✅ เลือกโหมดวาดลายเซ็น (ผ่าน Label) สำเร็จ');
            }

            // 💡 4. วาดลายเซ็น (Draw Signature) ลงบน Canvas
            console.log('   🎨 กำลังเตรียมวาดลายเซ็น...');
            
            // รอให้ Canvas ปรากฏขึ้นมาหลังจากเลือกโหมด Draw
            const signaturePad = this.page.locator('canvas').first();
            await signaturePad.waitFor({ state: 'visible', timeout: 5000 });
            await signaturePad.scrollIntoViewIfNeeded();

            // ดึงพิกัด (Bounding Box) ของกล่องลายเซ็น
            const box = await signaturePad.boundingBox();
            
            if (box) {
                // คำนวณพิกัดเริ่มต้นวาด
                const startX = box.x + (box.width * 0.2); 
                const startY = box.y + (box.height * 0.5); 
                
                // เริ่มวาด
                await this.page.mouse.move(startX, startY);
                await this.page.mouse.down();
                
                await this.page.mouse.move(startX + 30, startY - 40, { steps: 5 }); 
                await this.page.mouse.move(startX + 60, startY + 40, { steps: 5 }); 
                await this.page.mouse.move(startX + 90, startY - 40, { steps: 5 }); 
                await this.page.mouse.move(startX + 120, startY + 40, { steps: 5 }); 
                
                await this.page.mouse.up();
                console.log('      ✅ วาดลายเซ็นจำลองลง Canvas สำเร็จ');
            } else {
                throw new Error('ไม่พบพิกัด Bounding Box ของกล่องลายเซ็น (Canvas อาจจะยังไม่แสดงผล)');
            }

            // 💡 5. กดปุ่ม Submit เพื่อเรียก Popup ยืนยัน
            console.log('   🔘 กำลังกดปุ่ม Submit เพื่อส่งข้อมูล...');
            const submitButton = this.page.locator('button[type="submit"]').first();
            await submitButton.waitFor({ state: 'visible', timeout: 5000 });
            await submitButton.scrollIntoViewIfNeeded();
            
            await submitButton.click();
            console.log('      ✅ กดปุ่ม Submit (รอบแรก) สำเร็จ...');
            
            // =========================================================
            // 💡 6. จัดการ Popup Confirm
            // =========================================================
            console.log('   💬 กำลังตรวจสอบ Popup ยืนยันการส่งข้อมูล...');
            
            // รอให้ข้อความใน Popup ปรากฏ (ตัวการันตีว่า Modal โหลดเสร็จแล้ว)
            const confirmMessage = this.page.getByText('Are you sure you want to submit the form?').first();
            await confirmMessage.waitFor({ state: 'visible', timeout: 10000 });
            console.log('      ✅ พบ Popup ยืนยันแล้ว กำลังเตรียมกด Confirm');

            // ชี้เป้าปุ่ม Confirm 
            // ใช้เทคนิค .filter() หาปุ่ม type="submit" ที่มีคำว่า Confirm ป้องกันการไปกดโดนปุ่มอื่น
            const confirmBtn = this.page.locator('button[type="submit"]').filter({ hasText: /Confirm/i })
                .or(this.page.getByRole('button', { name: /Confirm/i }))
                .first();

            await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
            await confirmBtn.click();
            console.log('      ✅ กดปุ่ม Confirm เพื่อปิดจบกระบวนการสำเร็จ!');
            
            // หน่วงเวลาเล็กน้อยเพื่อให้ระบบประมวลผลและแสดงหน้า Success Screen
            console.log('      ⏳ รอระบบประมวลผลการส่งข้อมูลขั้นสุดท้าย...');
            await this.page.waitForTimeout(5000); 

            console.log('   🎉 [Step 5] จัดการหน้า Review เสร็จสมบูรณ์ ส่งฟอร์ม End-to-End เรียบร้อยครับ K!');

        } catch (error) {
            console.error('❌ เกิดข้อผิดพลาดระหว่างจัดการ Review step 5:', error.message);
            throw error;
        }
    }
}

module.exports = WgcStep5_Review;