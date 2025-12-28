package complexity

import (
	"go/ast"
	"go/token"

	"github.com/sugerdaddy/go-code-risk-analyzer/pkg/models"
)

// Analyzer 复杂度分析器
type Analyzer struct{}

// NewAnalyzer 创建复杂度分析器
func NewAnalyzer() *Analyzer {
	return &Analyzer{}
}

// Analyze 分析函数复杂度
func (a *Analyzer) Analyze(funcDecl *ast.FuncDecl) *models.ComplexityMetrics {
	metrics := &models.ComplexityMetrics{}

	if funcDecl.Body == nil {
		return metrics
	}

	// 计算圈复杂度
	metrics.Cyclomatic = a.calculateCyclomaticComplexity(funcDecl)

	// 计算认知复杂度
	metrics.Cognitive = a.calculateCognitiveComplexity(funcDecl)

	// 计算代码行数
	metrics.Lines = a.calculateLines(funcDecl)

	// 计算参数个数
	metrics.Parameters = a.countParameters(funcDecl)

	// 计算返回值个数
	metrics.ReturnValues = a.countReturnValues(funcDecl)

	// 计算最大嵌套层级
	metrics.NestedLevel = a.calculateMaxNestingLevel(funcDecl)

	// 计算可维护性指数 (Maintainability Index)
	metrics.Maintainability = a.calculateMaintainabilityIndex(metrics)

	return metrics
}

// calculateCyclomaticComplexity 计算圈复杂度
// McCabe圈复杂度 = 决策点数量 + 1
func (a *Analyzer) calculateCyclomaticComplexity(funcDecl *ast.FuncDecl) int {
	complexity := 1 // 基础复杂度

	ast.Inspect(funcDecl.Body, func(n ast.Node) bool {
		switch node := n.(type) {
		case *ast.IfStmt:
			complexity++
		case *ast.ForStmt:
			complexity++
		case *ast.RangeStmt:
			complexity++
		case *ast.CaseClause:
			// switch的每个case增加复杂度
			if len(node.List) > 0 { // 不是default
				complexity++
			}
		case *ast.CommClause:
			// select的每个case增加复杂度
			if node.Comm != nil { // 不是default
				complexity++
			}
		case *ast.BinaryExpr:
			// 逻辑运算符增加复杂度
			if node.Op == token.LAND || node.Op == token.LOR {
				complexity++
			}
		}
		return true
	})

	return complexity
}

// calculateCognitiveComplexity 计算认知复杂度
// 认知复杂度考虑了嵌套层级对理解代码的影响
func (a *Analyzer) calculateCognitiveComplexity(funcDecl *ast.FuncDecl) int {
	complexity := 0
	nestingLevel := 0

	var visit func(ast.Node) bool
	visit = func(n ast.Node) bool {
		switch node := n.(type) {
		case *ast.IfStmt:
			complexity += 1 + nestingLevel
			nestingLevel++
			ast.Inspect(node.Body, visit)
			nestingLevel--
			if node.Else != nil {
				complexity++ // else增加复杂度
				ast.Inspect(node.Else, visit)
			}
			return false

		case *ast.ForStmt, *ast.RangeStmt:
			complexity += 1 + nestingLevel
			nestingLevel++
			ast.Inspect(node, visit)
			nestingLevel--
			return false

		case *ast.SwitchStmt:
			complexity += 1 + nestingLevel
			nestingLevel++
			ast.Inspect(node.Body, visit)
			nestingLevel--
			return false

		case *ast.SelectStmt:
			complexity += 1 + nestingLevel
			nestingLevel++
			ast.Inspect(node.Body, visit)
			nestingLevel--
			return false

		case *ast.BinaryExpr:
			// 逻辑运算符序列
			if node.Op == token.LAND || node.Op == token.LOR {
				complexity++
			}

		case *ast.BranchStmt:
			// break, continue增加复杂度
			if node.Tok == token.BREAK || node.Tok == token.CONTINUE {
				if node.Label != nil {
					complexity++ // 带标签的跳转增加更多复杂度
				}
			}
		}
		return true
	}

	ast.Inspect(funcDecl.Body, visit)
	return complexity
}

