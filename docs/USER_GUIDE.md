# 使用指南

## 快速开始

### 1. 环境准备

#### 必需环境
- **Go 1.21+**: [下载安装](https://golang.org/dl/)
- **Neo4j 5.0+**: [下载安装](https://neo4j.com/download/) 或使用Docker
- **Git**: 用于代码仓库分析

#### 可选环境(前端开发)
- **Node.js 18+**: [下载安装](https://nodejs.org/)
- **npm** 或 **yarn**: Node.js包管理器

### 2. 安装部署

#### 方式一: 本地运行

```bash
# 1. 克隆项目
git clone https://github.com/sugerdaddy/go-code-risk-analyzer.git
cd go-code-risk-analyzer

# 2. 启动Neo4j数据库(使用Docker)
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5.15.0

# 3. 配置数据库连接
# 编辑 configs/config.yaml,修改neo4j配置

# 4. 安装依赖并运行
make install
make run
```

#### 方式二: Docker Compose(推荐)

```bash
# 一键启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 3. 访问服务

- **Web界面**: http://localhost:8080
- **API接口**: http://localhost:8080/api
- **Neo4j浏览器**: http://localhost:7474

## 使用示例

### 示例1: 分析Go项目变更

假设你有一个Go项目,现在要分析feature分支相对于main分支的代码变更风险。

#### 通过API

```bash
# 1. 创建分析任务
curl -X POST http://localhost:8080/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repo_path": "/path/to/your/go/project",
    "base_commit": "main",
    "target_commit": "feature"
  }'

# 响应示例
{
  "success": true,
  "data": {
    "id": "task_1234567890",
    "status": "running",
    "progress": 0
  }
}

# 2. 查询任务状态
curl http://localhost:8080/api/tasks/task_1234567890

# 3. 获取分析报告
curl http://localhost:8080/api/reports/task_1234567890
```

#### 通过Web界面

1. 打开浏览器访问 http://localhost:8080
2. 点击"新建分析"
3. 填写表单:
   - 仓库路径: `/path/to/your/go/project`
   - 基准提交: `main`
   - 目标提交: `feature`
4. 点击"开始分析"
5. 等待分析完成,查看风险报告

### 示例2: 查看函数影响图

```bash
# 获取指定函数的影响图
curl http://localhost:8080/api/impact-graph?function=github.com/yourproject/pkg.YourFunction&max_depth=5
```

响应包含nodes和edges,可以在前端渲染为力导向图。

### 示例3: 分析本项目

```bash
# 分析本系统自己的代码
curl -X POST http://localhost:8080/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repo_path": ".",
    "base_commit": "HEAD~1",
    "target_commit": "HEAD"
  }'
```

## 报告解读

### 风险等级

- **Low (低)**: 分数 < 30,变更影响小,风险可控
- **Medium (中)**: 分数 30-60,需要基本测试
- **High (高)**: 分数 60-80,需要充分测试和代码审查
- **Critical (严重)**: 分数 > 80,高风险,建议拆分变更

### 分数组成

**总分 = 复杂度分数×0.3 + 影响面分数×0.4 + 历史风险分数×0.2 + 特征风险分数×0.1**

- **复杂度分数**: 基于圈复杂度和认知复杂度
- **影响面分数**: 基于调用关系图的广度和深度
- **历史风险分数**: 基于历史Bug关联(待实现)
- **特征风险分数**: 基于代码模式识别

### 特征风险类型

| 类型 | 严重性 | 说明 |
|------|--------|------|
| goroutine_leak | Medium | Goroutine可能无法正确退出 |
| resource_leak | High | 资源(文件/连接)未正确关闭 |
| nil_pointer | High | 可能的空指针引用 |
| race_condition | High | 潜在的并发竞态条件 |
| error_ignore | Medium | 错误被忽略 |
| panic_uncaught | High | Panic未被捕获 |

## 配置说明

### 修改配置文件

编辑 `configs/config.yaml`:

```yaml
# 调整风险评估权重
risk:
  complexity_weight: 0.3  # 复杂度权重
  impact_weight: 0.4      # 影响面权重
  history_weight: 0.2     # 历史风险权重
  feature_weight: 0.1     # 特征风险权重
  
  # 调整风险阈值
  thresholds:
    low: 30
    medium: 60
    high: 80

# 调整分析深度
analyzer:
  max_depth: 10  # 调用链最大深度
  timeout: 300   # 分析超时(秒)
  workers: 4     # 并发工作协程数
```

## 最佳实践

### 1. 在CI/CD中集成

```yaml
# .github/workflows/code-risk.yml
name: Code Risk Analysis
on:
  pull_request:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Run Risk Analysis
        run: |
          docker run --rm \
            -v $(pwd):/repo \
            go-code-risk-analyzer:latest \
            analyze \
            --repo /repo \
            --base origin/main \
            --target HEAD \
            --output report.json
      
      - name: Check Risk Level
        run: |
          risk_score=$(jq '.summary.total_score' report.json)
          if (( $(echo "$risk_score > 80" | bc -l) )); then
            echo "::error::Risk score too high: $risk_score"
            exit 1
          fi
```

### 2. Code Review前检查

```bash
# 提交PR前检查
make build
./build/code-risk-analyzer analyze \
  --repo . \
  --base origin/main \
  --target HEAD \
  --output /dev/stdout | jq .
```

### 3. 定期分析

```bash
# 定期分析主分支最近的提交
crontab -e

# 每天凌晨2点分析前一天的提交
0 2 * * * cd /path/to/project && make analyze BASE=HEAD~1 TARGET=HEAD
```

## 故障排查

### 问题1: 无法连接Neo4j

**症状**: 日志显示 "Failed to connect to Neo4j"

**解决**:
1. 确认Neo4j服务已启动
2. 检查配置文件中的连接信息
3. 测试连接: `curl http://localhost:7474`

### 问题2: 分析卡住不动

**症状**: 任务状态一直是 "running"

**解决**:
1. 检查日志文件 `logs/app.log`
2. 增加超时时间(修改配置文件)
3. 减小分析深度

### 问题3: 前端无法访问

**症状**: 浏览器显示404

**解决**:
1. 确认前端已构建: `make web-build`
2. 检查后端是否正常: `curl http://localhost:8080/api/health`
3. 查看前端文件是否存在: `ls web/dist`

## 进阶使用

### 自定义风险检测器

可以添加自定义的特征检测器:

```go
// internal/risk/feature/custom_detector.go
type CustomDetector struct{}

func (d *CustomDetector) Name() string {
    return "custom_risk"
}

func (d *CustomDetector) Detect(file *ast.File, fset *token.FileSet) []*models.FeatureRisk {
    // 实现自定义检测逻辑
    return risks
}

// 在Manager中注册
m.RegisterDetector(&CustomDetector{})
```

### 扩展API接口

```go
// internal/web/handler/handler.go
func (h *Handler) RegisterRoutes(router *gin.Engine) {
    apiGroup := router.Group("/api")
    {
        // 添加自定义接口
        apiGroup.GET("/custom-endpoint", h.CustomHandler)
    }
}
```

## 性能优化

### 1. 缓存优化

启用缓存减少重复分析:

```yaml
cache:
  enabled: true
  ttl: 3600  # 缓存1小时
```

### 2. 并发优化

增加工作协程数:

```yaml
analyzer:
  workers: 8  # 根据CPU核心数调整
```

### 3. 数据库优化

Neo4j内存配置:

```yaml
# docker-compose.yml
environment:
  - NEO4J_dbms_memory_pagecache_size=2G
  - NEO4J_dbms_memory_heap_max__size=4G
```

## 参考资料

- [美团代码变更风险可视化系统](https://tech.meituan.com/2023/09/22/construction-and-practice-of-code-change-risk-visualization-system.html)
- [圈复杂度](https://en.wikipedia.org/wiki/Cyclomatic_complexity)
- [Go AST文档](https://pkg.go.dev/go/ast)
- [Neo4j Cypher查询语言](https://neo4j.com/docs/cypher-manual/)
