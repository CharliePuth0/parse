package feature

import (
	"go/ast"
	"go/token"
	"strings"

	"github.com/sugerdaddy/go-code-risk-analyzer/pkg/models"
)

// Detector 特征检测器接口
type Detector interface {
	Name() string
	Detect(file *ast.File, fset *token.FileSet) []*models.FeatureRisk
}

// Manager 特征检测管理器
type Manager struct {
	detectors []Detector
}

// NewManager 创建特征检测管理器
func NewManager() *Manager {
	m := &Manager{
		detectors: make([]Detector, 0),
	}

	// 注册所有检测器
	m.RegisterDetector(&GoroutineLeakDetector{})
	m.RegisterDetector(&ResourceLeakDetector{})
	m.RegisterDetector(&NilPointerDetector{})
	m.RegisterDetector(&RaceConditionDetector{})
	m.RegisterDetector(&ErrorIgnoreDetector{})
	m.RegisterDetector(&PanicUncaughtDetector{})

	return m
}

// RegisterDetector 注册检测器
func (m *Manager) RegisterDetector(detector Detector) {
	m.detectors = append(m.detectors, detector)
}

// DetectAll 执行所有检测
func (m *Manager) DetectAll(file *ast.File, fset *token.FileSet) []*models.FeatureRisk {
	allRisks := make([]*models.FeatureRisk, 0)

	for _, detector := range m.detectors {
		risks := detector.Detect(file, fset)
		allRisks = append(allRisks, risks...)
	}

	return allRisks
}

// GoroutineLeakDetector Goroutine泄漏检测器
type GoroutineLeakDetector struct{}

func (d *GoroutineLeakDetector) Name() string {
	return "goroutine_leak"
}

func (d *GoroutineLeakDetector) Detect(file *ast.File, fset *token.FileSet) []*models.FeatureRisk {
	risks := make([]*models.FeatureRisk, 0)
	locations := make([]string, 0)

	ast.Inspect(file, func(n ast.Node) bool {
		if goStmt, ok := n.(*ast.GoStmt); ok {
			// 检查goroutine是否有context或done channel控制
			hasContext := false
			hasChannel := false

			// 简化检查:查看go语句的函数调用
			if callExpr, ok := goStmt.Call.Fun.(*ast.FuncLit); ok {
				// 匿名函数
				ast.Inspect(callExpr.Body, func(n ast.Node) bool {
					if ident, ok := n.(*ast.Ident); ok {
						if strings.Contains(ident.Name, "context") || 
						   strings.Contains(ident.Name, "ctx") {
							hasContext = true
						}
						if strings.Contains(ident.Name, "done") || 
						   strings.Contains(ident.Name, "cancel") {
							hasChannel = true
						}
					}
					return true
				})
			}

			if !hasContext && !hasChannel {
				pos := fset.Position(goStmt.Pos())
				location := formatLocation(pos)
				locations = append(locations, location)
			}
		}
		return true
	})

	if len(locations) > 0 {
		risk := &models.FeatureRisk{
			Type:        "goroutine_leak",
			Severity:    "medium",
			Count:       len(locations),
			Locations:   locations,
			Description: "检测到可能存在的goroutine泄漏风险:goroutine没有退出机制",
			Suggestion:  "建议使用context或done channel来控制goroutine的生命周期",
		}
		risks = append(risks, risk)
	}

	return risks
}

// ResourceLeakDetector 资源泄漏检测器
type ResourceLeakDetector struct{}

func (d *ResourceLeakDetector) Name() string {
	return "resource_leak"
}

func (d *ResourceLeakDetector) Detect(file *ast.File, fset *token.FileSet) []*models.FeatureRisk {
	risks := make([]*models.FeatureRisk, 0)
	locations := make([]string, 0)

	// 检测文件、连接等资源是否正确关闭
	ast.Inspect(file, func(n ast.Node) bool {
		if funcDecl, ok := n.(*ast.FuncDecl); ok {
			if funcDecl.Body == nil {
				return true
			}

			// 查找资源打开操作
			openCalls := make(map[string]token.Pos)
			closeCalls := make(map[string]bool)

			ast.Inspect(funcDecl.Body, func(n ast.Node) bool {
				if assignStmt, ok := n.(*ast.AssignStmt); ok {
					// 检查是否是资源打开操作
					for i, rhs := range assignStmt.Rhs {
						if callExpr, ok := rhs.(*ast.CallExpr); ok {
							callName := getCallName(callExpr.Fun)
							if isResourceOpenCall(callName) {
								if i < len(assignStmt.Lhs) {
									if ident, ok := assignStmt.Lhs[i].(*ast.Ident); ok {
										openCalls[ident.Name] = assignStmt.Pos()
									}
								}
							}
						}
					}
				}

				// 检查defer close
				if deferStmt, ok := n.(*ast.DeferStmt); ok {
					if callExpr := deferStmt.Call; callExpr != nil {
						if selExpr, ok := callExpr.Fun.(*ast.SelectorExpr); ok {
							if selExpr.Sel.Name == "Close" {
								if ident, ok := selExpr.X.(*ast.Ident); ok {
									closeCalls[ident.Name] = true
								}
							}
						}
					}
				}

				return true
			})

			// 检查哪些资源没有关闭
			for varName, pos := range openCalls {
				if !closeCalls[varName] {
					location := formatLocation(fset.Position(pos))
					locations = append(locations, location)
				}
			}
		}
		return true
	})

	if len(locations) > 0 {
		risk := &models.FeatureRisk{
			Type:        "resource_leak",
			Severity:    "high",
			Count:       len(locations),
			Locations:   locations,
			Description: "检测到可能的资源泄漏:文件/连接等资源未正确关闭",
			Suggestion:  "建议使用defer语句确保资源被正确关闭",
		}
		risks = append(risks, risk)
	}

	return risks
}

