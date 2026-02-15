/**
 * Agent测试协调器
 *
 * 用途：手动触发测试流程，协调测试员和错误分析师两个agent
 * 使用：node agents/test-coordinator.js
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const TEST_REPORT_DIR = 'agents/test-reports';
const ERROR_REPORT_DIR = 'agents/error-reports';

// 初始化目录
async function init() {
  await fs.mkdir(TEST_REPORT_DIR, { recursive: true });
  await fs.mkdir(ERROR_REPORT_DIR, { recursive: true });
}

/**
 * 启动测试员agent
 */
async function runTesterAgent(options = {}) {
  console.log('\n🤖 启动测试员 Agent...\n');
  console.log('测试类型:', options.testType || 'automated');
  console.log('测试套件:', options.testSuite || 'all');

  // 这里模拟测试员agent的工作
  // 实际使用时，应该调用真正的测试脚本（使用Playwright）

  const testReport = {
    testId: `TEST-${Date.now()}`,
    timestamp: new Date().toISOString(),
    testType: options.testType || 'automated',
    testSuite: options.testSuite || 'all',
    modifiedFiles: options.modifiedFiles || [],
    results: {
      passed: 0,
      failed: 0,
      skipped: 0
    },
    issues: []
  };

  // 如果有实际的测试脚本，在这里调用
  // 例如：await runPlaywrightTests(options);

  return testReport;
}

/**
 * 启动错误分析师agent
 */
async function runErrorAnalystAgent(testReport) {
  console.log('\n🔍 启动错误分析师 Agent...\n');

  if (testReport.issues.length === 0) {
    console.log('✅ 测试全部通过，无需分析错误！');
    return null;
  }

  console.log(`分析 ${testReport.issues.length} 个问题...`);

  // 这里模拟错误分析师agent的工作
  // 实际使用时，应该让Claude读取代码并分析

  const errorReport = {
    reportId: `ERROR-${Date.now()}`,
    timestamp: new Date().toISOString(),
    testReportId: testReport.testId,
    summary: {
      totalIssues: testReport.issues.length,
      critical: 0,
      major: 0,
      minor: 0
    },
    errors: []
  };

  // 分析每个问题
  for (const issue of testReport.issues) {
    const errorAnalysis = await analyzeError(issue, testReport);
    errorReport.errors.push(errorAnalysis);

    // 统计严重程度
    if (errorAnalysis.severity === 'critical') errorReport.summary.critical++;
    else if (errorAnalysis.severity === 'major') errorReport.summary.major++;
    else if (errorAnalysis.severity === 'minor') errorReport.summary.minor++;
  }

  return errorReport;
}

/**
 * 分析单个错误（模拟）
 * 实际使用时应该让Claude读取代码分析
 */
