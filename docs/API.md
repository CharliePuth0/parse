# API文档

## 基本信息

- **Base URL**: `http://localhost:8080/api`
- **Content-Type**: `application/json`
- **响应格式**: JSON

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应

```json
{
  "error": "错误描述"
}
```

## API端点

### 1. 健康检查

检查服务是否正常运行。

**请求**

```
GET /api/health
```

**响应**

```json
{
  "status": "ok",
  "time": "2024-01-01T00:00:00Z"
}
```

---

### 2. 创建分析任务

创建一个新的代码变更分析任务。

**请求**

```
POST /api/analyze
Content-Type: application/json
```

**请求体**

```json
{
  "repo_path": "/path/to/repository",
  "base_commit": "main",
  "target_commit": "feature-branch"
}
```

**参数说明**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| repo_path | string | 是 | Git仓库的本地路径 |
| base_commit | string | 是 | 基准提交(分支名、tag或SHA) |
| target_commit | string | 是 | 目标提交(分支名、tag或SHA) |

**响应**

```json
{
  "success": true,
  "data": {
    "id": "task_1703088000000000000",
    "repo_path": "/path/to/repository",
    "base_commit": "main",
    "target_commit": "feature-branch",
    "status": "pending",
    "progress": 0,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**状态码**

- `200 OK`: 任务创建成功
- `400 Bad Request`: 请求参数错误
- `500 Internal Server Error`: 服务器内部错误

---

### 3. 获取任务列表

获取所有分析任务的列表。

**请求**

```
GET /api/tasks
```

**响应**

```json
{
  "success": true,
  "data": [
    {
      "id": "task_1703088000000000000",
      "repo_path": "/path/to/repository",
      "base_commit": "main",
      "target_commit": "feature-branch",
      "status": "completed",
      "progress": 100,
      "created_at": "2024-01-01T00:00:00Z",
      "completed_at": "2024-01-01T00:05:00Z"
    }
  ]
}
```

---

### 4. 获取任务详情

获取指定任务的详细信息。

**请求**

```
GET /api/tasks/:id
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 任务ID |

**响应**

```json
{
  "success": true,
  "data": {
    "id": "task_1703088000000000000",
    "repo_path": "/path/to/repository",
    "base_commit": "main",
    "target_commit": "feature-branch",
    "status": "completed",
    "progress": 100,
    "created_at": "2024-01-01T00:00:00Z",
    "completed_at": "2024-01-01T00:05:00Z",
    "error": ""
  }
}
```

**任务状态**

| 状态 | 说明 |
|------|------|
| pending | 等待执行 |
| running | 正在执行 |
| completed | 执行完成 |
| failed | 执行失败 |

---

### 5. 获取风险报告

获取分析任务的风险评估报告。

**请求**

```
GET /api/reports/:id
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 任务ID |

**响应**

```json
{
  "success": true,
  "data": {
    "task_id": "task_1703088000000000000",
    "generated_at": "2024-01-01T00:05:00Z",
    "summary": {
      "total_score": 45.5,
      "level": "medium",
      "files_changed": 5,
      "funcs_changed": 12,
      "lines_changed": 234,
      "direct_impact": 8,
      "indirect_impact": 23,
      "score_breakdown": {
        "complexity_score": 35.0,
        "impact_score": 50.0,
        "history_score": 0.0,
        "feature_score": 20.0
      }
    },
    "files": [
      {
        "path": "internal/service/user.go",
        "score": 55.0,
        "level": "medium",
        "change_type": "modified",
        "complexity": 12,
        "impact_count": 5,
        "issues": [
          "文件复杂度较高"
        ]
      }
    ],
    "functions": [
      {
        "name": "CreateUser",
        "full_name": "github.com/example/internal/service.CreateUser",
        "file": "internal/service/user.go",
        "line": 45,
        "score": 62.0,
        "level": "medium",
        "complexity": 8,
        "direct_impact": 3,
        "indirect_impact": 7,
        "change_type": "modified",
        "impact_path": [
          "github.com/example/internal/handler.UserHandler",
          "github.com/example/internal/router.RegisterRoutes"
        ],
        "features": [
          "error_ignore"
        ],
        "issues": [
          "直接影响3个调用方,需要充分测试"
        ]
      }
    ],
    "features": [
      {
        "type": "error_ignore",
        "severity": "medium",
        "count": 2,
        "locations": [
          "internal/service/user.go:67",
          "internal/service/auth.go:89"
        ],
        "description": "检测到错误被忽略:使用_丢弃error返回值",
        "suggestion": "建议检查并处理所有error返回值"
      }
    ],
    "recommendations": [
      "此次变更风险等级为中,建议进行基本的测试验证",
      "存在2个潜在风险特征,请重点关注"
    ]
  }
}
```

---

### 6. 获取影响图

获取指定函数的调用影响图。

**请求**

```
GET /api/impact-graph?function=<funcName>&max_depth=<depth>
```

**查询参数**

| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| function | string | 是 | - | 函数全名 |
| max_depth | int | 否 | 5 | 最大遍历深度 |

**响应**

```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "github.com/example/service.CreateUser",
        "label": "CreateUser",
        "type": "function",
        "is_change": true,
        "level": 0,
        "props": {
          "file": "internal/service/user.go",
          "line": 45
        }
      },
      {
        "id": "github.com/example/handler.UserHandler",
        "label": "UserHandler",
        "type": "function",
        "is_change": false,
        "level": 1
      }
    ],
    "edges": [
      {
        "from": "github.com/example/handler.UserHandler",
        "to": "github.com/example/service.CreateUser",
        "type": "call",
        "weight": 1
      }
    ]
  }
}
```

---

### 7. 获取统计信息

获取系统整体统计信息。

**请求**

```
GET /api/statistics
```

**响应**

```json
{
  "success": true,
  "data": {
    "total_tasks": 25,
    "status_breakdown": {
      "pending": 2,
      "running": 1,
      "completed": 20,
      "failed": 2
    }
  }
}
```

---

## 使用示例

### cURL示例

```bash
# 创建分析任务
curl -X POST http://localhost:8080/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repo_path": "/path/to/repo",
    "base_commit": "main",
    "target_commit": "feature"
  }'

