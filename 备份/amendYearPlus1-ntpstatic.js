// amendYearPlus1-ntpstatic.js
const fs = require('fs');
const path = require('path');
// ========== CONFIG ==========
const portalDirs = [
  // './btp',
  './itp',
  // './trp'
];
const isDryRun = false; // true预览，false写入
const excludeTexts = [
  // "2018/19",
  // "2023/24",
  // "2019/20",
  // "2017/18",
  // "2024/25",
  // "2022/23",
  // "25 October 2023",
  // "1/4/2018"
];
// ========== 只修改regList正则，其余代码完全不变 ==========
const regList = [
  // 财年放最前面，优先匹配
  {
    r: /(?<!\d)(\d{4})\/(\d{2})(?!\d)/,
    handler: (match) => {
      const y1 = Number(match[1]);
      const newY1 = y1 + 1;
      const newY2 = newY1 + 1;
      return `${newY1}/${String(newY2).slice(-2)}`;
    }
  },
  // ① 香港格式 日/月/年  1/4/2018 → 1/4/2019
  {
    r: /(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/,
    handler: (match) => {
      const day = match[1];
      const month = match[2];
      const year = Number(match[3]);
      return `${day}/${month}/${year + 1}`;
    }
  },
  // ② 英文日月年  25 October 2023 → 25 October 2024
  {
    r: /(?<!\d)(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?!\d)/,
    handler: (match) => {
      const day = match[1];
      const monthEn = match[2];
      const year = Number(match[3]);
      return `${day} ${monthEn} ${year + 1}`;
    }
  },
  // ③ 中文年月日  2023年10月25日 → 2024年10月25日
  {
    r: /(?<!\d)(\d{4})年(\d{1,2})月(\d{1,2})日(?!\d)/,
    handler: (match) => {
      const year = Number(match[1]);
      const month = match[2];
      const day = match[3];
      return `${year + 1}年${month}月${day}日`;
    }
  }
];
/**
 * 文本替换主逻辑
 * @param {string} text
 * @returns {string}
 */
function replaceDateYear(text) {
  let result = text;
  for (const rule of regList) {
    const reg = new RegExp(rule.r.source, 'g');
    result = result.replace(reg, (...args) => {
      const fullMatched = args[0];
      if (excludeTexts.includes(fullMatched)) {
        return fullMatched;
      }
      return rule.handler(args);
    });
  }
  return result;
}
/**
 * 递归遍历目录，处理 .htm / .html
 */
function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
      continue;
    }
    const ext = path.extname(entry.name);
    if (ext !== '.htm' && ext !== '.html') continue;
    const oldContent = fs.readFileSync(fullPath, 'utf8');
    const newContent = replaceDateYear(oldContent);
    if (oldContent === newContent) {
      continue;
    }
    console.log(`[MODIFY] ${fullPath}, ${entry.name}`);
    if (!isDryRun) {
      fs.writeFileSync(fullPath, newContent, 'utf8');
    }
  }
}
function run() {
  for(const portalPath of portalDirs) {
    console.log(`\n===== Processing Portal: ${portalPath} =====`)
    if (!fs.existsSync(portalPath)) {
      console.log(`⚠️ 目录不存在: ${portalPath},跳过`);
      continue;
    }
    scanDirectory(portalPath);
  }
  console.log(isDryRun ? "\n✅ 预览模式，没有写入任何文件，确认日志后关闭dry-run" : "\n✅ 全部Portal处理完成");
}
run();
