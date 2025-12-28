package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/web/api"
)

// Handler HTTP处理器
type Handler struct {
	service *api.Service
}

// NewHandler 创建处理器
func NewHandler(service *api.Service) *Handler {
	return &Handler{
		service: service,
	}
}

// RegisterRoutes 注册路由
func (h *Handler) RegisterRoutes(router *gin.Engine) {
	apiGroup := router.Group("/api")
	{
		// 分析任务
		apiGroup.POST("/analyze", h.CreateAnalysis)
		apiGroup.GET("/tasks", h.ListTasks)
		apiGroup.GET("/tasks/:id", h.GetTask)
		apiGroup.GET("/reports/:id", h.GetReport)

		// 影响图
		apiGroup.GET("/impact-graph", h.GetImpactGraph)

		// 完整调用图（仓库全景）
		apiGroup.GET("/callgraph/:taskId", h.GetFullCallGraph)

		// 统计
		apiGroup.GET("/statistics", h.GetStatistics)

		// 健康检查
		apiGroup.GET("/health", h.Health)
	}
}

// CreateAnalysis 创建分析任务
func (h *Handler) CreateAnalysis(c *gin.Context) {
	var req api.AnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	task, err := h.service.CreateAnalysisTask(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    task,
	})
}

// ListTasks 列出所有任务
func (h *Handler) ListTasks(c *gin.Context) {
	tasks := h.service.ListTasks()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    tasks,
	})
}

// GetTask 获取任务详情
func (h *Handler) GetTask(c *gin.Context) {
	taskID := c.Param("id")

	task, err := h.service.GetTask(taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    task,
	})
}

// GetReport 获取分析报告
func (h *Handler) GetReport(c *gin.Context) {
	taskID := c.Param("id")

	report, err := h.service.GetReport(taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    report,
	})
}

// GetImpactGraph 获取影响图
func (h *Handler) GetImpactGraph(c *gin.Context) {
	funcName := c.Query("function")
	if funcName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "function parameter is required",
		})
		return
	}

	maxDepth := 5
	if depth := c.Query("max_depth"); depth != "" {
		// 解析深度参数
		_ = depth
	}

	graph, err := h.service.GetImpactGraph(funcName, maxDepth)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    graph,
	})
}

// GetFullCallGraph 获取完整的调用图（仓库全景）
func (h *Handler) GetFullCallGraph(c *gin.Context) {
	taskID := c.Param("taskId")

	// 从仓库路径构建全景调用图
	callGraph, err := h.service.GetFullCallGraph(taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    callGraph,
	})
}

// GetStatistics 获取统计信息
func (h *Handler) GetStatistics(c *gin.Context) {
	stats := h.service.GetStatistics()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// Health 健康检查
func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"time":   time.Now().Format(time.RFC3339),
	})
}