# 获取任务状态
curl http://localhost:8080/api/tasks/task_1703088000000000000

# 获取报告
curl http://localhost:8080/api/reports/task_1703088000000000000

# 获取影响图
curl "http://localhost:8080/api/impact-graph?function=github.com/example/service.CreateUser&max_depth=5"
```

### JavaScript示例

```javascript
// 创建分析任务
async function createAnalysis() {
  const response = await fetch('http://localhost:8080/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo_path: '/path/to/repo',
      base_commit: 'main',
      target_commit: 'feature'
    })
  });
  
  const result = await response.json();
  console.log('Task ID:', result.data.id);
  return result.data.id;
}

// 轮询任务状态
async function waitForCompletion(taskId) {
  while (true) {
    const response = await fetch(`http://localhost:8080/api/tasks/${taskId}`);
    const result = await response.json();
    
    if (result.data.status === 'completed') {
      return true;
    } else if (result.data.status === 'failed') {
      throw new Error(result.data.error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// 获取报告
async function getReport(taskId) {
  const response = await fetch(`http://localhost:8080/api/reports/${taskId}`);
  const result = await response.json();
  return result.data;
}

// 完整流程
async function analyzeCode() {
  const taskId = await createAnalysis();
  console.log('Analysis started, task ID:', taskId);
  
  await waitForCompletion(taskId);
  console.log('Analysis completed');
  
  const report = await getReport(taskId);
  console.log('Risk score:', report.summary.total_score);
  console.log('Risk level:', report.summary.level);
}
```

### Python示例

```python
import requests
import time

BASE_URL = 'http://localhost:8080/api'

def create_analysis(repo_path, base_commit, target_commit):
    """创建分析任务"""
    response = requests.post(f'{BASE_URL}/analyze', json={
        'repo_path': repo_path,
        'base_commit': base_commit,
        'target_commit': target_commit
    })
    return response.json()['data']['id']

def get_task(task_id):
    """获取任务状态"""
    response = requests.get(f'{BASE_URL}/tasks/{task_id}')
    return response.json()['data']

def wait_for_completion(task_id, timeout=300):
    """等待任务完成"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        task = get_task(task_id)
        if task['status'] == 'completed':
            return True
        elif task['status'] == 'failed':
            raise Exception(task.get('error', 'Unknown error'))
        time.sleep(2)
    raise TimeoutError('Task timeout')

def get_report(task_id):
    """获取报告"""
    response = requests.get(f'{BASE_URL}/reports/{task_id}')
    return response.json()['data']

def main():
    # 创建任务
    task_id = create_analysis(
        repo_path='/path/to/repo',
        base_commit='main',
        target_commit='feature'
    )
    print(f'Task created: {task_id}')
    
    # 等待完成
    wait_for_completion(task_id)
    print('Analysis completed')
    
    # 获取报告
    report = get_report(task_id)
    print(f"Risk Score: {report['summary']['total_score']}")
    print(f"Risk Level: {report['summary']['level']}")
    print(f"Files Changed: {report['summary']['files_changed']}")
    print(f"Functions Changed: {report['summary']['funcs_changed']}")

if __name__ == '__main__':
    main()
```

## 错误码

| HTTP状态码 | 说明 |
|-----------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 限制

- 单次分析超时: 5分钟(可配置)
- 调用链最大深度: 10层(可配置)
- 并发分析任务: 4个(可配置)

## 版本历史

- **v1.0.0** (2024-01-01)
  - 初始版本
  - 支持基本的代码变更分析
  - 支持风险评估和报告生成
