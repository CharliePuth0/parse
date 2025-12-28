# 架构设计文档

## 1. 系统概述

本系统是基于美团技术团队代码变更风险可视化系统(后羿)的设计思想,针对Go语言项目开发的代码变更风险分析工具。系统通过静态代码分析、调用关系图构建、复杂度计算等技术,对代码变更进行多维度风险评估,并提供可视化展示。

### 1.1 核心功能

1. **代码变更感知**: Git集成,自动识别变更文件、函数、代码行
2. **静态分析**: Go AST解析,符号表构建,调用关系分析
3. **风险评估**: 复杂度分析、影响面评估、特征识别
4. **可视化展示**: Web界面展示风险报告和调用关系图

### 1.2 技术特点

- **Go语言特性支持**: 接口实现追踪、Goroutine并发分析、包依赖分析
- **图数据库存储**: Neo4j存储调用关系,高效查询影响链
- **可扩展架构**: 插件化的特征检测器,易于扩展
- **RESTful API**: 支持CI/CD集成

## 2. 系统架构

### 2.1 分层架构

```
┌──────────────────────────────────────────────────────┐
│            应用层 (Application Layer)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Web UI   │  │ REST API │  │  CLI     │          │
│  └──────────┘  └──────────┘  └──────────┘          │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│           业务逻辑层 (Business Logic Layer)           │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ 风险评估器   │  │ 任务管理器   │  │ 报告生成器  │  │
│  └─────────────┘  └─────────────┘  └────────────┘  │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│            分析层 (Analysis Layer)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ AST分析  │  │ 调用图构建│  │ 特征检测  │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 复杂度分析│  │ 依赖分析  │  │ 符号表    │          │
│  └──────────┘  └──────────┘  └──────────┘          │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│           基础设施层 (Infrastructure Layer)           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Git操作  │  │ 图数据库  │  │ 配置管理  │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│  ┌──────────┐  ┌──────────┐                        │
│  │ 日志系统  │  │ 缓存系统  │                        │
│  └──────────┘  └──────────┘                        │
└──────────────────────────────────────────────────────┘
```

### 2.2 模块划分

#### 2.2.1 Git分析模块 (`internal/git`)

**职责**: Git仓库操作,变更提取

**核心组件**:
- `Analyzer`: Git仓库分析器
  - `GetChanges()`: 获取两个提交之间的变更
  - `GetFileAtCommit()`: 获取指定提交的文件内容
  - `ListGoFiles()`: 列出所有Go文件

**技术选型**: `go-git` 库

#### 2.2.2 AST分析模块 (`internal/analyzer/ast`)

**职责**: Go源代码解析,符号提取

**核心组件**:
- `Analyzer`: AST分析器
  - `ParseFile()`: 解析单个文件
  - `ExtractSymbols()`: 提取符号(函数、类型等)
  - `FindChangedFunctions()`: 查找变更的函数
  - `ExtractImports()`: 提取导入

**技术选型**: `go/ast`、`go/parser`、`golang.org/x/tools/go/packages`

#### 2.2.3 调用图模块 (`internal/analyzer/callgraph`)

**职责**: 构建函数调用关系图

**核心组件**:
- `Builder`: 调用图构建器
  - `Build()`: 构建调用图
  - `GetCallRelations()`: 获取调用关系
  - `FindCallers()`: 查找调用者
  - `FindCallees()`: 查找被调用者
  - `GetImpactChain()`: 获取影响链

**技术选型**: `golang.org/x/tools/go/callgraph`、`golang.org/x/tools/go/ssa`

**算法**: 
- 静态分析: Static Call Graph
- 类层次分析: CHA (Class Hierarchy Analysis)

#### 2.2.4 复杂度分析模块 (`internal/risk/complexity`)

**职责**: 计算代码复杂度指标

**核心组件**:
- `Analyzer`: 复杂度分析器
  - `calculateCyclomaticComplexity()`: 圈复杂度
  - `calculateCognitiveComplexity()`: 认知复杂度
  - `calculateMaintainabilityIndex()`: 可维护性指数

**指标**:
- **圈复杂度 (Cyclomatic Complexity)**: McCabe指标
- **认知复杂度 (Cognitive Complexity)**: 考虑嵌套的复杂度
- **可维护性指数 (Maintainability Index)**: 综合指标

#### 2.2.5 特征检测模块 (`internal/risk/feature`)

**职责**: 识别代码中的风险模式

**核心组件**:
- `Manager`: 特征检测管理器
- `Detector`: 检测器接口

