# 快速启动指南

## ✅ 环境配置完成状态

### 已安装的组件
- ✅ **Node.js v23.6.1** - 前端运行环境
- ✅ **Go 1.25.5** - 后端运行环境
- ✅ **Go项目依赖** - 已通过 `go mod download` 完成
- ✅ **前端依赖** - 已通过 `npm install` 完成（235个包）
- ⏳ **Docker** - 正在安装中（用于Neo4j数据库）

### PATH配置

由于Go刚安装，需要在每个新终端会话中设置PATH：

```bash
export PATH="/opt/homebrew/bin:$PATH"
```

或者将以下内容添加到 `~/.zshrc` 以永久设置：

```bash
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## 🚀 启动选项

### 选项1: 简化模式（无需Neo4j，推荐用于快速演示）

这种模式使用内存存储，无需Neo4j数据库即可运行基本功能。

```bash
cd /Users/sugerdaddy/AI/tool/parse

# 设置PATH
export PATH="/opt/homebrew/bin:$PATH"

# 编译项目
go build -o build/analyzer cmd/server/main.go

# 运行服务器（跳过Neo4j连接）
./build/analyzer
```

**功能说明**:
- ✅ Git代码变更分析
- ✅ Go AST解析
- ✅ 复杂度计算
- ✅ 特征风险检测
- ✅ 风险评估和报告生成
- ⚠️ 调用关系图构建（功能受限，无持久化）
- ❌ 历史数据查询（需要Neo4j）

### 选项2: 完整模式（需要Neo4j）

等待Docker Desktop安装完成后，使用完整功能。

#### 步骤1: 确认Docker已启动

```bash
# 等待Docker Desktop下载完成
brew install --cask docker

# 启动Docker Desktop
open -a Docker

# 等待Docker启动（约30秒），然后验证
docker --version
```

#### 步骤2: 启动Neo4j

```bash
# 使用docker-compose一键启动
cd /Users/sugerdaddy/AI/tool/parse
docker-compose up -d neo4j

# 或者手动启动Neo4j容器
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5.15.0

# 验证Neo4j启动
docker ps | grep neo4j
```

#### 步骤3: 启动后端服务

```bash
cd /Users/sugerdaddy/AI/tool/parse

# 设置PATH
export PATH="/opt/homebrew/bin:$PATH"

# 使用Makefile启动
make run

# 或者手动启动
go build -o build/analyzer cmd/server/main.go
./build/analyzer
```

预期输出：
```
Connected to Neo4j successfully
Starting server on 0.0.0.0:8080
API documentation: http://localhost:8080/api/health
```

#### 步骤4: 验证服务

```bash
# 健康检查
curl http://localhost:8080/api/health

# 访问Neo4j管理界面
open http://localhost:7474
# 用户名: neo4j
# 密码: password
```

## 📊 使用vArmor仓库进行演示

### 1. 创建分析任务

```bash
# 分析最近一次提交的变更
curl -X POST http://localhost:8080/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repo_path": "/Users/sugerdaddy/ai/tool/vArmor",
    "base_commit": "HEAD~1",
    "target_commit": "HEAD"
  }' | jq .
```

### 2. 监控分析进度

```bash
# 获取任务ID（从上一步响应中）
TASK_ID="task_xxxxxx"

# 查询状态
curl http://localhost:8080/api/tasks/$TASK_ID | jq '.data | {status, progress}'
```

### 3. 获取风险报告

```bash
# 等待分析完成（status=completed）
curl http://localhost:8080/api/reports/$TASK_ID | jq . > varmor_report.json

# 查看摘要
curl http://localhost:8080/api/reports/$TASK_ID | jq '.data.summary'

# 查看高风险文件
curl http://localhost:8080/api/reports/$TASK_ID | \
  jq '.data.files[] | select(.level == "high")'

# 查看高风险函数
curl http://localhost:8080/api/reports/$TASK_ID | \
  jq '.data.functions[] | select(.score > 70)'
```

## 🔧 故障排查

### 问题1: go命令找不到

```bash
# 临时解决
export PATH="/opt/homebrew/bin:$PATH"

# 永久解决
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### 问题2: Docker未启动

```bash
# 检查Docker进程
ps aux | grep Docker

# 启动Docker Desktop
open -a Docker

# 等待30秒后验证
sleep 30
docker ps
```

### 问题3: Neo4j连接失败

```bash
# 检查Neo4j是否运行
docker ps | grep neo4j

# 查看Neo4j日志
docker logs neo4j

# 重启Neo4j
docker restart neo4j
```

### 问题4: 端口被占用

```bash
# 检查8080端口
lsof -i :8080

# 如果被占用，杀死进程
kill -9 <PID>

# 或修改配置文件使用其他端口
vim configs/config.yaml
# 修改 server.port: 8081
```

## 📈 预期分析结果（vArmor示例）

基于vArmor项目的特点，预期的分析结果可能包括：

### 风险摘要
```json
{
  "total_score": 45-75,
  "level": "medium/high",
  "files_changed": 5-15,
  "funcs_changed": 20-50,
  "lines_changed": 200-800
}
```

### 可能检测到的风险特征
1. **Goroutine管理** - vArmor作为Kubernetes Operator，使用大量Goroutine
2. **错误处理** - Controller的Reconcile循环中的错误处理
3. **资源泄漏** - Kubernetes客户端连接管理
4. **接口实现** - Reconciler接口的实现变更

### 高风险区域（推测）
- `internal/controller/` - Controller核心逻辑
- `internal/reconciler/` - Reconcile协调器
- `pkg/client/` - Kubernetes客户端封装

## 🎯 下一步操作

1. **等待Docker安装完成**
   ```bash
   # 检查安装状态
   brew info --cask docker
   ```

2. **启动完整系统**
   ```bash
   cd /Users/sugerdaddy/AI/tool/parse
   docker-compose up -d
   ```

3. **执行vArmor分析**
   ```bash
   # 使用上面的curl命令创建分析任务
   ```

4. **查看可视化结果**
   ```bash
   # 浏览器访问
   open http://localhost:8080
   ```

## 📚 参考文档

- **完整演示**: `DEMO_GUIDE.md` - 1300+行详细演示指南
- **API文档**: `docs/API.md` - 所有API接口说明
- **使用指南**: `docs/USER_GUIDE.md` - 详细使用说明
- **架构文档**: `docs/ARCHITECTURE.md` - 系统设计和原理

---

**当前状态**: 环境配置80%完成，仅需等待Docker安装即可运行完整系统！ 🎉
