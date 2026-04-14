// ==========================================
// ฟังก์ชันหลักที่ระบบจะเรียก (Handler)
// ==========================================
function triggerNextjsReport() {
  const url = 'https://task-mal.vercel.app/api/cron/trigger-report';

  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer man-cron-secret-12345'
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log("✅ ดำเนินการส่งรายงานอัตโนมัติสำเร็จ: " + response.getContentText());
  } catch (err) {
    Logger.log("🚨 ล้มเหลว: " + err);
  }
}

// ==========================================
// ฟังก์ชันติดตั้ง Trigger (รันแค่วันละครั้งเพื่อตั้งเวลา)
// - กดรันฟังก์ชันนี้ "เพียงครั้งเดียว" ระบบจะสร้างนาฬิกาปลุก 2 รอบให้คุณ
// ==========================================
function setupDailyTriggers() {
  // 1. ล้าง Trigger เก่าออกให้หมดเพื่อไม่ให้ซ้ำซ้อน
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  // 2. ตั้งเวลาปลุก 08:00 - 09:00 น.
  ScriptApp.newTrigger('triggerNextjsReport')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .nearMinute(0)
    .create();

  // 3. ตั้งเวลาปลุก 17:00 - 18:00 น.
  ScriptApp.newTrigger('triggerNextjsReport')
    .timeBased()
    .atHour(17)
    .everyDays(1)
    .nearMinute(0)
    .create();

  Logger.log("🚀 ติดตั้งนาฬิกาปลุก 08:00 และ 17:00 เรียบร้อยแล้ว!");
}

