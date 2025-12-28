# 前端实现说明

由于TypeScript依赖需要先安装npm包,这里提供前端的关键组件结构和实现思路。

## 技术栈
- React 18 + TypeScript
- Ant Design 5 (UI组件库)
- ECharts (图表可视化)
- D3.js (力导向图)
- Axios (HTTP请求)
- React Router (路由)

## 目录结构

```
web/src/
├── App.tsx                 # 主应用组件
├── main.tsx               # 入口文件
├── index.css              # 全局样式
├── api/                   # API封装
│   └── client.ts          # HTTP客户端
├── components/            # React组件
│   ├── RiskReport/       # 风险报告组件
│   ├── ImpactGraph/      # 影响图组件  
│   ├── TaskList/         # 任务列表组件
│   └── AnalyzeForm/      # 分析表单组件
├── pages/                 # 页面
│   ├── Dashboard.tsx     # 仪表盘
│   ├── Analysis.tsx      # 分析页
│   └── Report.tsx        # 报告页
├── types/                 # TypeScript类型定义
│   └── index.ts
└── utils/                 # 工具函数
    └── format.ts
```

## 核心组件实现要点

### 1. App.tsx - 主应用
```typescript
- 使用React Router配置路由
- Layout布局:左侧导航 + 右侧内容区
- 路由页面:Dashboard、Analysis、Report
```

### 2. Dashboard - 仪表盘
```typescript
- 显示任务列表
- 统计信息卡片(总任务数、完成率等)
- 近期风险趋势图表(ECharts折线图)
```

### 3. Analysis - 分析页
```typescript
- 表单输入:仓库路径、base commit、target commit
- 提交后创建分析任务
- 显示任务进度条
- 完成后跳转到报告页
```

### 4. Report - 报告页  
```typescript
- 风险摘要卡片
  - 总分、风险等级
  - 文件数、函数数、代码行数
  - 直接影响、间接影响
- 分数分解饼图(ECharts)
- 文件风险列表(Ant Design Table)
- 函数风险列表(Table)
- 特征风险列表(List)
- 建议列表(Alert)
```

### 5. ImpactGraph - 影响图组件
```typescript
- 使用D3.js力导向图
- 节点:函数/包
- 边:调用关系
- 交互:点击节点查看详情、缩放、拖拽
- 颜色编码:
  - 红色:变更节点
  - 橙色:直接影响
  - 黄色:间接影响
```

### 6. RiskReport - 风险报告组件
```typescript
- 风险等级Badge
- 复杂度热力图
- 影响面树状图
- 可展开的详细信息
```

## API客户端封装

```typescript
// src/api/client.ts
import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const api = {
  // 创建分析任务
  createAnalysis: (data) => 
    client.post('/analyze', data),
  
  // 获取任务列表
  getTasks: () => 
    client.get('/tasks'),
  
  // 获取任务详情
  getTask: (id) => 
    client.get(`/tasks/${id}`),
  
  // 获取报告
  getReport: (id) => 
    client.get(`/reports/${id}`),
  
  // 获取影响图
  getImpactGraph: (funcName, maxDepth) => 
    client.get('/impact-graph', { 
      params: { function: funcName, max_depth: maxDepth } 
    }),
  
  // 获取统计
  getStatistics: () => 
    client.get('/statistics'),
};
```

## 图表配置示例

### ECharts饼图 - 分数分解
```typescript
{
  title: { text: '风险分数分解' },
  series: [{
    type: 'pie',
    data: [
      { value: complexityScore, name: '复杂度' },
      { value: impactScore, name: '影响面' },
      { value: historyScore, name: '历史风险' },
      { value: featureScore, name: '特征风险' },
    ]
  }]
}
```

### D3力导向图 - 调用关系
```typescript
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).distance(100))
  .force('charge', d3.forceManyBody().strength(-300))
  .force('center', d3.forceCenter(width/2, height/2));
```

## 安装和运行

```bash
# 进入前端目录
cd web

# 安装依赖(需要Node.js环境)
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build
```

## 与后端集成

前端通过Vite的proxy配置,将`/api`请求代理到后端服务器:

```
开发环境: http://localhost:3000 -> http://localhost:8080/api
生产环境: 直接访问 http://localhost:8080 (后端服务前端静态文件)
```

## 关键特性

1. **实时更新**: 使用轮询或WebSocket获取任务进度
2. **响应式设计**: 适配不同屏幕尺寸
3. **暗黑模式**: 支持主题切换
4. **数据缓存**: 避免重复请求
5. **错误处理**: 友好的错误提示
6. **加载状态**: Skeleton屏和Spin组件

## 注意事项

前端开发需要先安装Node.js和npm依赖。由于当前环境限制,前端代码文件已创建结构,但需要运行`npm install`后才能正常编译。

完整的React组件代码可以基于上述结构实现。