// NilPointerDetector 空指针检测器
type NilPointerDetector struct{}

func (d *NilPointerDetector) Name() string {
	return "nil_pointer"
}

func (d *NilPointerDetector) Detect(file *ast.File, fset *token.FileSet) []*models.FeatureRisk {
	risks := make([]*models.FeatureRisk, 0)
	// locations := make([]string, 0) // 简化实现，暂不检测

	ast.Inspect(file, func(n ast.Node) bool {
		// 检查指针解引用前是否有nil检查
		if starExpr, ok := n.(*ast.StarExpr); ok {
			// 查找是否有nil检查
			hasNilCheck := false

			// 简化检查:在父函数中查找if语句
			// 实际应该做更精确的数据流分析
			_ = starExpr
			_ = hasNilCheck

			// 这里只做示例,实际需要更复杂的分析
		}

		return true
	})

	// 简化实现
	return risks
}

// RaceConditionDetector 竞态条件检测器
type RaceConditionDetector struct{}

func (d *RaceConditionDetector) Name() string {
	return "race_condition"
}

func (d *RaceConditionDetector) Detect(file *ast.File, fset *token.FileSet) []*models.FeatureRisk {
	risks := make([]*models.FeatureRisk, 0)
	locations := make([]string, 0)

	ast.Inspect(file, func(n ast.Node) bool {
		if funcDecl, ok := n.(*ast.FuncDecl); ok {
			if funcDecl.Body == nil {
				return true
			}

			hasGoroutine := false
			hasSharedVariable := false
			hasMutex := false

			ast.Inspect(funcDecl.Body, func(n ast.Node) bool {
				// 检查是否启动了goroutine
				if _, ok := n.(*ast.GoStmt); ok {
					hasGoroutine = true
				}

				// 检查是否访问了共享变量
				// 简化:检查是否有赋值语句
				if _, ok := n.(*ast.AssignStmt); ok {
					hasSharedVariable = true
				}

				// 检查是否使用了mutex
				if selExpr, ok := n.(*ast.SelectorExpr); ok {
					if selExpr.Sel.Name == "Lock" || selExpr.Sel.Name == "Unlock" {
						hasMutex = true
					}
				}

				return true
			})

			// 如果有goroutine和共享变量,但没有mutex,可能有竞态
			if hasGoroutine && hasSharedVariable && !hasMutex {
				pos := fset.Position(funcDecl.Pos())
				location := formatLocation(pos)
				locations = append(locations, location)
			}
		}
		return true
	})

	if len(locations) > 0 {
		risk := &models.FeatureRisk{
			Type:        "race_condition",
			Severity:    "high",
			Count:       len(locations),
			Locations:   locations,
			Description: "检测到可能的竞态条件:并发访问共享变量未加锁",
			Suggestion:  "建议使用sync.Mutex或sync.RWMutex保护共享变量",
		}
		risks = append(risks, risk)
	}

	return risks
}

// ErrorIgnoreDetector 错误忽略检测器
type ErrorIgnoreDetector struct{}

func (d *ErrorIgnoreDetector) Name() string {
	return "error_ignore"
}

func (d *ErrorIgnoreDetector) Detect(file *ast.File, fset *token.FileSet) []*models.FeatureRisk {
	risks := make([]*models.FeatureRisk, 0)
	locations := make([]string, 0)

	ast.Inspect(file, func(n ast.Node) bool {
		if assignStmt, ok := n.(*ast.AssignStmt); ok {
			// 检查是否有error类型被赋值给_
			for i, lhs := range assignStmt.Lhs {
				if ident, ok := lhs.(*ast.Ident); ok {
					if ident.Name == "_" {
						// 检查右侧是否是返回error的函数调用
						if i < len(assignStmt.Rhs) {
							if callExpr, ok := assignStmt.Rhs[i].(*ast.CallExpr); ok {
								// 简化:假设最后一个返回值是error
								_ = callExpr
								pos := fset.Position(assignStmt.Pos())
								location := formatLocation(pos)
								locations = append(locations, location)
							}
						}
					}
				}
			}
		}

		// 检查函数调用后没有检查error
		if exprStmt, ok := n.(*ast.ExprStmt); ok {
			if _, ok := exprStmt.X.(*ast.CallExpr); ok {
				// 检查这个调用可能返回error但没有处理
				// 此处为简化实现
			}
		}

		return true
	})

	if len(locations) > 0 {
		risk := &models.FeatureRisk{
			Type:        "error_ignore",
			Severity:    "medium",
			Count:       len(locations),
			Locations:   locations,
			Description: "检测到错误被忽略:使用_丢弃error返回值",
			Suggestion:  "建议检查并处理所有error返回值",
		}
		risks = append(risks, risk)
	}

	return risks
}

