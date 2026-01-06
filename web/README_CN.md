# 前端指南 (Frontend Guide)

本项目的 `web/` 目录包含了一个现代化的 React 前端应用，用于可视化代码变更风险。

## 技术栈

- **框架**: React 18
- **构建工具**: Vite
- **样式**: Tailwind CSS v4
- **可视化**: React Flow, Recharts
- **图标**: Lucide React
- **网络请求**: Axios

## 目录结构

```
web/
├── src/
│   ├── api/            # API 客户端封装
│   ├── components/     # UI 组件 (GraphCanvas, Layout等)
│   ├── pages/          # 页面组件
│   │   ├── HomePage    # 仪表盘
│   │   ├── AnalysisPage # 分析任务管理
│   │   ├── GraphPage   # 调用图可视化
│   │   └── ReportPage  # 风险报告详情
│   ├── hooks/          # 自定义 Hooks
│   ├── utils/          # 工具函数
│   └── App.jsx         # 路由配置
├── dist/               # 生产构建产物
└── ...配置文件
```

## 开发与构建

### 安装依赖

```bash
cd web
npm install
```

### 启动开发服务器

```bash
npm run dev
# 访问 http://localhost:3000
```

### 构建生产版本

```bash
npm run build
# 构建产物将输出到 dist/ 目录
```

## 功能模块

1. **Dashboard (仪表盘)**: 展示系统整体统计数据和其运行状态。
2. **Analysis (分析)**: 提交新的 Git 仓库路径和提交 ID 进行分析，并监控任务进度。
3. **Call Graph (调用图)**: 全景展示代码仓库的函数调用关系，支持交互式缩放和拖拽。
4. **Reports (报告)**: 详细展示代码变更的风险评分、复杂度分析、影响面评估以及改进建议。

## 与后端集成

前端通过 `/api` 路径与 Go 后端通信。在开发模式下，Vite 配置了代理将 `/api` 请求转发到 `http://localhost:8080`。在生产模式下，Go 后端直接托管 `dist/` 静态文件并处理 API 请求。
