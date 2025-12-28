package risk

import (
	"fmt"
	"time"

	"github.com/sugerdaddy/go-code-risk-analyzer/internal/analyzer/callgraph"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/risk/complexity"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/risk/feature"
	"github.com/sugerdaddy/go-code-risk-analyzer/internal/risk/impact"
	"github.com/sugerdaddy/go-code-risk-analyzer/pkg/models"
)

// Evaluator 风险评估器
type Evaluator struct {
	complexityAnalyzer *complexity.Analyzer
	featureManager     *feature.Manager
	callGraphBuilder   *callgraph.Builder
	impactAnalyzer     *impact.Analyzer
	config             *EvaluatorConfig
}

// EvaluatorConfig 评估器配置
type EvaluatorConfig struct {
	ComplexityWeight float64
	ImpactWeight     float64
	HistoryWeight    float64
	FeatureWeight    float64
	Thresholds       struct {
		Low      float64
		Medium   float64
		High     float64
		Critical float64
	}
	MaxDepth int
}

// NewEvaluator 创建风险评估器
func NewEvaluator(config *EvaluatorConfig) *Evaluator {
	if config == nil {
		config = DefaultConfig()
	}

	return &Evaluator{
		complexityAnalyzer: complexity.NewAnalyzer(),
		featureManager:     feature.NewManager(),
		callGraphBuilder:   callgraph.NewBuilder(),
		config:             config,
	}
}

// DefaultConfig 默认配置
func DefaultConfig() *EvaluatorConfig {
	config := &EvaluatorConfig{
		ComplexityWeight: 0.3,
		ImpactWeight:     0.4,
		HistoryWeight:    0.2,
		FeatureWeight:    0.1,
		MaxDepth:         10,
	}

	config.Thresholds.Low = 30
	config.Thresholds.Medium = 60
	config.Thresholds.High = 80
	config.Thresholds.Critical = 90

	return config
}

// Evaluate 评估风险
func (e *Evaluator) Evaluate(taskID string, changes []*models.ChangeFile, callGraph *callgraph.Builder) (*models.RiskReport, error) {
	report := &models.RiskReport{
		TaskID:          taskID,
		GeneratedAt:     time.Now(),
		Summary:         &models.RiskSummary{},
		Files:           make([]*models.FileRisk, 0),
		Functions:       make([]*models.FunctionRisk, 0),
		Features:        make([]*models.FeatureRisk, 0),
		Recommendations: make([]string, 0),
	}

	e.callGraphBuilder = callGraph

	// 评估每个变更文件
	totalComplexity := 0
	totalImpact := 0

	for _, changeFile := range changes {
		fileRisk := e.evaluateFile(changeFile)
		report.Files = append(report.Files, fileRisk)

		// 评估每个变更函数
		for _, changeFunc := range changeFile.Functions {
			funcRisk := e.evaluateFunction(changeFunc, changeFile)
			report.Functions = append(report.Functions, funcRisk)

			totalComplexity += funcRisk.Complexity
			totalImpact += funcRisk.DirectImpact + funcRisk.IndirectImpact
		}
	}

	// 汇总统计
	report.Summary.FilesChanged = len(changes)
	report.Summary.FuncsChanged = len(report.Functions)

	for _, file := range changes {
		report.Summary.LinesChanged += file.AddedLines + file.DeletedLines
	}

	report.Summary.DirectImpact = e.calculateDirectImpact(report.Functions)
	report.Summary.IndirectImpact = e.calculateIndirectImpact(report.Functions)

	// 计算总分
	report.Summary.ScoreBreakdown = e.calculateScoreBreakdown(
		totalComplexity,
		totalImpact,
		len(report.Features),
	)

	report.Summary.TotalScore = e.calculateTotalScore(report.Summary.ScoreBreakdown)
	report.Summary.Level = e.getRiskLevel(report.Summary.TotalScore)

	// 生成建议
	report.Recommendations = e.generateRecommendations(report)

	return report, nil
}

