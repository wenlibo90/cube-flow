# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [运维部署|构建方法|测试方法|排错调试|工作流协作|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 条目

[项目知识摘要]
- Date: 2026-11-04
- Context: Agent 搭建魔方扫描还原网站时发现
- Category: 构建方法
- Instructions:
  - 构建命令：`npm run build`
  - 项目为纯前端 Vite 应用，无后端依赖；相机识别与求解均在浏览器本地运行。
  - 预览时应使用生产构建，避免开发模式内存峰值：先执行 `npm run build`，再执行 `npm run preview -- --port 4174`。
  - Three.js 预览通过动态加载引入，生产构建会生成独立的 cube-view chunk。
  - 求解器运行在 Web Worker 中，使用 `src/vendor/cubejs` 的本地化版本。