// calculateLines 计算代码行数
func (a *Analyzer) calculateLines(funcDecl *ast.FuncDecl) int {
	if funcDecl.Body == nil {
		return 0
	}

	// 简化处理:统计语句数量
	lines := 0
	ast.Inspect(funcDecl.Body, func(n ast.Node) bool {
		switch n.(type) {
		case *ast.ExprStmt, *ast.AssignStmt, *ast.ReturnStmt,
			*ast.IfStmt, *ast.ForStmt, *ast.RangeStmt,
			*ast.SwitchStmt, *ast.SelectStmt, *ast.DeclStmt:
			lines++
		}
		return true
	})

	return lines
}

// countParameters 统计参数个数
func (a *Analyzer) countParameters(funcDecl *ast.FuncDecl) int {
	if funcDecl.Type.Params == nil {
		return 0
	}

	count := 0
	for _, field := range funcDecl.Type.Params.List {
		count += len(field.Names)
		if len(field.Names) == 0 {
			// 匿名参数
			count++
		}
	}

	return count
}

// countReturnValues 统计返回值个数
func (a *Analyzer) countReturnValues(funcDecl *ast.FuncDecl) int {
	if funcDecl.Type.Results == nil {
		return 0
	}

	count := 0
	for _, field := range funcDecl.Type.Results.List {
		if len(field.Names) > 0 {
			count += len(field.Names)
		} else {
			count++
		}
	}

	return count
}

// calculateMaxNestingLevel 计算最大嵌套层级
func (a *Analyzer) calculateMaxNestingLevel(funcDecl *ast.FuncDecl) int {
	maxLevel := 0
	currentLevel := 0

	var visit func(ast.Node) bool
	visit = func(n ast.Node) bool {
		switch n.(type) {
		case *ast.IfStmt, *ast.ForStmt, *ast.RangeStmt,
			*ast.SwitchStmt, *ast.SelectStmt, *ast.FuncLit:
			currentLevel++
			if currentLevel > maxLevel {
				maxLevel = currentLevel
			}
			ast.Inspect(n, visit)
			currentLevel--
			return false
		}
		return true
	}

	ast.Inspect(funcDecl.Body, visit)
	return maxLevel
}

// calculateMaintainabilityIndex 计算可维护性指数
// MI = 171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)
// 简化版本: MI = 100 - CC * 2 - LOC / 10 - nested * 5
func (a *Analyzer) calculateMaintainabilityIndex(metrics *models.ComplexityMetrics) float64 {
	mi := 100.0
	mi -= float64(metrics.Cyclomatic) * 2.0
	mi -= float64(metrics.Lines) / 10.0
	mi -= float64(metrics.NestedLevel) * 5.0
	mi -= float64(metrics.Parameters) * 1.5

	if mi < 0 {
		mi = 0
	}
	if mi > 100 {
		mi = 100
	}

	return mi
}

// GetComplexityLevel 获取复杂度等级
func (a *Analyzer) GetComplexityLevel(cyclomatic int) string {
	if cyclomatic <= 5 {
		return "low"
	} else if cyclomatic <= 10 {
		return "medium"
	} else if cyclomatic <= 20 {
		return "high"
	}
	return "critical"
}

// GetMaintainabilityLevel 获取可维护性等级
func (a *Analyzer) GetMaintainabilityLevel(mi float64) string {
	if mi >= 80 {
		return "excellent"
	} else if mi >= 60 {
		return "good"
	} else if mi >= 40 {
		return "fair"
	} else if mi >= 20 {
		return "poor"
	}
	return "critical"
}

// AnalyzeBatch 批量分析
func (a *Analyzer) AnalyzeBatch(file *ast.File) map[string]*models.ComplexityMetrics {
	result := make(map[string]*models.ComplexityMetrics)

	for _, decl := range file.Decls {
		if funcDecl, ok := decl.(*ast.FuncDecl); ok {
			funcName := funcDecl.Name.Name
			metrics := a.Analyze(funcDecl)
			result[funcName] = metrics
		}
	}

	return result
}