// evaluateFile 评估文件风险
func (e *Evaluator) evaluateFile(changeFile *models.ChangeFile) *models.FileRisk {
	fileRisk := &models.FileRisk{
		Path:         changeFile.Path,
		ChangeType:   changeFile.Type,
		AddedLines:   changeFile.AddedLines,
		DeletedLines: changeFile.DeletedLines,
		Package:      changeFile.Package,
		Functions:    make([]string, 0),
		Issues:       make([]string, 0),
	}

	// 提取函数名列表
	for _, fn := range changeFile.Functions {
		fileRisk.Functions = append(fileRisk.Functions, fn.Name)
	}

	// 计算复杂度
	totalComplexity := 0
	for _, fn := range changeFile.Functions {
		totalComplexity += fn.Complexity
	}
	fileRisk.Complexity = totalComplexity

	// 计算影响面
	impactCount := 0
	for _, fn := range changeFile.Functions {
		if e.callGraphBuilder != nil {
			callers := e.callGraphBuilder.FindCallers(fn.Name)
			impactCount += len(callers)
		}
	}
	fileRisk.ImpactCount = impactCount

	// 计算分数
	complexityScore := e.normalizeComplexity(totalComplexity, len(changeFile.Functions))
	impactScore := e.normalizeImpact(impactCount)

	fileRisk.Score = complexityScore*e.config.ComplexityWeight +
		impactScore*e.config.ImpactWeight

	fileRisk.Level = e.getRiskLevel(fileRisk.Score)

	// 识别问题
	if totalComplexity > 50 {
		fileRisk.Issues = append(fileRisk.Issues, "文件复杂度较高")
	}
	if impactCount > 20 {
		fileRisk.Issues = append(fileRisk.Issues, "影响范围较大")
	}
	if changeFile.Type == "added" && len(changeFile.Functions) > 10 {
		fileRisk.Issues = append(fileRisk.Issues, "新增文件包含较多函数,建议拆分")
	}

	return fileRisk
}

// evaluateFunction 评估函数风险
// 参考美团后羿系统的影响面评估方法论
func (e *Evaluator) evaluateFunction(changeFunc *models.ChangeFunc, file *models.ChangeFile) *models.FunctionRisk {
	funcRisk := &models.FunctionRisk{
		Name:       changeFunc.Name,
		FullName:   fmt.Sprintf("%s.%s", file.Package, changeFunc.Name),
		File:       file.Path,
		Line:       changeFunc.StartLine,
		Complexity: changeFunc.Complexity,
		ChangeType: changeFunc.ChangeType,
		Features:   make([]string, 0),
		Issues:     make([]string, 0),
		ImpactPath: make([]string, 0),
	}

	// 使用增强的影响面分析器
	if e.callGraphBuilder != nil {
		// 创建影响面分析器(如果还没有)
		if e.impactAnalyzer == nil {
			e.impactAnalyzer = impact.NewAnalyzer(e.callGraphBuilder, nil)
		}

		// 执行增强的影响面分析
		impactResult := e.impactAnalyzer.AnalyzeImpact(changeFunc.Name)

		// 填充直接影响和间接影响
		funcRisk.DirectImpact = impactResult.DirectImpact
		funcRisk.IndirectImpact = impactResult.IndirectImpact

		// 提取影响路径(显示关键路径上的函数)
		for _, path := range impactResult.CriticalPaths {
			for i, fn := range path {
				if i > 0 && i <= 5 { // 只显示前5层
					funcRisk.ImpactPath = append(funcRisk.ImpactPath, fn)
				}
			}
		}

		// 去重影响路径
		funcRisk.ImpactPath = uniqueStrings(funcRisk.ImpactPath)

		// 填充详细的影响面信息
		if impactResult.TotalImpact > 0 {
			funcRisk.ImpactDetail = &models.ImpactDetail{
				TotalImpact:     impactResult.TotalImpact,
				MaxDepthReached: impactResult.MaxDepth,
				ImpactScore:     impactResult.ImpactScore,
				ImpactByLevel:   impactResult.ImpactByLevel,
				CriticalPaths:   impactResult.CriticalPaths,
				TopImpactFuncs:  make([]*models.ImpactFuncInfo, 0),
			}

			// 转换受影响函数信息
			for _, fn := range impactResult.TopImpactFuncs {
				funcRisk.ImpactDetail.TopImpactFuncs = append(funcRisk.ImpactDetail.TopImpactFuncs, &models.ImpactFuncInfo{
					Name:       fn.Name,
					Distance:   fn.Distance,
					Importance: fn.Importance,
					CallCount:  fn.CallCount,
					IsCritical: fn.IsCritical,
				})
			}
		}
	}

	// 计算影响面分数(改进的算法)
	impactScore := e.calculateEnhancedImpactScore(funcRisk)

	// 计算复杂度分数
	complexityScore := e.normalizeComplexity(changeFunc.Complexity, 1)

	// 综合分数
	funcRisk.Score = complexityScore*e.config.ComplexityWeight +
		impactScore*e.config.ImpactWeight

	funcRisk.Level = e.getRiskLevel(funcRisk.Score)

	// 识别问题
	e.identifyFunctionIssues(funcRisk, changeFunc)

	return funcRisk
}

