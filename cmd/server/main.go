package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/risk"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/storage/graph"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/web/api"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/web/handler"
	"github.com/sugerdaddy/go-code-risk-analyzer/pkg/config"
	"gopkg.in/yaml.v3"
)

func main() {
	// 加载配置
	cfg, err := loadConfig("configs/config.yaml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 初始化图数据库
	var graphStore *graph.Store
	if cfg.Neo4j.URI != "" { // 启用Neo4j
		graphConfig := &graph.Config{
			URI:      cfg.Neo4j.URI,
			Username: cfg.Neo4j.Username,
			Password: cfg.Neo4j.Password,
			Database: cfg.Neo4j.Database,
		}

		graphStore, err = graph.NewStore(graphConfig)
		if err != nil {
			log.Printf("Warning: Failed to connect to Neo4j: %v", err)
		} else {
			log.Println("Connected to Neo4j successfully")

			// 创建索引
			ctx := context.Background()
			if err := graphStore.CreateIndexes(ctx); err != nil {
				log.Printf("Warning: Failed to create indexes: %v", err)
			}

			defer func() {
				if err := graphStore.Close(ctx); err != nil {
					log.Printf("Error closing graph store: %v", err)
				}
			}()
		}
	}

	// 初始化评估器配置
	evaluatorConfig := &risk.EvaluatorConfig{
		ComplexityWeight: cfg.Risk.ComplexityWeight,
		ImpactWeight:     cfg.Risk.ImpactWeight,
		HistoryWeight:    cfg.Risk.HistoryWeight,
		FeatureWeight:    cfg.Risk.FeatureWeight,
		MaxDepth:         cfg.Analyzer.MaxDepth,
	}
	evaluatorConfig.Thresholds.Low = cfg.Risk.Thresholds.Low
	evaluatorConfig.Thresholds.Medium = cfg.Risk.Thresholds.Medium
	evaluatorConfig.Thresholds.High = cfg.Risk.Thresholds.High

	// 初始化服务
	service := api.NewService(graphStore, evaluatorConfig)

	// 设置Gin模式
	gin.SetMode(cfg.Server.Mode)

	// 创建路由
	router := gin.Default()

	// 启用CORS
	router.Use(corsMiddleware())

	// 静态文件服务(前端)
	router.Static("/static", "./web/dist/static")
	router.StaticFile("/", "./web/dist/index.html")
	router.StaticFile("/favicon.ico", "./web/dist/favicon.ico")

	// 注册API路由
	h := handler.NewHandler(service)
	h.RegisterRoutes(router)

	// SPA路由 - 对于所有未匹配的路由，返回index.html
	router.NoRoute(func(c *gin.Context) {
		// 如果请求路径以/api开头，返回404
		if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
			c.JSON(404, gin.H{"error": "API endpoint not found"})
			return
		}
		// 其他路径返回index.html，让前端路由处理
		c.File("./web/dist/index.html")
	})

	// 启动服务器
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	log.Printf("Starting server on %s", addr)
	log.Printf("API documentation: http://localhost:%d/api/health", cfg.Server.Port)

	// 优雅关闭
	srv := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
}

// loadConfig 加载配置
func loadConfig(path string) (*config.Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg config.Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

// corsMiddleware CORS中间件
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
