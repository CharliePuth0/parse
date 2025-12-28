# Go代码变更风险可视化系统 - 完整演示指南

## 📋 目录

1. [系统部署和启动](#1-系统部署和启动)
2. [风险分析流程详解](#2-风险分析流程详解)
3. [实战演示：vArmor仓库分析](#3-实战演示varmor仓库分析)
4. [风险比较机制](#4-风险比较机制)
5. [结果解读](#5-结果解读)

---

## 1. 系统部署和启动

### 1.1 环境准备

```bash
# 检查环境
go version  # 需要 Go 1.21+
docker --version  # 需要 Docker
docker-compose --version  # 需要 Docker Compose
```

### 1.2 方式一：Docker Compose 一键部署（推荐）

#### 步骤1：启动所有服务

```bash
cd /Users/sugerdaddy/AI/tool/parse

# 启动 Neo4j 数据库 + 后端服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

**预期输出**:
```
NAME                    STATUS              PORTS
code-risk-neo4j         running             0.0.0.0:7474->7474/tcp, 0.0.0.0:7687->7687/tcp
code-risk-analyzer      running             0.0.0.0:8080->8080/tcp
```

#### 步骤2：验证服务

```bash
# 检查后端健康状态
curl http://localhost:8080/api/health

# 预期输出
{
  "status": "ok",
  "time": "2024-12-27T10:00:00Z"
}

# 检查Neo4j（浏览器访问）
open http://localhost:7474
# 用户名: neo4j
# 密码: password
```

#### 步骤3：访问Web界面

```bash
# 浏览器访问
open http://localhost:8080
```

### 1.3 方式二：本地开发模式

#### 步骤1：启动Neo4j

```bash
# 使用Docker启动Neo4j
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  -e NEO4J_dbms_memory_pagecache__size=512M \
  -e NEO4J_dbms_memory_heap_max__size=1G \
  neo4j:5.15.0

# 等待Neo4j启动完成（约10秒）
sleep 10
```

#### 步骤2：配置后端

```bash
cd /Users/sugerdaddy/AI/tool/parse

# 确认配置文件
cat configs/config.yaml

# 如果需要修改Neo4j连接信息，编辑配置
# vim configs/config.yaml
```

#### 步骤3：编译并启动后端

```bash
# 安装依赖
make install

# 编译
make build

# 运行
make run
```

**预期输出**:
```
Starting server on 0.0.0.0:8080
Connected to Neo4j successfully
API documentation: http://localhost:8080/api/health
```

### 1.4 系统组件说明

| 组件 | 端口 | 说明 |
|------|------|------|
| 后端API | 8080 | Go Web服务器，提供REST API |
| Neo4j HTTP | 7474 | Neo4j Web管理界面 |
| Neo4j Bolt | 7687 | Neo4j数据库连接端口 |

---

## 2. 风险分析流程详解

### 2.1 完整分析流程图

```
用户提交分析请求
    ↓
[1] Git变更检测
    - 解析Git仓库
    - 提取两个提交之间的diff
    - 识别变更的.go文件
    ↓
[2] Go语言静态分析
    - AST解析每个变更文件
    - 提取符号表（函数、类型、变量）
    - 识别变更的函数和方法
    ↓
[3] 调用关系图构建
    - 使用SSA构建静态调用图
    - 分析函数调用关系
    - 构建包依赖图
    ↓
[4] Go特性分析
    - 接口实现追踪
    - 包依赖变更检测
    - Goroutine并发安全检查
    ↓
[5] 复杂度计算
    - 圈复杂度（McCabe）
    - 认知复杂度（嵌套）
    - 可维护性指数
    ↓
[6] 特征风险检测
    - Goroutine泄漏
    - 资源泄漏
    - 竞态条件
    - 错误忽略
    - Panic未捕获
    - 空指针风险
    ↓
[7] 影响面分析
    - BFS遍历调用图
    - 计算直接影响（调用者数量）
    - 计算间接影响（影响链深度）
    ↓
[8] 风险评分
    总分 = 复杂度×30% + 影响面×40% + 特征×10% + 历史×20%
    ↓
[9] 生成报告
    - 文件级风险列表
    - 函数级风险列表
    - 特征风险列表
    - 改进建议
    ↓
[10] 存储到Neo4j
    - 保存符号节点
    - 保存调用关系边
    - 便于后续查询
    ↓
返回风险报告
```

### 2.2 Git变更检测机制

**核心原理**:
使用 `go-git` 库解析Git仓库，通过 `Tree.Diff()` 方法比较两个提交的文件树。

**实现细节**:

```go
// 1. 打开Git仓库
repo, _ := git.PlainOpen(repoPath)

// 2. 解析提交引用（支持分支名、标签、SHA）
baseHash := resolveCommit("main")
targetHash := resolveCommit("feature")

// 3. 获取提交树
baseTree, _ := baseCommit.Tree()
targetTree, _ := targetCommit.Tree()

// 4. 比较树，获取变更
changes, _ := baseTree.Diff(targetTree)

// 5. 过滤Go文件
for _, change := range changes {
    if strings.HasSuffix(change.To.Name, ".go") {
        // 处理变更文件
    }
}
```

**检测内容**:
- 新增文件 (Insert)
- 删除文件 (Delete)
- 修改文件 (Modify)
- 每个文件的增删行数

### 2.3 Go语言特定风险识别

#### 2.3.1 包依赖变更检测

```go
// 提取import语句
imports := astAnalyzer.ExtractImports(file)

// 对比前后版本的import差异
addedImports := newImports - oldImports
removedImports := oldImports - newImports

// 风险评估
if len(addedImports) > 5 {
    risk = "引入大量新依赖，需要评估安全性"
}
```

#### 2.3.2 接口实现追踪

```go
// 查找接口定义变更
for _, typeSpec := range file.Decls {
    if interfaceType := typeSpec.Type.(*ast.InterfaceType) {
        // 提取接口方法
        methods := extractInterfaceMethods(interfaceType)
        
        // 查找所有实现该接口的类型
        implementations := findImplementations(interfaceName)
        
        // 评估影响
        risk = len(implementations) * methodChangeCount
    }
}
```

**风险点**:
- 接口新增方法 → 所有实现者需要更新
- 接口方法签名变更 → 破坏兼容性
- 删除接口方法 → 可能导致编译错误

#### 2.3.3 并发安全检查

```go
// 检测Goroutine使用
func detectGoroutineLeak(funcDecl *ast.FuncDecl) {
    hasGoroutine := false
    hasContext := false
    hasChannel := false
    
    ast.Inspect(funcDecl.Body, func(n ast.Node) bool {
        // 检测 go 语句
        if _, ok := n.(*ast.GoStmt); ok {
            hasGoroutine = true
        }
        
        // 检测 context.Context
        if ident.Name == "context" || ident.Name == "ctx" {
            hasContext = true
        }
        
        // 检测 channel 或 done
        if strings.Contains(ident.Name, "done") {
            hasChannel = true
        }
    })
    
    // 风险评估
    if hasGoroutine && !hasContext && !hasChannel {
        return "Goroutine可能泄漏，缺少退出机制"
    }
}
```

**检测项**:
- ✅ Goroutine是否有退出机制（context/done channel）
- ✅ 共享变量是否有互斥锁保护
- ✅ Channel是否正确关闭
- ✅ WaitGroup是否正确使用

#### 2.3.4 Error处理检查

```go
// 检测错误被忽略
func detectErrorIgnore(file *ast.File) {
    ast.Inspect(file, func(n ast.Node) bool {
        if assign := n.(*ast.AssignStmt) {
            for i, lhs := range assign.Lhs {
                // 检查是否用 _ 忽略返回值
                if ident.Name == "_" {
                    if isErrorReturn(assign.Rhs[i]) {
                        locations = append(locations, position)
                    }
                }
            }
        }
    })
}
```

### 2.4 风险评分算法工作原理

#### 2.4.1 评分公式

```
总分 = α×复杂度分数 + β×影响面分数 + γ×历史分数 + δ×特征分数

默认权重:
α = 0.3 (复杂度权重)
β = 0.4 (影响面权重)
γ = 0.2 (历史风险权重)
δ = 0.1 (特征风险权重)
```

#### 2.4.2 各项分数计算

**复杂度分数** (0-100):

```go
// 圈复杂度归一化
avgComplexity := totalComplexity / funcCount
complexityScore := (avgComplexity / 20.0) * 100

// 圈复杂度阈值
// CC ≤ 5: 简单
// 5 < CC ≤ 10: 中等
// 10 < CC ≤ 20: 复杂
// CC > 20: 极其复杂
```

**影响面分数** (0-100):

```go
// 直接影响 = 调用该函数的函数数量
directImpact := len(FindCallers(funcName))

// 间接影响 = BFS遍历影响链
indirectImpact := BFSTraversal(funcName, maxDepth=10)

// 总影响
totalImpact := directImpact * 2 + indirectImpact

// 归一化
impactScore := (totalImpact / 50.0) * 100
```

**特征分数** (0-100):

```go
// 根据检测到的风险特征数量
featureScore := (featureCount / 20.0) * 100

// 严重性加权
for feature := range features {
    switch feature.Severity {
    case "high":
        weight = 3
    case "medium":
        weight = 2
    case "low":
        weight = 1
    }
}
```

#### 2.4.3 风险等级判定

```go
func getRiskLevel(score float64) string {
    if score < 30 {
        return "low"      // 低风险：绿色
    } else if score < 60 {
        return "medium"   // 中风险：黄色
    } else if score < 80 {
        return "high"     // 高风险：橙色
    }
    return "critical"     // 严重风险：红色
}
```

### 2.5 调用关系图构建过程

#### 2.5.1 SSA构建

```go
// 1. 加载Go包
cfg := &packages.Config{
    Mode: packages.NeedTypes | packages.NeedSyntax | packages.NeedTypesInfo,
}
pkgs, _ := packages.Load(cfg, pkgPath)

// 2. 构建SSA程序
prog, ssaPkgs := ssautil.AllPackages(pkgs, ssa.InstantiateGenerics)
prog.Build()

// 3. 使用静态分析构建调用图
callGraph := static.CallGraph(prog)
```

**SSA (Static Single Assignment)** 是什么？
- 中间表示形式，每个变量只赋值一次
- 便于分析数据流和控制流
- Go标准库 `golang.org/x/tools/go/ssa` 提供

#### 2.5.2 调用关系提取

```go
// 遍历调用图
for _, node := range callGraph.Nodes {
    caller := node.Func.Name()
    
    for _, edge := range node.Out {
        callee := edge.Callee.Func.Name()
        
        relation := &CallRelation{
            From: caller,
            To: callee,
            Type: getCallType(edge),  // direct, goroutine, defer
            Position: getPosition(edge),
        }
    }
}
```

#### 2.5.3 影响链BFS遍历

```go
func GetImpactChain(funcName string, maxDepth int) *ImpactGraph {
    visited := make(map[string]bool)
    queue := []Node{{funcName, 0}}
    graph := &ImpactGraph{}
    
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

**输出**: 影响图包含nodes(节点)和edges(边)，可用于前端D3.js渲染。

---

## 3. 实战演示：vArmor仓库分析

### 3.1 准备分析

#### 步骤1：查看vArmor仓库基本信息

```bash
cd /Users/sugerdaddy/ai/tool/vArmor

# 查看项目结构
ls -la

# 查看分支
git branch -a

# 查看最近的提交
git log --oneline -10

# 统计Go代码行数
find . -name "*.go" | xargs wc -l | tail -1
```

#### 步骤2：选择分析目标

```bash
# 假设我们要分析最近一次提交相对于前一次的变更
BASE_COMMIT="HEAD~1"
TARGET_COMMIT="HEAD"

# 或者分析某个分支相对于main的变更
BASE_COMMIT="main"
TARGET_COMMIT="develop"

# 查看将要分析的变更
git diff --stat $BASE_COMMIT $TARGET_COMMIT
```

### 3.2 执行分析

#### 方式一：通过API

```bash
# 创建分析任务
curl -X POST http://localhost:8080/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repo_path": "/Users/sugerdaddy/ai/tool/vArmor",
    "base_commit": "HEAD~1",
    "target_commit": "HEAD"
  }' | jq .

# 预期输出
{
  "success": true,
  "data": {
    "id": "task_1703750400000000000",
    "repo_path": "/Users/sugerdaddy/ai/tool/vArmor",
    "base_commit": "HEAD~1",
    "target_commit": "HEAD",
    "status": "pending",
    "progress": 0,
    "created_at": "2024-12-27T18:00:00Z"
  }
}

# 保存任务ID
TASK_ID="task_1703750400000000000"
```

#### 步骤3：监控分析进度

```bash
# 查询任务状态
while true; do
    STATUS=$(curl -s http://localhost:8080/api/tasks/$TASK_ID | jq -r '.data.status')
    PROGRESS=$(curl -s http://localhost:8080/api/tasks/$TASK_ID | jq -r '.data.progress')
    
    echo "状态: $STATUS, 进度: $PROGRESS%"
    
    if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
        break
    fi
    
    sleep 2
done
```

**分析阶段说明**:
- 10%: Git变更分析完成
- 30%: AST解析完成
- 50%: 调用图构建完成
- 70%: 风险评估完成
- 90%: 保存到数据库
- 100%: 分析完成

### 3.3 获取分析报告

```bash
# 获取完整报告
curl -s http://localhost:8080/api/reports/$TASK_ID | jq . > varmor_risk_report.json

# 查看报告摘要
curl -s http://localhost:8080/api/reports/$TASK_ID | jq '.data.summary'
```

**报告摘要示例**:

```json
{
  "total_score": 65.8,
  "level": "high",
  "files_changed": 8,
  "funcs_changed": 23,
  "lines_changed": 456,
  "direct_impact": 15,
  "indirect_impact": 47,
  "score_breakdown": {
    "complexity_score": 45.5,
    "impact_score": 72.3,
    "history_score": 0,
    "feature_score": 35.0
  }
}
```

**解读**:
- 总分65.8，属于**高风险**（60-80区间）
- 变更了8个文件，23个函数，456行代码
- 直接影响15个调用方，间接影响47个
- 影响面分数最高（72.3），说明变更影响范围大

### 3.4 详细分析结果

#### 3.4.1 查看高风险文件

```bash
# 提取高风险文件
curl -s http://localhost:8080/api/reports/$TASK_ID | \
  jq '.data.files[] | select(.level == "high" or .level == "critical")'
```

**示例输出**:

```json
{
  "path": "internal/controller/manager.go",
  "score": 78.5,
  "level": "high",
  "change_type": "modified",
  "complexity": 45,
  "impact_count": 12,
  "issues": [
    "文件复杂度较高",
    "影响范围较大"
  ]
}
```

#### 3.4.2 查看高风险函数

```bash
# 提取高风险函数
curl -s http://localhost:8080/api/reports/$TASK_ID | \
  jq '.data.functions[] | select(.score > 70) | {name, score, level, complexity, direct_impact}'
```

**示例输出**:

```json
{
  "name": "ReconcileAppArmorProfile",
  "score": 82.3,
  "level": "high",
  "complexity": 18,
  "direct_impact": 8,
  "indirect_impact": 23,
  "issues": [
    "圈复杂度过高(18)，建议重构",
    "直接影响8个调用方，需要充分测试"
  ]
}
```

**风险分析**:
- 圈复杂度18，超过建议阈值10
- 8个直接调用方，23个间接影响
- 建议拆分函数，降低复杂度

#### 3.4.3 查看特征风险

```bash
# 查看检测到的风险特征
curl -s http://localhost:8080/api/reports/$TASK_ID | \
  jq '.data.features[]'
```

**示例输出**:

```json
{
  "type": "goroutine_leak",
  "severity": "medium",
  "count": 3,
  "locations": [
    "internal/worker/processor.go:145",
    "internal/worker/scheduler.go:89",
    "pkg/reconciler/handler.go:234"
  ],
  "description": "检测到可能存在的goroutine泄漏风险:goroutine没有退出机制",
  "suggestion": "建议使用context或done channel来控制goroutine的生命周期"
}
```

```json
{
  "type": "error_ignore",
  "severity": "medium",
  "count": 5,
  "locations": [
    "internal/controller/manager.go:67",
    "pkg/client/client.go:123"
  ],
  "description": "检测到错误被忽略:使用_丢弃error返回值",
  "suggestion": "建议检查并处理所有error返回值"
}
```

#### 3.4.4 查看改进建议

```bash
# 查看系统生成的建议
curl -s http://localhost:8080/api/reports/$TASK_ID | \
  jq '.data.recommendations[]'
```

**示例输出**:

```
"⚠️ 此次变更风险等级为高，建议进行全面的代码审查"
"变更影响范围较大，建议充分测试所有相关调用方"
"检测到5个潜在风险特征，请重点关注"
"存在3个高风险函数，建议优先测试这些函数"
"代码复杂度较高，建议重构以降低复杂度"
```

### 3.5 可视化分析

#### 3.5.1 查看调用关系图

```bash
# 获取某个高风险函数的影响图
FUNC_NAME="github.com/bytedance/vArmor/internal/controller.ReconcileAppArmorProfile"

curl -s "http://localhost:8080/api/impact-graph?function=$FUNC_NAME&max_depth=5" | \
  jq . > impact_graph.json
```

**影响图数据结构**:

```json
{
  "nodes": [
    {
      "id": "github.com/bytedance/vArmor/internal/controller.ReconcileAppArmorProfile",
      "label": "ReconcileAppArmorProfile",
      "type": "function",
      "is_change": true,
      "level": 0
    },
    {
      "id": "github.com/bytedance/vArmor/internal/controller.Reconcile",
      "label": "Reconcile",
      "type": "function",
      "is_change": false,
      "level": 1
    }
  ],
  "edges": [
    {
      "from": "github.com/bytedance/vArmor/internal/controller.Reconcile",
      "to": "github.com/bytedance/vArmor/internal/controller.ReconcileAppArmorProfile",
      "type": "call",
      "weight": 1
    }
  ]
}
```

**可视化说明**:
- 红色节点：变更的函数
- 橙色节点：直接影响（level=1）
- 黄色节点：间接影响（level>1）
- 箭头：调用关系

#### 3.5.2 在Neo4j中查询

```bash
# 访问Neo4j浏览器
open http://localhost:7474

# 登录后执行Cypher查询
```

**Cypher查询示例**:

```cypher
// 1. 查看所有变更的函数
MATCH (s:Symbol)
WHERE s.package CONTAINS 'vArmor'
RETURN s.name, s.complexity, s.file
ORDER BY s.complexity DESC
LIMIT 10

// 2. 查找某个函数的所有调用者
MATCH (caller:Symbol)-[:CALLS]->(target:Symbol {name: 'ReconcileAppArmorProfile'})
RETURN caller.name, caller.file

// 3. 查找影响链（3层）
MATCH path = (caller:Symbol)-[:CALLS*1..3]->(target:Symbol {name: 'ReconcileAppArmorProfile'})
RETURN path
LIMIT 50

// 4. 找出最复杂的函数
MATCH (s:Symbol)
WHERE s.type = 'function' AND s.complexity > 15
RETURN s.name, s.complexity, s.file
ORDER BY s.complexity DESC

// 5. 找出影响最大的函数（被调用次数最多）
MATCH (s:Symbol)<-[r:CALLS]-()
RETURN s.name, COUNT(r) as call_count
ORDER BY call_count DESC
LIMIT 10
```

### 3.6 生成报告摘要

```bash
# 生成人类可读的报告
cat << 'EOF' > generate_summary.sh
#!/bin/bash

TASK_ID=$1
REPORT=$(curl -s http://localhost:8080/api/reports/$TASK_ID)

echo "========================================"
echo "  vArmor 代码变更风险分析报告"
echo "========================================"
echo ""
echo "📊 总体评估"
echo "----------------------------------------"
echo "风险分数: $(echo $REPORT | jq -r '.data.summary.total_score')"
echo "风险等级: $(echo $REPORT | jq -r '.data.summary.level')"
echo "变更文件: $(echo $REPORT | jq -r '.data.summary.files_changed')"
echo "变更函数: $(echo $REPORT | jq -r '.data.summary.funcs_changed')"
echo "代码行数: $(echo $REPORT | jq -r '.data.summary.lines_changed')"
echo ""
echo "📈 影响面分析"
echo "----------------------------------------"
echo "直接影响: $(echo $REPORT | jq -r '.data.summary.direct_impact') 个调用方"
echo "间接影响: $(echo $REPORT | jq -r '.data.summary.indirect_impact') 个函数"
echo ""
echo "🔍 风险分解"
echo "----------------------------------------"
echo "复杂度分数: $(echo $REPORT | jq -r '.data.summary.score_breakdown.complexity_score')"
echo "影响面分数: $(echo $REPORT | jq -r '.data.summary.score_breakdown.impact_score')"
echo "特征分数: $(echo $REPORT | jq -r '.data.summary.score_breakdown.feature_score')"
echo ""
echo "⚠️ 高风险文件 TOP 5"
echo "----------------------------------------"
echo $REPORT | jq -r '.data.files[] | select(.score > 60) | "\(.path): \(.score) (\(.level))"' | head -5
echo ""
echo "⚠️ 高风险函数 TOP 5"
echo "----------------------------------------"
echo $REPORT | jq -r '.data.functions[] | select(.score > 70) | "\(.name): \(.score) (复杂度:\(.complexity))"' | head -5
echo ""
echo "🐛 检测到的风险特征"
echo "----------------------------------------"
echo $REPORT | jq -r '.data.features[] | "[\(.severity)] \(.type): \(.count)个位置"'
echo ""
echo "💡 改进建议"
echo "----------------------------------------"
echo $REPORT | jq -r '.data.recommendations[]'
echo ""
EOF

chmod +x generate_summary.sh
./generate_summary.sh $TASK_ID
```

---

## 4. 风险比较机制

### 4.1 比较两个变更的风险

假设我们要比较两个不同的PR或分支:

```bash
# 分析 PR #123
curl -X POST http://localhost:8080/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repo_path": "/Users/sugerdaddy/ai/tool/vArmor",
    "base_commit": "main",
    "target_commit": "feature/pr-123"
  }' | jq -r '.data.id'
# 输出: task_pr123

# 分析 PR #124
curl -X POST http://localhost:8080/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repo_path": "/Users/sugerdaddy/ai/tool/vArmor",
    "base_commit": "main",
    "target_commit": "feature/pr-124"
  }' | jq -r '.data.id'
# 输出: task_pr124
```

### 4.2 对比分析结果

```bash
# 获取两个报告的摘要
PR123_SCORE=$(curl -s http://localhost:8080/api/reports/task_pr123 | jq '.data.summary.total_score')
PR124_SCORE=$(curl -s http://localhost:8080/api/reports/task_pr124 | jq '.data.summary.total_score')

echo "PR #123 风险分数: $PR123_SCORE"
echo "PR #124 风险分数: $PR124_SCORE"

# 比较
if (( $(echo "$PR123_SCORE > $PR124_SCORE" | bc -l) )); then
    echo "结论: PR #123 风险更高"
else
    echo "结论: PR #124 风险更高"
fi
```

### 4.3 详细对比维度

创建对比脚本:

```bash
cat << 'EOF' > compare_risks.sh
#!/bin/bash

TASK1=$1
TASK2=$2

echo "======================================"
echo "  风险对比分析"
echo "======================================"
echo ""

# 获取报告
R1=$(curl -s http://localhost:8080/api/reports/$TASK1)
R2=$(curl -s http://localhost:8080/api/reports/$TASK2)

# 总分对比
echo "📊 总体风险"
echo "--------------------------------------"
printf "%-20s %10s %10s\n" "指标" "任务1" "任务2"
printf "%-20s %10.1f %10.1f\n" "总分" \
    $(echo $R1 | jq '.data.summary.total_score') \
    $(echo $R2 | jq '.data.summary.total_score')
printf "%-20s %10s %10s\n" "等级" \
    $(echo $R1 | jq -r '.data.summary.level') \
    $(echo $R2 | jq -r '.data.summary.level')
echo ""

# 变更规模对比
echo "📈 变更规模"
echo "--------------------------------------"
printf "%-20s %10d %10d\n" "变更文件" \
    $(echo $R1 | jq '.data.summary.files_changed') \
    $(echo $R2 | jq '.data.summary.files_changed')
printf "%-20s %10d %10d\n" "变更函数" \
    $(echo $R1 | jq '.data.summary.funcs_changed') \
    $(echo $R2 | jq '.data.summary.funcs_changed')
printf "%-20s %10d %10d\n" "代码行数" \
    $(echo $R1 | jq '.data.summary.lines_changed') \
    $(echo $R2 | jq '.data.summary.lines_changed')
echo ""

# 分数分解对比
echo "🔍 风险分解"
echo "--------------------------------------"
printf "%-20s %10.1f %10.1f\n" "复杂度分数" \
    $(echo $R1 | jq '.data.summary.score_breakdown.complexity_score') \
    $(echo $R2 | jq '.data.summary.score_breakdown.complexity_score')
printf "%-20s %10.1f %10.1f\n" "影响面分数" \
    $(echo $R1 | jq '.data.summary.score_breakdown.impact_score') \
    $(echo $R2 | jq '.data.summary.score_breakdown.impact_score')
printf "%-20s %10.1f %10.1f\n" "特征分数" \
    $(echo $R1 | jq '.data.summary.score_breakdown.feature_score') \
    $(echo $R2 | jq '.data.summary.score_breakdown.feature_score')
echo ""

# 影响面对比
echo "🌐 影响面"
echo "--------------------------------------"
printf "%-20s %10d %10d\n" "直接影响" \
    $(echo $R1 | jq '.data.summary.direct_impact') \
    $(echo $R2 | jq '.data.summary.direct_impact')
printf "%-20s %10d %10d\n" "间接影响" \
    $(echo $R1 | jq '.data.summary.indirect_impact') \
    $(echo $R2 | jq '.data.summary.indirect_impact')
echo ""

# 特征风险对比
echo "🐛 风险特征数量"
echo "--------------------------------------"
printf "%-20s %10d %10d\n" "总特征数" \
    $(echo $R1 | jq '.data.features | length') \
    $(echo $R2 | jq '.data.features | length')
echo ""

EOF

chmod +x compare_risks.sh
```

**使用示例**:

```bash
./compare_risks.sh task_pr123 task_pr124
```

**输出示例**:

```
======================================
  风险对比分析
======================================

📊 总体风险
--------------------------------------
指标                      任务1      任务2
总分                      65.8       42.3
等级                      high       medium

📈 变更规模
--------------------------------------
变更文件                     8          5
变更函数                    23         12
代码行数                   456        234

🔍 风险分解
--------------------------------------
复杂度分数               45.5       32.1
影响面分数               72.3       48.6
特征分数                 35.0       25.0

🌐 影响面
--------------------------------------
直接影响                    15          8
间接影响                    47         23

🐛 风险特征数量
--------------------------------------
总特征数                     5          3
```

**结论**: PR #123 风险明显更高，主要体现在影响面更大（72.3 vs 48.6）。

### 4.4 风险等级判断标准

| 分数区间 | 等级 | 颜色 | 说明 | 建议 |
|---------|------|------|------|------|
| 0-30 | Low | 🟢 绿色 | 低风险，变更影响小 | 基本测试即可 |
| 30-60 | Medium | 🟡 黄色 | 中等风险，需要注意 | 进行常规测试和代码审查 |
| 60-80 | High | 🟠 橙色 | 高风险，需要重点关注 | 全面测试，详细审查，考虑拆分 |
| 80-100 | Critical | 🔴 红色 | 严重风险，非常危险 | 强烈建议拆分变更，增加集成测试 |

---

## 5. 结果解读

### 5.1 报告结构说明

完整报告包含以下部分:

```json
{
  "task_id": "任务ID",
  "generated_at": "生成时间",
  "summary": { /* 摘要 */ },
  "files": [ /* 文件风险列表 */ ],
  "functions": [ /* 函数风险列表 */ ],
  "features": [ /* 特征风险列表 */ ],
  "recommendations": [ /* 改进建议 */ ]
}
```

### 5.2 各字段含义

#### 5.2.1 Summary（摘要）

| 字段 | 含义 | 解读 |
|------|------|------|
| total_score | 总风险分数 | 0-100，越高风险越大 |
| level | 风险等级 | low/medium/high/critical |
| files_changed | 变更文件数 | 变更的.go文件数量 |
| funcs_changed | 变更函数数 | 新增+修改+删除的函数数 |
| lines_changed | 变更行数 | 增加+删除的代码行数 |
| direct_impact | 直接影响 | 变更函数的直接调用者数量 |
| indirect_impact | 间接影响 | 通过调用链间接影响的函数数 |

#### 5.2.2 Score Breakdown（分数分解）

| 分数 | 含义 | 高分原因 | 改进建议 |
|------|------|---------|---------|
| complexity_score | 复杂度分数 | 圈复杂度高，嵌套深 | 拆分函数，减少分支 |
| impact_score | 影响面分数 | 调用者多，影响链深 | 评估影响范围，充分测试 |
| history_score | 历史风险分数 | 高频变更文件，历史Bug多 | 重点关注这些文件 |
| feature_score | 特征风险分数 | 检测到多个风险模式 | 修复检测到的问题 |

#### 5.2.3 File Risk（文件风险）

```json
{
  "path": "文件路径",
  "score": 78.5,           // 文件风险分数
  "level": "high",         // 风险等级
  "change_type": "modified", // added/modified/deleted
  "complexity": 45,        // 文件总复杂度
  "impact_count": 12,      // 影响的调用方数量
  "issues": [              // 发现的问题
    "文件复杂度较高",
    "影响范围较大"
  ]
}
```

**阅读建议**:
- 优先关注 `level` 为 high 或 critical 的文件
- 查看 `issues` 了解具体问题
- 结合 `complexity` 和 `impact_count` 评估修改难度

#### 5.2.4 Function Risk（函数风险）

```json
{
  "name": "ReconcileAppArmorProfile",
  "full_name": "github.com/bytedance/vArmor/internal/controller.ReconcileAppArmorProfile",
  "file": "internal/controller/manager.go",
  "line": 145,
  "score": 82.3,
  "level": "high",
  "complexity": 18,
  "direct_impact": 8,
  "indirect_impact": 23,
  "change_type": "modified",
  "impact_path": [         // 影响路径（前3层）
    "github.com/bytedance/vArmor/internal/controller.Reconcile",
    "github.com/bytedance/vArmor/cmd/manager.Run"
  ],
  "features": [            // 检测到的风险特征
    "error_ignore"
  ],
  "issues": [
    "圈复杂度过高(18)，建议重构",
    "直接影响8个调用方，需要充分测试"
  ]
}
```

**关键指标解读**:

1. **complexity**（圈复杂度）:
   - ≤ 5: 简单，容易维护 ✅
   - 6-10: 中等，可接受 ⚠️
   - 11-20: 复杂，建议重构 🔶
   - > 20: 极其复杂，必须重构 🔴

2. **direct_impact**（直接影响）:
   - 0-3: 影响小 ✅
   - 4-10: 影响中等 ⚠️
   - 11-20: 影响大 🔶
   - > 20: 影响非常大 🔴

3. **indirect_impact**（间接影响）:
   - 通过调用链计算
   - 值越大说明影响范围越广
   - 需要评估整个调用链路

#### 5.2.5 Feature Risk（特征风险）

```json
{
  "type": "goroutine_leak",
  "severity": "medium",
  "count": 3,
  "locations": [
    "internal/worker/processor.go:145",
    "internal/worker/scheduler.go:89"
  ],
  "description": "检测到可能存在的goroutine泄漏风险",
  "suggestion": "建议使用context或done channel来控制goroutine的生命周期"
}
```

**特征类型说明**:

| 类型 | 严重性 | 说明 | 修复方法 |
|------|--------|------|---------|
| goroutine_leak | Medium | Goroutine可能无法退出 | 添加context或done channel |
| resource_leak | High | 文件/连接未关闭 | 使用defer close() |
| race_condition | High | 并发竞态条件 | 添加互斥锁 |
| error_ignore | Medium | 错误被忽略 | 检查并处理error |
| panic_uncaught | High | Panic未被捕获 | 添加recover() |
| nil_pointer | High | 可能的空指针 | 添加nil检查 |

### 5.3 可视化图表解读

#### 5.3.1 风险分数饼图

```
ECharts饼图配置:
- 复杂度（30%权重）: 蓝色
- 影响面（40%权重）: 橙色
- 历史风险（20%权重）: 绿色
- 特征风险（10%权重）: 红色
```

**解读方法**:
- 看哪个扇区最大，说明该维度分数最高
- 如果影响面扇区最大 → 说明变更影响范围大
- 如果复杂度扇区最大 → 说明代码复杂度高

#### 5.3.2 调用关系力导向图

```
D3.js力导向图:
- 节点大小 ∝ 函数复杂度
- 节点颜色:
  * 红色: 变更的函数
  * 橙色: 直接影响（level=1）
  * 黄色: 间接影响（level=2+）
  * 灰色: 未影响
- 边: 调用关系，箭头指向被调用者
```

**交互操作**:
- 拖拽节点：查看调用关系
- 点击节点：查看函数详情
- 缩放：查看整体或局部
- 悬停：显示函数名和统计信息

### 5.4 决策建议

根据风险等级采取不同行动:

#### Low (0-30分) 🟢
- ✅ **可以合并**: 风险可控
- **测试**: 基本的单元测试
- **审查**: 常规Code Review
- **发布**: 可以正常发布

#### Medium (30-60分) 🟡
- ⚠️ **谨慎合并**: 需要评估
- **测试**: 单元测试 + 集成测试
- **审查**: 详细Code Review，关注影响面
- **发布**: 建议灰度发布

#### High (60-80分) 🟠
- 🔶 **建议优化后合并**: 风险较高
- **测试**: 全面测试，包括边界情况
- **审查**: 严格Code Review，多人参与
- **发布**: 必须灰度发布，逐步放量
- **监控**: 加强监控告警

#### Critical (80-100分) 🔴
- 🚫 **强烈建议拆分**: 风险很高
- **行动**:
  1. 拆分成多个小的PR
  2. 每个PR单独测试和发布
  3. 增加E2E测试覆盖
  4. 准备回滚方案
- **审查**: 架构师参与审查
- **发布**: 分阶段发布，充分验证

### 5.5 实用技巧

#### 技巧1: 识别关键路径

```bash
# 找出影响最大的函数
curl -s http://localhost:8080/api/reports/$TASK_ID | \
  jq '.data.functions[] | select(.direct_impact > 10) | .name'
```

这些函数是关键路径，需要重点测试。

#### 技巧2: 优先修复高严重性特征

```bash
# 列出所有高严重性特征
curl -s http://localhost:8080/api/reports/$TASK_ID | \
  jq '.data.features[] | select(.severity == "high")'
```

优先修复这些问题可以显著降低风险分数。

#### 技巧3: 评估是否需要拆分

```bash
# 计算拆分建议分数
TOTAL_SCORE=$(curl -s http://localhost:8080/api/reports/$TASK_ID | jq '.data.summary.total_score')
FUNC_COUNT=$(curl -s http://localhost:8080/api/reports/$TASK_ID | jq '.data.summary.funcs_changed')

if (( $(echo "$TOTAL_SCORE > 70 && $FUNC_COUNT > 15" | bc -l) )); then
    echo "建议: 变更过大，建议拆分成2-3个PR"
fi
```

---

## 6. 总结

这个Go代码变更风险可视化系统提供了:

1. **全面的风险评估**: 从复杂度、影响面、特征等多个维度
2. **量化的指标**: 清晰的分数和等级
3. **可操作的建议**: 具体的改进方向
4. **可视化展示**: 直观的图表和调用关系图
5. **CI/CD集成**: RESTful API支持自动化

通过系统化的分析，可以在代码合并前识别潜在风险，提高代码质量，减少线上故障。

---

**演示完成！** 🎉

如有问题，可以查看:
- API文档: `docs/API.md`
- 架构文档: `docs/ARCHITECTURE.md`
- 用户指南: `docs/USER_GUIDE.md`