**检测器列表**:
1. `GoroutineLeakDetector`: Goroutine泄漏
2. `ResourceLeakDetector`: 资源泄漏
3. `NilPointerDetector`: 空指针
4. `RaceConditionDetector`: 竞态条件
5. `ErrorIgnoreDetector`: 错误忽略
6. `PanicUncaughtDetector`: Panic未捕获

**扩展**: 支持自定义检测器

#### 2.2.6 风险评估模块 (`internal/risk`)

**职责**: 综合评估代码变更风险

**核心组件**:
- `Evaluator`: 风险评估器
  - `Evaluate()`: 评估风险
  - `evaluateFile()`: 文件级评估
  - `evaluateFunction()`: 函数级评估

**评估算法**:

```
总分 = α·复杂度分数 + β·影响面分数 + γ·历史风险分数 + δ·特征风险分数

其中:
α = 0.3  (复杂度权重)
β = 0.4  (影响面权重)
γ = 0.2  (历史风险权重)
δ = 0.1  (特征风险权重)
```

**归一化公式**:
- 复杂度分数: `(平均圈复杂度 / 20) × 100`
- 影响面分数: `(影响函数数 / 50) × 100`
- 特征风险分数: `(特征数量 / 20) × 100`

**风险等级**:
- Low: score < 30
- Medium: 30 ≤ score < 60
- High: 60 ≤ score < 80
- Critical: score ≥ 80

#### 2.2.7 存储模块 (`internal/storage/graph`)

**职责**: 调用关系图持久化

**核心组件**:
- `Store`: Neo4j图数据库存储
  - `SaveSymbol()`: 保存符号
  - `SaveCallRelation()`: 保存调用关系
  - `GetImpactGraph()`: 获取影响图

**数据模型**:

```cypher
// 节点类型
(Symbol {
  id, name, full_name, type, package, file,
  start_line, end_line, signature, is_exported,
  receiver_type, complexity
})

(Package {
  name
})

// 关系类型
(Symbol)-[:CALLS {type, position, count}]->(Symbol)
(Package)-[:IMPORTS {type, is_std}]->(Package)
```

**查询优化**:
- 为`id`、`full_name`、`name`、`package`创建索引
- 批量插入提高性能

#### 2.2.8 Web服务模块 (`internal/web`)

**职责**: HTTP API服务

**核心组件**:
- `Service`: 业务服务层
  - 任务管理
  - 异步分析执行
- `Handler`: HTTP处理器
  - 路由注册
  - 请求处理

**技术选型**: Gin框架

### 2.3 数据流

#### 2.3.1 分析流程

```
1. 用户提交分析请求
   ↓
2. 创建分析任务
   ↓
3. Git分析 → 提取变更文件
   ↓
4. AST解析 → 提取符号和函数
   ↓
5. 调用图构建 → 分析调用关系
   ↓
6. 特征检测 → 识别风险模式
   ↓
7. 复杂度分析 → 计算复杂度指标
   ↓
8. 风险评估 → 综合评分
   ↓
9. 生成报告
   ↓
10. 保存到图数据库
   ↓
11. 返回结果
```

#### 2.3.2 查询流程

```
用户查询影响图
   ↓
从Neo4j查询调用关系
   ↓
BFS遍历影响链
   ↓
构建图结构
   ↓
返回前端渲染
```

## 3. 核心算法

### 3.1 影响面分析算法

**目标**: 计算代码变更的影响范围

**算法**: BFS (广度优先搜索)

```go
func GetImpactChain(funcName string, maxDepth int) *ImpactGraph {
    graph := &ImpactGraph{}
    visited := make(map[string]bool)
    queue := []Node{{funcName, 0}}
    
    for len(queue) > 0 {
        current := queue[0]
        queue = queue[1:]
        
        if visited[current.name] || current.level >= maxDepth {
            continue
        }
        visited[current.name] = true
        
        // 查找调用者
        callers := FindCallers(current.name)
        for _, caller := range callers {
            queue = append(queue, Node{caller, current.level + 1})
            graph.AddEdge(caller, current.name)
        }
    }
    
    return graph
}
```

**复杂度**: O(V + E),其中V是节点数,E是边数

### 3.2 圈复杂度计算

**McCabe圈复杂度公式**: `CC = E - N + 2P`

简化实现:

```go
complexity := 1  // 基础复杂度

遍历AST:
  if 语句 → complexity++
  for/range 语句 → complexity++
  switch case → complexity++
  逻辑运算符(&& ||) → complexity++
```

### 3.3 认知复杂度计算

考虑嵌套的影响:

```go
complexity := 0
nestingLevel := 0

遍历AST:
  if/for/switch 语句:
    complexity += 1 + nestingLevel
    nestingLevel++
    递归遍历
    nestingLevel--
```

