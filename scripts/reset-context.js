#!/usr/bin/env node

/**
 * 快速上下文重置脚本
 *
 * 用途：帮助在新对话中快速了解项目上下文
 * 使用：node scripts/reset-context.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLAUDE_MD_PATH = path.join(__dirname, '..', 'CLAUDE.md');

console.log('\n' + '='.repeat(70));
console.log('  🔄 上下文重置 - 项目信息卡片');
console.log('='.repeat(70) + '\n');

// 读取CLAUDE.md
try {
  const claudeMd = fs.readFileSync(CLAUDE_MD_PATH, 'utf-8');

  // 提取关键信息
  const sections = {
    '项目名称': 'BP植物对战辅助工具',
    '技术栈': 'Vue 3 + Pinia + Vite + Tailwind CSS',
    '测试系统': 'Agent Testing System (Playwright)',
  };

  // 显示关键信息
  console.log('📋 项目概览:\n');
  Object.entries(sections).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  console.log('\n⚡ 快速命令:\n');
  console.log('  npm run dev          # 启动开发服务器');
  console.log('  npm run test:quick   # 快速测试');
  console.log('  npm run test:agents  # 完整Agent测试\n');

  console.log('📚 重要文件:\n');
  console.log('  CLAUDE.md            # 项目文档（完整）');
  console.log('  agents/README.md     # Agent测试系统文档');
  console.log('  agents/QUICKSTART.md # 快速参考\n');

  console.log('🎯 核心功能:\n');
  console.log('  ✅ 动态BP顺序（基于道路选择）');
  console.log('  ✅ 植物禁用/选择流程（4阶段，20步）');
  console.log('  ✅ 自定义植物管理（IndexedDB存储）');
  console.log('  ✅ 自动化测试系统\n');

  console.log('🤖 Agent测试系统:\n');
  console.log('  - Test Coordinator: 测试协调器');
  console.log('  - Tester Agent: 执行Playwright测试');
  console.log('  - Error Analyst: 分析错误并提供修复建议\n');

  // 生成可复制粘贴的提示词
  console.log('💬 复制以下内容给新对话的Claude:\n');
  console.log('─'.repeat(70));
  console.log(`
我刚打开了项目 "BP植物对战辅助工具"。

请阅读 CLAUDE.md 了解项目架构。

当前状态：
- 开发服务器: 运行在 http://localhost:3001
- 测试系统: Agent Testing System 已配置
- 最近完成: 基础测试和植物显示测试验证

请问我如何帮助你？
`.trim());
  console.log('\n' + '─'.repeat(70));

  console.log('\n✅ 上下文信息已加载！');
  console.log('💡 提示: 在新对话中，直接复制上面的提示词给Claude即可快速开始\n');

} catch (error) {
  console.error('❌ 无法读取CLAUDE.md:', error.message);
  process.exit(1);
}
