package api

import (
	"context"
	"fmt"
	"go/token"
	"sync"
	"time"

	"github.com/sugerdaddy/go-code-risk-analyzer/internal/analyzer/ast"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/analyzer/callgraph"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/git"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/risk"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/risk/feature"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/storage/graph"
	"github.com/sugerdaddy/go-code-risk-analyzer/pkg/models"
)

// Service 分析服务
type Service struct {
	graphStore *graph.Store
	evaluator  *risk.Evaluator
	tasks      map[string]*models.AnalysisTask
	reports    map[string]*models.RiskReport
	callGraphs map[string][]*models.CallRelation // 缓存调用图数据
	mu         sync.RWMutex
}

// NewService 创建服务
func NewService(graphStore *graph.Store, evaluatorConfig *risk.EvaluatorConfig) *Service {
	return &Service{
		graphStore: graphStore,
		evaluator:  risk.NewEvaluator(evaluatorConfig),
		tasks:      make(map[string]*models.AnalysisTask),
		reports:    make(map[string]*models.RiskReport),
		callGraphs: make(map[string][]*models.CallRelation),
	}
}

// CreateAnalysisTask 创建分析任务
func (s *Service) CreateAnalysisTask(req *AnalyzeRequest) (*models.AnalysisTask, error) {
	task := &models.AnalysisTask{
		ID:           generateTaskID(),
		RepoPath:     req.RepoPath,
		BaseCommit:   req.BaseCommit,
		TargetCommit: req.TargetCommit,
		Status:       "pending",
		Progress:     0,
		CreatedAt:    time.Now(),
	}

	s.mu.Lock()
	s.tasks[task.ID] = task
	s.mu.Unlock()

	// 异步执行分析
	go s.executeAnalysis(task)

	return task, nil
}

// GetTask 获取任务
func (s *Service) GetTask(taskID string) (*models.AnalysisTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	task, ok := s.tasks[taskID]
	if !ok {
		return nil, fmt.Errorf("task not found")
	}

	return task, nil
}

// GetReport 获取报告
func (s *Service) GetReport(taskID string) (*models.RiskReport, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	report, ok := s.reports[taskID]
	if !ok {
		return nil, fmt.Errorf("report not found")
	}

	return report, nil
}

// ListTasks 列出所有任务
func (s *Service) ListTasks() []*models.AnalysisTask {
	s.mu.RLock()
	defer s.mu.RUnlock()

	tasks := make([]*models.AnalysisTask, 0, len(s.tasks))
	for _, task := range s.tasks {
		tasks = append(tasks, task)
	}

	return tasks
}

// GetFullCallGraph 获取完整的调用图（仓库全景）
func (s *Service) GetFullCallGraph(taskID string) (map[string]interface{}, error) {
	// 获取任务信息
	task, err := s.GetTask(taskID)
	if err != nil {
		return nil, err
	}

	// 从缓存中获取调用图数据
	s.mu.RLock()
	relations, ok := s.callGraphs[taskID]
	s.mu.RUnlock()

	if !ok || len(relations) == 0 {
		// 如果没有缓存，返回空结果
		return map[string]interface{}{
			"task_id":         taskID,
			"repo_path":       task.RepoPath,
			"total_relations": 0,
			"node_count":      0,
			"nodes":           []interface{}{},
			"edges":           []interface{}{},
			"message":         "调用图数据暂未生成，请确保分析任务已完成",
		}, nil
	}

	// 构建返回数据
	result := make(map[string]interface{})
	result["task_id"] = taskID
	result["repo_path"] = task.RepoPath
	result["total_relations"] = len(relations)

	// 转换为前端可用的格式
	nodes := make(map[string]map[string]interface{})
	edges := make([]map[string]interface{}, 0)

	for _, rel := range relations {
		// 添加节点
		if _, ok := nodes[rel.From]; !ok {
			nodes[rel.From] = map[string]interface{}{
				"id":    rel.From,
				"label": rel.From,
				"type":  "function",
			}
		}
		if _, ok := nodes[rel.To]; !ok {
			nodes[rel.To] = map[string]interface{}{
				"id":    rel.To,
				"label": rel.To,
				"type":  "function",
			}
		}

		// 添加边
		edges = append(edges, map[string]interface{}{
			"source": rel.From,
			"target": rel.To,
			"type":   rel.Type,
			"count":  rel.Count,
		})
	}

	// 转换 nodes map 为数组
	nodeList := make([]map[string]interface{}, 0, len(nodes))
	for _, node := range nodes {
		nodeList = append(nodeList, node)
	}

	result["nodes"] = nodeList
	result["edges"] = edges
	result["node_count"] = len(nodeList)

	return result, nil
}