## 4. 性能优化

### 4.1 并发处理

```go
// 并发分析多个文件
var wg sync.WaitGroup
semaphore := make(chan struct{}, workers)

for _, file := range files {
    wg.Add(1)
    go func(f string) {
        defer wg.Done()
        semaphore <- struct{}{}
        defer func() { <-semaphore }()
        
        analyzeFile(f)
    }(file)
}

wg.Wait()
```

### 4.2 缓存策略

```go
// 符号表缓存
var symbolCache sync.Map

func GetSymbols(file string) []*Symbol {
    if cached, ok := symbolCache.Load(file); ok {
        return cached.([]*Symbol)
    }
    
    symbols := parseSymbols(file)
    symbolCache.Store(file, symbols)
    return symbols
}
```

### 4.3 批量数据库操作

```go
// 批量保存符号
func BatchSaveSymbols(symbols []*Symbol) error {
    // 批量插入,减少网络往返
    query := `
        UNWIND $symbols as symbol
        MERGE (s:Symbol {id: symbol.id})
        SET s = symbol
    `
    return session.Run(query, map[string]interface{}{
        "symbols": symbols,
    })
}
```

## 5. 可扩展性设计

### 5.1 插件化检测器

```go
// 自定义检测器
type CustomDetector struct{}

func (d *CustomDetector) Name() string {
    return "custom_risk"
}

func (d *CustomDetector) Detect(file *ast.File) []*FeatureRisk {
    // 实现检测逻辑
    return risks
}

// 注册
manager.RegisterDetector(&CustomDetector{})
```

### 5.2 配置驱动

```yaml
# 通过配置文件调整权重
risk:
  complexity_weight: 0.3
  impact_weight: 0.4
  
# 启用/禁用检测器
features:
  enabled:
    - goroutine_leak
    - resource_leak
```

### 5.3 API扩展

```go
// 添加新的API端点
func (h *Handler) RegisterRoutes(router *gin.Engine) {
    apiGroup := router.Group("/api")
    {
        // 标准端点
        apiGroup.POST("/analyze", h.CreateAnalysis)
        
        // 扩展端点
        apiGroup.POST("/analyze/batch", h.BatchAnalyze)
        apiGroup.GET("/metrics", h.GetMetrics)
    }
}
```

## 6. 安全性

### 6.1 输入验证

```go
// 验证仓库路径
func validateRepoPath(path string) error {
    // 防止路径遍历攻击
    if strings.Contains(path, "..") {
        return errors.New("invalid path")
    }
    
    // 检查路径是否存在
    if _, err := os.Stat(path); err != nil {
        return err
    }
    
    return nil
}
```

### 6.2 资源限制

```go
// 超时控制
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
defer cancel()

// 并发限制
semaphore := make(chan struct{}, maxWorkers)
```

## 7. 监控与日志

### 7.1 结构化日志

```go
log.WithFields(log.Fields{
    "task_id": taskID,
    "repo": repoPath,
    "status": "running",
    "progress": 50,
}).Info("Analysis in progress")
```

### 7.2 性能指标

```go
// 记录分析耗时
start := time.Now()
defer func() {
    metrics.RecordDuration("analysis_duration", time.Since(start))
}()
```

## 8. 部署架构

### 8.1 单机部署

```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │ HTTP
┌────────▼────────┐
│   Go Server     │
│   (Port 8080)   │
└────────┬────────┘
         │ Bolt
┌────────▼────────┐
│     Neo4j       │
│   (Port 7687)   │
└─────────────────┘
```

### 8.2 Docker部署

```
Docker Compose:
  - code-risk-analyzer (Go服务)
  - neo4j (图数据库)

Network: bridge
Volumes: 
  - neo4j_data
  - logs
```

## 9. 未来扩展

### 9.1 历史数据分析

- 关联历史Bug数据
- 高频变更文件识别
- 风险趋势预测

### 9.2 机器学习

- 基于历史数据训练风险预测模型
- 自动调整评估权重

### 9.3 多语言支持

- 扩展到Java、Python等语言
- 统一的分析接口

### 9.4 实时分析

- WebSocket推送分析进度
- Git hook集成,提交时自动分析

## 10. 参考资料

- [美团代码变更风险可视化系统](https://tech.meituan.com/2023/09/22/construction-and-practice-of-code-change-risk-visualization-system.html)
- [Go AST](https://pkg.go.dev/go/ast)
- [Go SSA](https://pkg.go.dev/golang.org/x/tools/go/ssa)
- [Neo4j文档](https://neo4j.com/docs/)