async function analyzeError(issue, testReport) {
  // 这里应该调用Claude API来分析错误
  // 现在返回一个模拟的分析结果

  return {
    errorId: `E-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    severity: issue.severity,
    errorType: determineErrorType(issue),
    title: issue.title,
    description: issue.description,
    reproductionSteps: issue.steps,
    rootCause: {
      direct: "待分析 - 需要查看代码",
      fundamental: "待分析 - 需要查看代码",
      codeLocation: "待分析 - 需要查看代码"
    },
    affectedFiles: issue.affectedFiles || [],
    fixSuggestions: [
      "请让错误分析师agent读取相关代码文件",
      "进行根因分析",
      "提供具体的修复建议"
    ],
    verificationSteps: [
      "应用修复代码",
      "按照重现步骤验证",
      "确认问题已解决"
    ]
  };
}

/**
 * 根据症状判断错误类型
 */
function determineErrorType(issue) {
  const description = issue.description.toLowerCase();

  if (description.includes('禁用') || description.includes('选择')) {
    return 'Logic Error';
  }
  if (description.includes('不显示') || description.includes('界面')) {
    return 'UI/UX';
  }
  if (description.includes('慢') || description.includes('卡顿')) {
    return 'Performance';
  }
  if (description.includes('保存') || description.includes('加载')) {
    return 'Data Persistence';
  }

  return 'Unknown';
}

/**
 * 保存测试报告
 */
async function saveTestReport(report) {
  const filename = `${TEST_REPORT_DIR}/${report.testId}.json`;
  await fs.writeFile(filename, JSON.stringify(report, null, 2));
  console.log(`\n📄 测试报告已保存: ${filename}`);
  return filename;
}

/**
 * 保存错误报告
 */
async function saveErrorReport(report) {
  const filename = `${ERROR_REPORT_DIR}/${report.reportId}.md`;

  // 生成Markdown报告
  let markdown = `# 错误分析报告\n\n`;
  markdown += `**报告ID**: ${report.reportId}\n`;
  markdown += `**生成时间**: ${report.timestamp}\n`;
  markdown += `**测试报告**: ${report.testReportId}\n\n`;
  markdown += `## 概要\n\n`;
  markdown += `- 总问题数: ${report.summary.totalIssues}\n`;
  markdown += `- 严重: ${report.summary.critical}\n`;
  markdown += `- 重要: ${report.summary.major}\n`;
  markdown += `- 轻微: ${report.summary.minor}\n\n`;

  for (const error of report.errors) {
    markdown += `## ${error.title}\n\n`;
    markdown += `**错误ID**: ${error.errorId}\n`;
    markdown += `**严重程度**: ${error.severity}\n`;
    markdown += `**错误类型**: ${error.errorType}\n\n`;
    markdown += `### 问题描述\n\n${error.description}\n\n`;
    markdown += `### 重现步骤\n\n`;
    error.reproductionSteps.forEach((step, i) => {
      markdown += `${i + 1}. ${step}\n`;
    });
    markdown += `\n### 根本原因\n\n`;
    markdown += `- 直接原因: ${error.rootCause.direct}\n`;
    markdown += `- 根本原因: ${error.rootCause.fundamental}\n`;
    markdown += `- 代码位置: ${error.rootCause.codeLocation}\n\n`;
    markdown += `### 修复建议\n\n`;
    error.fixSuggestions.forEach((suggestion, i) => {
      markdown += `${i + 1}. ${suggestion}\n`;
    });
    markdown += `\n### 验证步骤\n\n`;
    error.verificationSteps.forEach((step, i) => {
      markdown += `${i + 1}. ${step}\n`;
    });
    markdown += `\n---\n\n`;
  }

  await fs.writeFile(filename, markdown);
  console.log(`\n📄 错误报告已保存: ${filename}`);
  return filename;
}

/**
 * 完整的测试流程
 */
async function runFullTestFlow(options = {}) {
  await init();

  console.log('═══════════════════════════════════════════════════');
  console.log('     Agent 测试协调器');
  console.log('═══════════════════════════════════════════════════');

  // 阶段1：运行测试
  const testReport = await runTesterAgent(options);

  // 如果有真实的测试脚本，在这里等待测试完成
  // 现在我们需要手动添加问题到测试报告
  if (options.manualIssues) {
    testReport.issues = options.manualIssues;
    testReport.results.failed = options.manualIssues.length;
  }

  console.log('\n📊 测试结果:');
  console.log(`  通过: ${testReport.results.passed}`);
  console.log(`  失败: ${testReport.results.failed}`);
  console.log(`  跳过: ${testReport.results.skipped}`);

  // 保存测试报告
  await saveTestReport(testReport);

  // 阶段2：分析错误（如果有）
  if (testReport.issues.length > 0) {
    console.log('\n⚠️  发现问题，开始分析...');
    const errorReport = await runErrorAnalystAgent(testReport);

    if (errorReport) {
      await saveErrorReport(errorReport);

      console.log('\n📋 错误分析摘要:');
      console.log(`  严重: ${errorReport.summary.critical}`);
      console.log(`  重要: ${errorReport.summary.major}`);
      console.log(`  轻微: ${errorReport.summary.minor}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ 测试流程完成！');
  console.log('═══════════════════════════════════════════════════\n');
}

/**
 * 命令行接口
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // 解析命令行参数
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
      options.testType = args[++i];
    } else if (args[i] === '--suite' && args[i + 1]) {
      options.testSuite = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Agent测试协调器 - 使用方法

  node agents/test-coordinator.js [选项]

选项:
  --type <type>      测试类型 (automated|manual|mixed)
  --suite <suite>    测试套件 (game-init|bp-flow|plant-management|all)
  --help, -h         显示帮助信息

示例:
  node agents/test-coordinator.js
  node agents/test-coordinator.js --type automated --suite game-init
      `);
      process.exit(0);
    }
  }

  await runFullTestFlow(options);
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runFullTestFlow, runTesterAgent, runErrorAnalystAgent };
