// amendYearPlus1-ntpstatic.js
const fs = require('fs');
const path = require('path');

// ========== CONFIG 配置区 ==========
const portalDirs = [
  './itp',
  // './trp',
  // './btp'
];
const isDryRun = false; // true=预览不写入，确认无误后改为false
const excludeTexts = [];

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
      return `${year + 1}年${month}月${day}日`;
    }
  }
];

// 底部更新日期常量
const monthEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const now = new Date();
const currYear = now.getFullYear();
const currMonthIdx = now.getMonth();
const currEnMonth = monthEn[currMonthIdx];
const currCnMonth = currMonthIdx + 1;

/**
 * 正文日期年份+1，仅保护 no-change-part，不处理bottom-update-date
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
 * 更新bottom-update-date内部年月
 * 输入：<div class="...bottom-update-date">(May 2026)</div>
 * 输出：<div class="...bottom-update-date">(October 2026)</div>
 * @param {string} html 单个bottom div的html片段
 * @param {string} filePath 文件路径
 * @returns {string}
 */
function updateBottomUpdateDate(html, filePath) {
  let innerText;
  if (filePath.includes('en_us')) {
    innerText = `${currEnMonth} ${currYear}`;
  } else {
    innerText = `${currYear}年${currCnMonth}月`;
  }
  // 匹配：(任意内容)，捕获括号中间的文字
  const bottomReg = /(\()([^)]*)(\))/g;
  const updated = html.replace(bottomReg, `$1${innerText}$3`);
  if (updated !== html) {
    console.log(`  [BOTTOM-CHANGE] ${filePath}`);
  }
  return updated;
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

    // 第一步：提取所有bottom-update-date div，替换成占位符
    const bottomDivs = [];
    const bottomMatchReg = /<div[^>]*class="[^"]*bottom-update-date[^"]*">[\s\S]*?<\/div>/g;
    let tempContent = oldContent.replace(bottomMatchReg, (match) => {
      bottomDivs.push(match);
      return `__BOTTOM_UPDATE_DATE_${bottomDivs.length - 1}__`;
    });

    // 第二步：正文日期替换
    let newTempContent = replaceDateYear(tempContent);

    // 判断【正文】有没有改动（对比占位符版本，不是原始全文！）
    if (tempContent !== newTempContent) {
      // 正文有改动，更新底部日期
      let newContent = newTempContent.replace(/__BOTTOM_UPDATE_DATE_(\d+)__/g, (_, idx) => {
        return updateBottomUpdateDate(bottomDivs[idx], fullPath);
      });
      console.log(`[MODIFY] ${fullPath}, ${entry.name}`);
      if (!isDryRun) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
      }
    } else {
      // 正文无改动，原样恢复底部div，不做任何修改
      let newContent = newTempContent.replace(/__BOTTOM_UPDATE_DATE_(\d+)__/g, (_, idx) => bottomDivs[idx]);
      // 不写文件、不打印modify日志
    }
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
}

run();
