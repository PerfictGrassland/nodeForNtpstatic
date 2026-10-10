// updateBottomDate.js
const fs = require('fs');
const path = require('path');

// ========== CONFIG 配置区 ==========
const config = {
  // 1. 需要处理的主题文件夹（可多选，如 ['itp', 'trp', 'btp']）
  themes: ['itp'], 
  
  // 2. 需要处理的中英文文件夹（en_us 和 zh_hk）
  langs: ['en_us', 'zh_hk'],
  
  // 3. 需要处理的具体的 htm 文件名（相同文件名只需写一次，会自动拼接路径）
  files: ['all.htm'], 
  
  // 4. 日期设置
  useSystemDate: false, // true = 使用系统当前时间；false = 使用下方自定义年月
  customYear: 2027,    // 当 useSystemDate = false 时，自定义的年份
  customMonth: 5,      // 当 useSystemDate = false 时，自定义的月份 (1-12)
  
  // 5. 预览模式
  isDryRun: false      // true = 只打印日志不写入文件；false = 实际写入修改
};

// 英文月份常量
const monthEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * 获取需要替换的日期字符串
 */
function getDateStrings() {
  let year, monthIndex;
  
  if (config.useSystemDate) {
    const now = new Date();
    year = now.getFullYear();
    monthIndex = now.getMonth(); // 0-11
  } else {
    year = config.customYear;
    monthIndex = config.customMonth - 1; // 转换为 0-11
  }

  // 校验自定义月份是否合法
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error(`自定义月份不合法: ${config.customMonth}，请在 1-12 之间。`);
  }

  const enStr = `${monthEn[monthIndex]} ${year}`;
  const zhStr = `${year}年${monthIndex + 1}月`;

  return { enStr, zhStr };
}

/**
 * 处理单个文件的底部日期替换
 */
function processFile(filePath, enStr, zhStr) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ 文件不存在，跳过: ${filePath}`);
    return;
  }

  const oldContent = fs.readFileSync(filePath, 'utf8');
  let newContent = oldContent;

  // 根据路径判断是英文还是中文，应用不同的正则规则
  if (filePath.includes('en_us')) {
    // 匹配英文括号日期 (Month YYYY)，例如 (October 2026)
    const bottomReg = /\([A-Za-z]+\s+\d{4}\)/g;
    newContent = newContent.replace(bottomReg, `(${enStr})`);
  } else if (filePath.includes('zh_hk')) {
    // 匹配中文括号日期 (YYYY年M月)，例如 (2026年10月)
    const bottomReg = /\(\d{4}年\d{1,2}月\)/g;
    newContent = newContent.replace(bottomReg, `(${zhStr})`);
  }

  // 判断文件内容是否有实际改动
  if (oldContent !== newContent) {
    console.log(`[MODIFY] ${filePath}`);
    if (!config.isDryRun) {
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
  } else {
    console.log(`[NO CHANGE] ${filePath} (未找到匹配的日期格式或已是最新)`);
  }
}

/**
 * 主运行函数
 */
function run() {
  console.log('开始执行底部日期替换脚本...');
  
  let enStr, zhStr;
  try {
    const dates = getDateStrings();
    enStr = dates.enStr;
    zhStr = dates.zhStr;
  } catch (error) {
    console.error(`❌ 日期生成失败: ${error.message}`);
    return;
  }

  console.log(`目标日期设定为 -> 英文格式: (${enStr}) | 中文格式: (${zhStr})\n`);

  // 遍历主题
  for (const theme of config.themes) {
    // 遍历语言
    for (const lang of config.langs) {
      // 遍历文件名
      for (const file of config.files) {
        const filePath = path.join(theme, lang, file);
        processFile(filePath, enStr, zhStr);
      }
    }
  }

  console.log(config.isDryRun 
    ? "\n✅ 预览模式，没有写入任何文件，确认日志后把 isDryRun 改为 false" 
    : "\n✅ 底部日期全部处理完成");
}

run();