// calculateEnhancedImpactScore 计算增强的影响面分数
func (e *Evaluator) calculateEnhancedImpactScore(funcRisk *models.FunctionRisk) float64 {
	// 基础影响分数
	baseScore := float64(funcRisk.DirectImpact*2 + funcRisk.IndirectImpact)

	// 如果有详细影响面信息,使用更精确的计算
	if funcRisk.ImpactDetail != nil {
		// 使用影响面分析器计算的分数
		baseScore = funcRisk.ImpactDetail.ImpactScore

		// 关键路径加成
		if len(funcRisk.ImpactDetail.CriticalPaths) > 0 {
			baseScore *= 1.2 // 20%加成
		}

		// 深度加成(影响链越深,潜在风险越大)
		if funcRisk.ImpactDetail.MaxDepthReached > 5 {
			baseScore *= 1.1 // 10%加成
		}
	}

	return e.normalizeImpact(int(baseScore))
}

// identifyFunctionIssues 识别函数问题
func (e *Evaluator) identifyFunctionIssues(funcRisk *models.FunctionRisk, changeFunc *models.ChangeFunc) {
	// 复杂度过高
	if changeFunc.Complexity > 20 {
		funcRisk.Issues = append(funcRisk.Issues, fmt.Sprintf("圈复杂度过高(%d),建议重构", changeFunc.Complexity))
	}

	// 直接影响过大
	if funcRisk.DirectImpact > 10 {
		funcRisk.Issues = append(funcRisk.Issues, fmt.Sprintf("直接影响%d个调用方,需要充分测试", funcRisk.DirectImpact))
	}

	// 新增函数复杂度高
	if changeFunc.IsNew && changeFunc.Complexity > 15 {
		funcRisk.Issues = append(funcRisk.Issues, "新增函数复杂度较高,建议拆分")
	}

	// 影响链过深
	if funcRisk.ImpactDetail != nil && funcRisk.ImpactDetail.MaxDepthReached >= 5 {
		funcRisk.Issues = append(funcRisk.Issues, fmt.Sprintf("影响链深度达到%d层,影响范围较大", funcRisk.ImpactDetail.MaxDepthReached))
	}

	// 存在关键路径
	if funcRisk.ImpactDetail != nil && len(funcRisk.ImpactDetail.CriticalPaths) > 0 {
		funcRisk.Issues = append(funcRisk.Issues, fmt.Sprintf("存在%d条关键影响路径,建议重点测试", len(funcRisk.ImpactDetail.CriticalPaths)))
	}
}

// uniqueStrings 字符串切片去重
func uniqueStrings(input []string) []string {
	seen := make(map[string]bool)
	result := make([]string, 0)
	for _, s := range input {
		if !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}
	return result
}

// calculateScoreBreakdown 计算分数分解
func (e *Evaluator) calculateScoreBreakdown(totalComplexity, totalImpact, featureCount int) *models.ScoreBreakdown {
	return &models.ScoreBreakdown{
		ComplexityScore: e.normalizeComplexity(totalComplexity, 1),
		ImpactScore:     e.normalizeImpact(totalImpact),
		HistoryScore:    0, // TODO: 实现历史风险分析
		FeatureScore:    e.normalizeFeatureCount(featureCount),
	}
}

// calculateTotalScore 计算总分
func (e *Evaluator) calculateTotalScore(breakdown *models.ScoreBreakdown) float64 {
	return breakdown.ComplexityScore*e.config.ComplexityWeight +
		breakdown.ImpactScore*e.config.ImpactWeight +
		breakdown.HistoryScore*e.config.HistoryWeight +
		breakdown.FeatureScore*e.config.FeatureWeight
}

// normalizeComplexity 归一化复杂度分数(0-100)
func (e *Evaluator) normalizeComplexity(complexity, funcCount int) float64 {
	if funcCount == 0 {
		funcCount = 1
	}

	avgComplexity := float64(complexity) / float64(funcCount)

	// 复杂度5以下为低,20以上为高
	score := (avgComplexity / 20.0) * 100
	if score > 100 {
		score = 100
	}

	return score
}