// PanicUncaughtDetector Panic未捕获检测器
type PanicUncaughtDetector struct{}

func (d *PanicUncaughtDetector) Name() string {
	return "panic_uncaught"
}

func (d *PanicUncaughtDetector) Detect(file *ast.File, fset *token.FileSet) []*models.FeatureRisk {
	risks := make([]*models.FeatureRisk, 0)
	locations := make([]string, 0)

	ast.Inspect(file, func(n ast.Node) bool {
		if funcDecl, ok := n.(*ast.FuncDecl); ok {
			if funcDecl.Body == nil {
				return true
			}

			hasPanic := false
			hasRecover := false

			ast.Inspect(funcDecl.Body, func(n ast.Node) bool {
				// 检查是否有panic调用
				if callExpr, ok := n.(*ast.CallExpr); ok {
					if ident, ok := callExpr.Fun.(*ast.Ident); ok {
						if ident.Name == "panic" {
							hasPanic = true
						}
						if ident.Name == "recover" {
							hasRecover = true
						}
					}
				}
				return true
			})

			if hasPanic && !hasRecover {
				pos := fset.Position(funcDecl.Pos())
				location := formatLocation(pos)
				locations = append(locations, location)
			}
		}
		return true
	})

	if len(locations) > 0 {
		risk := &models.FeatureRisk{
			Type:        "panic_uncaught",
			Severity:    "high",
			Count:       len(locations),
			Locations:   locations,
			Description: "检测到panic未被捕获:可能导致程序崩溃",
			Suggestion:  "建议使用defer recover()捕获panic,或返回error",
		}
		risks = append(risks, risk)
	}

	return risks
}

// 辅助函数

func getCallName(expr ast.Expr) string {
	switch e := expr.(type) {
	case *ast.Ident:
		return e.Name
	case *ast.SelectorExpr:
		return getCallName(e.X) + "." + e.Sel.Name
	default:
		return ""
	}
}

func isResourceOpenCall(callName string) bool {
	resourceFuncs := []string{
		"Open", "OpenFile", "Create",
		"Dial", "DialTimeout", "Listen",
		"NewReader", "NewWriter",
	}

	for _, fn := range resourceFuncs {
		if strings.Contains(callName, fn) {
			return true
		}
	}

	return false
}

func formatLocation(pos token.Position) string {
	return pos.Filename + ":" + string(rune(pos.Line))
}

// AnalyzeConcurrency 分析并发特征
func AnalyzeConcurrency(file *ast.File) []*models.ConcurrencyFeature {
	features := make([]*models.ConcurrencyFeature, 0)

	for _, decl := range file.Decls {
		if funcDecl, ok := decl.(*ast.FuncDecl); ok {
			feature := &models.ConcurrencyFeature{
				Function: funcDecl.Name.Name,
				Issues:   make([]string, 0),
			}

			ast.Inspect(funcDecl.Body, func(n ast.Node) bool {
				switch n.(type) {
				case *ast.GoStmt:
					feature.HasGoroutine = true
				case *ast.ChanType:
					feature.HasChannel = true
				}

				if callExpr, ok := n.(*ast.CallExpr); ok {
					if selExpr, ok := callExpr.Fun.(*ast.SelectorExpr); ok {
						switch selExpr.Sel.Name {
						case "Lock", "Unlock", "RLock", "RUnlock":
							feature.HasMutex = true
						case "Wait", "Add", "Done":
							feature.HasWaitGroup = true
						}
					}
				}

				if ident, ok := n.(*ast.Ident); ok {
					if strings.Contains(ident.Name, "context") || 
					   strings.Contains(ident.Name, "ctx") {
						feature.HasContext = true
					}
				}

				return true
			})

			// 分析潜在问题
			if feature.HasGoroutine && !feature.HasContext && !feature.HasChannel {
				feature.Issues = append(feature.Issues, "goroutine可能无法正确退出")
			}

			if feature.HasGoroutine && !feature.HasMutex && !feature.HasChannel {
				feature.Issues = append(feature.Issues, "可能存在竞态条件")
			}

			if len(feature.Issues) > 0 || feature.HasGoroutine {
				features = append(features, feature)
			}
		}
	}

	return features
}
