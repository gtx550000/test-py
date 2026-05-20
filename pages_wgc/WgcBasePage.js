class WgcBasePage {
    constructor(page) {
        this.page = page;
    }

    /**
     * 🛡️ ฟังก์ชันสำหรับดักจับและปิด Intro Tour (หน้าต่างสอนใช้งาน)
     * ใช้ร่วมกันในหลายๆ Step
     */
    async handleIntroTour() {
        const skipBtn = this.page.locator('.introjs-skipbutton');
        try {
            await skipBtn.waitFor({ state: 'visible', timeout: 5000 });
            console.log('💡 [WGC Form] ตรวจพบ Intro Tour หน้าเว็บ กำลังกดปุ่ม Skip...');
            await skipBtn.click();
            await this.page.waitForTimeout(1000); 
            console.log('      ✅ ปิด Intro Tour สำเร็จ หน้าจอโล่งแล้ว');
        } catch (error) {
            // ไม่พบ Tour ก็ทำงานต่อ
        }
    }
}

module.exports = WgcBasePage;