// normalizeImpact 归一化影响面分数(0-100)
func (e *Evaluator) normalizeImpact(impact int) float64 {
	// 影响10个以下为低,50个以上为高
	score := (float64(impact) / 50.0) * 100
	if score > 100 {
		score = 100
	}

	return score
}

// normalizeFeatureCount 归一化特征数量分数(0-100)
func (e *Evaluator) normalizeFeatureCount(count int) float64 {
	// 5个特征以下为低,20个以上为高
	score := (float64(count) / 20.0) * 100
	if score > 100 {
		score = 100
	}

	return score
}

// getRiskLevel 获取风险等级
func (e *Evaluator) getRiskLevel(score float64) string {
	if score < e.config.Thresholds.Low {
		return "low"
	} else if score < e.config.Thresholds.Medium {
		return "medium"
	} else if score < e.config.Thresholds.High {
		return "high"
	}
	return "critical"
}

// calculateDirectImpact 计算直接影响
func (e *Evaluator) calculateDirectImpact(functions []*models.FunctionRisk) int {
	total := 0
	for _, fn := range functions {
		total += fn.DirectImpact
	}
	return total
}

// calculateIndirectImpact 计算间接影响
func (e *Evaluator) calculateIndirectImpact(functions []*models.FunctionRisk) int {
	total := 0
	for _, fn := range functions {
		total += fn.IndirectImpact
	}
	return total
}

// generateRecommendations 生成建议
func (e *Evaluator) generateRecommendations(report *models.RiskReport) []string {
	recommendations := make([]string, 0)

	// 基于总分给出建议
	if report.Summary.TotalScore >= 80 {
		recommendations = append(recommendations, "⚠️ 此次变更风险等级为高,建议进行全面的代码审查")
		recommendations = append(recommendations, "建议增加集成测试和端到端测试覆盖")
	}

	// 基于复杂度给出建议
	if report.Summary.ScoreBreakdown.ComplexityScore > 70 {
		recommendations = append(recommendations, "代码复杂度较高,建议重构以降低复杂度")
		recommendations = append(recommendations, "考虑将复杂函数拆分为多个小函数")
	}

	// 基于影响面给出建议
	if report.Summary.ScoreBreakdown.ImpactScore > 70 {
		recommendations = append(recommendations, "变更影响范围较大,建议充分测试所有相关调用方")
		recommendations = append(recommendations, "建议进行灰度发布,逐步验证变更")
	}

	// 基于特征给出建议
	if len(report.Features) > 0 {
		recommendations = append(recommendations, fmt.Sprintf("检测到%d个潜在风险特征,请重点关注", len(report.Features)))
	}

	// 基于函数数量给出建议
	if report.Summary.FuncsChanged > 20 {
		recommendations = append(recommendations, "变更函数数量较多,建议拆分为多个小的变更")
	}

	// 基于高风险函数给出建议
	highRiskCount := 0
	for _, fn := range report.Functions {
		if fn.Level == "high" || fn.Level == "critical" {
			highRiskCount++
		}
	}
	if highRiskCount > 0 {
		recommendations = append(recommendations,
			fmt.Sprintf("存在%d个高风险函数,建议优先测试这些函数", highRiskCount))
	}

	// 默认建议
	if len(recommendations) == 0 {
		recommendations = append(recommendations, "✅ 此次变更风险较低,但仍建议进行基本的测试验证")
	}

	return recommendations
}

// EvaluateWithContext 带上下文评估
func (e *Evaluator) EvaluateWithContext(
	taskID string,
	changes []*models.ChangeFile,
	callGraph *callgraph.Builder,
	features []*models.FeatureRisk,
) (*models.RiskReport, error) {
	report, err := e.Evaluate(taskID, changes, callGraph)
	if err != nil {
		return nil, err
	}

	// 添加特征风险
	report.Features = features

	// 重新计算特征分数
	report.Summary.ScoreBreakdown.FeatureScore = e.normalizeFeatureCount(len(features))
	report.Summary.TotalScore = e.calculateTotalScore(report.Summary.ScoreBreakdown)
	report.Summary.Level = e.getRiskLevel(report.Summary.TotalScore)

	// 更新建议
	report.Recommendations = e.generateRecommendations(report)

	return report, nil
}
