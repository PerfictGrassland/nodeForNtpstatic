// updateBottomDate.js
const fs = require('fs');
const path = require('path');

// ========== CONFIG 配置区 ==========
const config = {
  // 1. 需要处理的主题文件夹（可多选，如 ['itp', 'trp', 'btp']）
  themes: ['itp'], 
  
  // 2. 需要处理的中英文文件夹
  langs: ['en_us', 'zh_hk'],
  
  // 3. 【新增】自动检测所有 htm 文件
  autoDetect: true, // true = 忽略下面的 files 数组，自动扫描目录下的所有 .htm 文件
  
  // 4. 当 autoDetect = false 时，使用这个列表
  files: ['all.htm', 'app.htm', 'declar.htm', 'general.htm'], 
  
  // 5. 日期设置
  useSystemDate: true, // true = 使用系统当前时间；false = 使用下方自定义年月
  customYear: 2027,    // 当 useSystemDate = false 时，自定义的年份
  customMonth: 5,      // 当 useSystemDate = false 时，自定义的月份 (1-12)
  
  // 6. 预览模式
  isDryRun: true       // true = 只打印日志不写入文件；false = 实际写入修改
};

// 英文月份常量，用于拼装英文格式日期（如 October 2026）
const monthEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * 获取需要替换的日期字符串
 * 根据 config.useSystemDate 决定是用系统当前日期还是自定义日期
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

  // 生成最终要替换进去的文本
  return {
    enStr: `${monthEn[monthIndex]} ${year}`,
    zhStr: `${year}年${monthIndex + 1}月`
  };
}

/**
 * 处理单个文件的底部日期替换
 * @param {string} filePath - 文件的完整路径
 * @param {string} enStr - 替换用的英文字符串（如 October 2026）
 * @param {string} zhStr - 替换用的中文字符串（如 2026年10月）
 * @returns {string} 状态: 'MODIFIED' | 'UNCHANGED' | 'NOT_FOUND'
 */