// executeAnalysis 执行分析
func (s *Service) executeAnalysis(task *models.AnalysisTask) {
	ctx := context.Background()

	// 更新状态
	s.updateTaskStatus(task.ID, "running", 0, "")

	defer func() {
		if r := recover(); r != nil {
			s.updateTaskStatus(task.ID, "failed", 0, fmt.Sprintf("panic: %v", r))
		}
	}()

	// 1. Git分析
	s.updateTaskProgress(task.ID, 10)
	gitAnalyzer, err := git.NewAnalyzer(task.RepoPath)
	if err != nil {
		s.updateTaskStatus(task.ID, "failed", 0, err.Error())
		return
	}

	changes, err := gitAnalyzer.GetChanges(task.BaseCommit, task.TargetCommit)
	if err != nil {
		s.updateTaskStatus(task.ID, "failed", 0, err.Error())
		return
	}

	// 2. AST分析
	s.updateTaskProgress(task.ID, 30)
	astAnalyzer := ast.NewAnalyzer()
	featureManager := feature.NewManager()

	allFeatures := make([]*models.FeatureRisk, 0)

	for _, changeFile := range changes {
		// 解析文件
		filePath := gitAnalyzer.GetAbsolutePath(changeFile.Path)
		file, err := astAnalyzer.ParseFile(filePath)
		if err != nil {
			fmt.Printf("Warning: failed to parse file %s: %v\n", changeFile.Path, err)
			continue
		}

		// 提取包名
		if file.Name != nil {
			changeFile.Package = file.Name.Name
		}

		// 提取导入
		changeFile.Imports = astAnalyzer.ExtractImports(file)

		// 查找变更函数
		changedLines := make(map[int]bool)
		// 简化:假设所有函数都变更了
		changeFile.Functions = astAnalyzer.FindChangedFunctions(file, changedLines)

		// 特征检测 - 使用token.FileSet
		fset := token.NewFileSet()
		features := featureManager.DetectAll(file, fset)
		allFeatures = append(allFeatures, features...)
	}

	// 3. 构建调用图
	s.updateTaskProgress(task.ID, 50)
	callGraphBuilder := callgraph.NewBuilder()

	// 加载包
	err = callGraphBuilder.LoadPackage(task.RepoPath)
	if err != nil {
		fmt.Printf("Warning: failed to load package: %v\n", err)
	} else {
		// 构建调用图
		err = callGraphBuilder.Build()
		if err != nil {
			fmt.Printf("Warning: failed to build call graph: %v\n", err)
		}
	}

	// 4. 风险评估
	s.updateTaskProgress(task.ID, 70)
	report, err := s.evaluator.EvaluateWithContext(
		task.ID,
		changes,
		callGraphBuilder,
		allFeatures,
	)
	if err != nil {
		s.updateTaskStatus(task.ID, "failed", 0, err.Error())
		return
	}

	// 5. 保存结果
	s.updateTaskProgress(task.ID, 90)
	s.mu.Lock()
	s.reports[task.ID] = report
	// 缓存调用图数据
	if callGraphBuilder != nil {
		s.callGraphs[task.ID] = callGraphBuilder.GetCallRelations()
	}
	s.mu.Unlock()

	// 6. 保存到图数据库(可选)
	if s.graphStore != nil {
		// 保存符号
		for _, changeFile := range changes {
			filePath := gitAnalyzer.GetAbsolutePath(changeFile.Path)
			file, err := astAnalyzer.ParseFile(filePath)
			if err != nil {
				continue
			}

			symbols, err := astAnalyzer.ExtractSymbols(file, filePath)
			if err != nil {
				continue
			}

			for _, symbol := range symbols {
				_ = s.graphStore.SaveSymbol(ctx, symbol)
			}
		}

		// 保存调用关系
		relations := callGraphBuilder.GetCallRelations()
		for _, relation := range relations {
			_ = s.graphStore.SaveCallRelation(ctx, relation)
		}
	}

	// 完成
	s.updateTaskStatus(task.ID, "completed", 100, "")
	task.CompletedAt = time.Now()
}

// updateTaskStatus 更新任务状态
func (s *Service) updateTaskStatus(taskID, status string, progress int, errMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if task, ok := s.tasks[taskID]; ok {
		task.Status = status
		task.Progress = progress
		task.Error = errMsg
	}
}

// updateTaskProgress 更新任务进度
func (s *Service) updateTaskProgress(taskID string, progress int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if task, ok := s.tasks[taskID]; ok {
		task.Progress = progress
	}
}

// GetImpactGraph 获取影响图
func (s *Service) GetImpactGraph(funcName string, maxDepth int) (*models.ImpactGraph, error) {
	if s.graphStore == nil {
		return nil, fmt.Errorf("graph store not configured")
	}

	ctx := context.Background()
	return s.graphStore.GetImpactGraph(ctx, funcName, maxDepth)
}

// GetStatistics 获取统计信息
func (s *Service) GetStatistics() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := make(map[string]interface{})
	stats["total_tasks"] = len(s.tasks)

	statusCount := make(map[string]int)
	for _, task := range s.tasks {
		statusCount[task.Status]++
	}
	stats["status_breakdown"] = statusCount

	return stats
}

// AnalyzeRequest 分析请求
type AnalyzeRequest struct {
	RepoPath     string `json:"repo_path" binding:"required"`
	BaseCommit   string `json:"base_commit" binding:"required"`
	TargetCommit string `json:"target_commit" binding:"required"`
}

// generateTaskID 生成任务ID
func generateTaskID() string {
	return fmt.Sprintf("task_%d", time.Now().UnixNano())
}
