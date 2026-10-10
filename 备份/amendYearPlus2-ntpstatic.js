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
const excludeTexts = [];
const regList = [
  // 财年放最前面，优先匹配
  {
    r: /(?<!\d)(\d{4})\/(\d{2})(?!\w)/,
    handler: (match) => {
      const y1 = Number(match[0]);
      const newY1 = y1 + 1;
      const newY2 = newY1 + 1;
      console.log('match1:', match);
      return `${newY1}/${String(newY2).slice(-2)}`;
    }
  },
  // ① 香港格式 日/月/年  1/4/2018 → 1/4/2019
  {
    r: /(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\w)/,
    handler: (match) => {
      const day = match[0];
      const month = match[1];
      const year = Number(match[2]);
      console.log('match2:', match);
      return `${day}/${month}/${year + 1}`;
    }
  },
  // ② 英文日月年  25 October 2023 → 25 October 2024
  {
    r: /(?<!\d)(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?!\w)/,
    handler: (match) => {
      const day = match[0];
      const monthEn = match[1];
      const year = Number(match[2]);
      console.log('match3:', match);
      return `${day} ${monthEn} ${year + 1}`;
    }
  },
  // ③ 中文年月日  2023年10月25日 → 2024年10月25日
  {
    r: /(?<!\d)(\d{4})年(\d{1,2})月(\d{1,2})日(?!\w)/,
    handler: (match) => {
      const year = Number(match[0]);
      const month = match[1];
      const day = match[2];
      console.log('match4:', match);
      return `${year + 1}年${month}月${day}日`;
    }
  }
];


/**
 * 文本替换主逻辑：任意标签带 class="no-change-part" 内部全部跳过替换
 * @param {string} text
 * @returns {string}
 */
function replaceDateYear(text) {
  const placeholderStore = [];
  const PLACEHOLDER_TOKEN = `__NOCHANGE_PART_${Date.now()}_@@TOKEN@@`;
  let tokenIndex = 0;

  // 匹配任意标签，只要class包含no-change-part，捕获完整元素
  // **把所有带 `class="no-change-part"` 的完整 HTML 片段，临时替换成唯一占位字符串，先保护起来，避免被后面的年份替换逻辑修改**。
  const noChangeReg = /<[^>]+class="no-change-part"[^>]*>([\s\S]*?)<\/[^>]+>/g;
  let result = text.replace(noChangeReg, (fullElement) => {
    const token = `${PLACEHOLDER_TOKEN}_${tokenIndex++}`;
    // 存入完整原始html片段
    placeholderStore.push({
      token,
      rawHtml: fullElement
    });
    return token;
  });

  // 2. 原有日期替换逻辑
  for (const rule of regList) {
    const reg = new RegExp(rule.r.source, 'g');
    result = result.replace(reg, (...args) => {
      const fullMatched = args[0];
      const captureGroups = args.slice(1, -2); // 提取捕获分组，去掉index、input
      if (excludeTexts.includes(fullMatched)) {
        return fullMatched;
      }
      return rule.handler(captureGroups);
    });
  }

  // 3. 还原占位符，把原始元素放回
  for (const item of placeholderStore) {
    result = result.replace(item.token, item.rawHtml);
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