function processFile(filePath, enStr, zhStr) {
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ 文件不存在，跳过: ${filePath}`);
    return 'NOT_FOUND';
  }

  const oldContent = fs.readFileSync(filePath, 'utf8');
  let newContent = oldContent;

  // 根据路径判断是英文还是中文，应用不同的正则规则进行替换
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
    console.log(`[MODIFY] ${filePath}`); // 👈 详细日志：提示哪个文件被修改了
    if (!config.isDryRun) {
      // 实际执行模式下，写入文件
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
    return 'MODIFIED';
  } else {
    console.log(`[NO CHANGE] ${filePath} (未找到匹配的日期格式或已是最新)`); // 👈 详细日志：提示哪个文件无需修改
    return 'UNCHANGED';
  }
}

/**
 * 主运行函数
 */
function run() {
  console.log('🚀 开始执行底部日期替换脚本...\n');
  
  // 1. 先获取日期字符串
  let enStr, zhStr;
  try {
    const dates = getDateStrings();
    enStr = dates.enStr;
    zhStr = dates.zhStr;
  } catch (error) {
    console.error(`❌ 日期生成失败: ${error.message}`);
    return;
  }

  console.log(`📅 目标日期设定为 -> 英文格式: (${enStr}) | 中文格式: (${zhStr})\n`);

  // 使用 Set 存放去重后的纯文件名，方便最后以数组形式输出
  const modifiedFilesSet = new Set();
  const unchangedFilesSet = new Set();
  const notFoundFilesSet = new Set();

  // 用于精确统计实际执行了多少个物理文件（因为同一个文件名会跑中英文两次，所以数量会翻倍）
  let totalFilesProcessed = 0; // 实际处理总数（含中英文）
  let totalFilesModified = 0;  // 实际发生修改的物理文件数
  let totalFilesUnchanged = 0; // 实际无需修改的物理文件数

  // 2. 开始遍历主题、语言、文件名
  for (const theme of config.themes) {
    let filesToProcess = config.files;

    // ========== 自动扫描目录逻辑 ==========
    if (config.autoDetect) {
      // 默认去 en_us 目录下读取所有文件作为基准列表
      const scanDir = path.join(theme, 'en_us');
      if (fs.existsSync(scanDir)) {
        filesToProcess = fs.readdirSync(scanDir).filter(f => f.endsWith('.htm') || f.endsWith('.html'));
        console.log(`🔍 自动扫描到 ${theme} 主题下的基准 HTML 文件数: ${filesToProcess.length} 个`);
        console.log(`   （由于配置了 ${config.langs.length} 种语言，本次预计实际处理文件数为: ${filesToProcess.length * config.langs.length} 个）\n`);
      } else {
        console.warn(`⚠️ 找不到目录: ${scanDir}，跳过该主题。`);
        continue;
      }
    }

    // 遍历语言（en_us 和 zh_hk）及文件列表
    for (const lang of config.langs) {
      for (const file of filesToProcess) {
        const filePath = path.join(theme, lang, file);
        
        // 执行处理逻辑，获取结果状态
        const result = processFile(filePath, enStr, zhStr);
        
        // 累加实际的物理文件处理数量
        if (result !== 'NOT_FOUND') {
          totalFilesProcessed++;
          if (result === 'MODIFIED') totalFilesModified++;
          if (result === 'UNCHANGED') totalFilesUnchanged++;
        }

        // 将纯文件名（例如 all.htm）存入对应的 Set 中进行去重收集
        if (result === 'MODIFIED') {
          modifiedFilesSet.add(file);
        } else if (result === 'UNCHANGED') {
          unchangedFilesSet.add(file);
        } else if (result === 'NOT_FOUND') {
          notFoundFilesSet.add(file);
        }
      }
    }
  }

  // ========== 打印统计汇总区 ==========
  console.log(`\n==============================================`);
  console.log(`📊 执行统计汇总`);
  console.log(`   - 【${config.isDryRun ? '预览模式' : '实际执行'}】`);
  console.log(`   - 实际处理的文件总数 (含中英文): ${totalFilesProcessed} 个`);
  console.log(`     ├─ 实际发生修改的文件: ${totalFilesModified} 个`);
  console.log(`     └─ 实际无需修改的文件: ${totalFilesUnchanged} 个`);
  
  // 打印去重后的对数统计，方便直接看出有多少个独立文件
  console.log(`\n   - 文件名去重对数统计:`);
  console.log(`     ├─ 修改的文件对: ${modifiedFilesSet.size} 对`);
  console.log(`     ├─ 保留的文件对: ${unchangedFilesSet.size} 对`);
  console.log(`     └─ 缺失的文件对: ${notFoundFilesSet.size} 对`);

  // 1. 打印成功修改的文件名清单（直接打印为 JS 数组格式，方便复制）
  if (modifiedFilesSet.size > 0) {
    console.log(`\n   ✅ 成功修改的文件名清单 (去重后):`);
    console.log(`   [`);
    Array.from(modifiedFilesSet).forEach(file => {
      console.log(`     '${file}',`);
    });
    console.log(`   ]`);
  }

  // 2. 打印无需修改的文件名清单
  if (unchangedFilesSet.size > 0) {
    console.log(`\n   ⚪ 无需修改的文件名清单 (去重后):`);
    console.log(`   [`);
    Array.from(unchangedFilesSet).forEach(file => {
      console.log(`     '${file}',`);
    });
    console.log(`   ]`);
  }

  // 3. 打印缺失文件警告
  if (notFoundFilesSet.size > 0) {
    console.log(`\n   ⚠️ 缺失的文件名清单:`);
    Array.from(notFoundFilesSet).forEach(file => {
      console.log(`     - ${file}`);
    });
  }
  
  console.log(`\n==============================================\n`);

  // 打印最终执行结果提示
  console.log(config.isDryRun 
    ? "✅ 预览模式，没有写入任何文件，确认日志后把 isDryRun 改为 false" 
    : "✅ 底部日期全部处理完成");
}

// 启动主函数
run();