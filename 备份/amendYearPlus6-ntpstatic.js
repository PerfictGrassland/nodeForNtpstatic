// amendYearPlus1-ntpstatic.js
const fs = require('fs');
const path = require('path');
// ========== CONFIG 配置区 ==========
const portalDirs = [
  './itp',
  './trp',
  './btp'
];
const isDryRun = true; // true=预览不写入，确认无误后改为false
const updateBottomDate = false; // true=正文有改动时，更新底部日期；false=不更新底部日期

// 底部日期更新配置
const useSystemDate = true; // true=使用系统当前时间；false=使用下方自定义年月
const customYear = 2027;    // 当 useSystemDate = false 时，自定义的年份
const customMonth = 5;      // 当 useSystemDate = false 时，自定义的月份 (1-12)

const excludeTexts = [];

// 新增：用于收集被修改的文件名（自动去重）
const modifiedFilesSet = new Set();

// 日期匹配规则列表，按优先级排序
const regList = [
  // 财年 2018/19
  {
    r: /(?<!\d)(\d{4})\/(\d{2})(?!\w)/,
    handler: (groups) => {
      const y1 = Number(groups[0]);
      const newY1 = y1 + 1;
      const newY2 = newY1 + 1;
      return `${newY1}/${String(newY2).slice(-2)}`;
    }
  },
  // 日/月/年 1/4/2018
  {
    r: /(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\w)/,
    handler: (groups) => {
      const day = groups[0];
      const month = groups[1];
      const year = Number(groups[2]);
      return `${day}/${month}/${year + 1}`;
    }
  },
  // 英文日月年 25 October 2023
  {
    r: /(?<!\d)(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?!\w)/,
    handler: (groups) => {
      const day = groups[0];
      const monthEn = groups[1];
      const year = Number(groups[2]);
      return `${day} ${monthEn} ${year + 1}`;
    }
  },
  // 中文年月日 2023年10月25日
  {
    r: /(?<!\d)(\d{4})年(\d{1,2})月(\d{1,2})日(?!\w)/,
    handler: (groups) => {
      const year = Number(groups[0]);
      const month = groups[1];
      const day = groups[2];
      return `${year + 1}年${month}月${day}`;
    }
  }
];
// 底部日期常量
const monthEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * 正文日期年份+1，仅保护 no-change-part
 * @param {string} text
 * @returns {string}
 */
function replaceDateYear(text) {
  const placeholderStore = [];
  const PLACEHOLDER_TOKEN = `__NOCHANGE_PART_${Date.now()}_@@TOKEN@@`;
  let tokenIndex = 0;
  // 保护 no-change-part 区块
  const noChangeReg = /<[^>]+class="no-change-part"[^>]*>([\s\S]*?)<\/[^>]+>/g;
  let result = text.replace(noChangeReg, (fullElement) => {
    const token = `${PLACEHOLDER_TOKEN}_${tokenIndex++}`;
    placeholderStore.push({ token, rawHtml: fullElement });
    return token;
  });
  // 遍历所有日期替换规则
  for (const rule of regList) {
    const reg = new RegExp(rule.r.source, 'g');
    result = result.replace(reg, (...args) => {
      const fullMatched = args[0];
      const captureGroups = args.slice(1, -2);
      if (excludeTexts.includes(fullMatched)) {
        return fullMatched;
      }
      return rule.handler(captureGroups);
    });
  }
  // 还原no-change-part占位符
  for (const item of placeholderStore) {
    result = result.replace(item.token, item.rawHtml);
  }
  return result;
}

/**
 * 只匹配日期格式的括号：(October 2026) 或 (2026年10月)
 * 普通文字括号 (s)、(Hong Kong resident person) 不会被匹配，避免误伤正文
 */
function replaceBottomDate(htmlContent, filePath) {
  let targetYear, targetMonthIdx;

  // 根据配置决定使用系统时间还是自定义时间
  if (useSystemDate) {
    const now = new Date();
    targetYear = now.getFullYear();
    targetMonthIdx = now.getMonth(); // 0-11
  } else {
    targetYear = customYear;
    targetMonthIdx = customMonth - 1; // 转换为 0-11
    
    // 简单校验自定义月份合法性
    if (targetMonthIdx < 0 || targetMonthIdx > 11) {
      console.error(`⚠️ 自定义月份不合法: ${customMonth}，应在 1-12 之间。将使用系统当前月份。`);
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonthIdx = now.getMonth();
    }
  }

  let innerText;
  // 区分 en_us / zh_hk
  if (filePath.includes('en_us')) {
    innerText = `${monthEn[targetMonthIdx]} ${targetYear}`;
    // 匹配英文日期格式 (Month YYYY)
    const bottomReg = /\([A-Za-z]+\s+\d{4}\)/g;
    return htmlContent.replace(bottomReg, `(${innerText})`);
  } else {
    innerText = `${targetYear}年${targetMonthIdx + 1}月`;
    // 匹配中文日期格式 (2026年10月)
    const bottomReg = /\(\d{4}年\d{1,2}月\)/g;
    return htmlContent.replace(bottomReg, `(${innerText})`);
  }
}

/**
 * 递归扫描目录，处理 .htm / .html
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
    // 第一步：替换正文日期
    let contentAfterBody = replaceDateYear(oldContent);
    // 判断正文有没有改动
    if (oldContent !== contentAfterBody) {
      let finalContent = contentAfterBody;
      // 新增：根据updateBottomDate开关，决定是否更新底部日期
      if(updateBottomDate){
        finalContent = replaceBottomDate(contentAfterBody, fullPath);
      }
      console.log(`[MODIFY] ${fullPath}, ${entry.name}`);
      modifiedFilesSet.add(entry.name); // 新增：收集文件名
      if (!isDryRun) {
        fs.writeFileSync(fullPath, finalContent, 'utf8');
      }
    }
    // 正文无改动：文件完全不动，底部日期也不碰
  }
}

function run() {
  for (const portalPath of portalDirs) {
    console.log(`\n===== Processing Portal: ${portalPath} =====`)
    if (!fs.existsSync(portalPath)) {
      console.log(`⚠️ 目录不存在: ${portalPath},跳过`);
      continue;
    }
    scanDirectory(portalPath);
  }
  console.log(isDryRun ? "\n✅ 预览模式，没有写入任何文件，确认日志后把isDryRun改为false" : "\n✅ 全部Portal处理完成");
  // 新增：输出收集到的文件数组
  console.log("\n========== 收集到的文件列表（去重） ==========");
  console.log(JSON.stringify([...modifiedFilesSet], null, 2));
  console.log("==============================================");
}
run();