package impact

import (
	"sort"

	"github.com/sugerdaddy/go-code-risk-analyzer/internal/analyzer/callgraph"
	"github.com/sugerdaddy/go-code-risk-analyzer/pkg/models"
)

// Analyzer 影响面分析器
// 参考美团后羿系统的影响面评估方法论
type Analyzer struct {
	callGraph *callgraph.Builder
	config    *Config
}

// Config 影响面分析配置
type Config struct {
	MaxDepth          int     // 最大分析深度
	MaxBreadth        int     // 最大广度(每层最多分析的节点数)
	DirectWeight      float64 // 直接影响权重
	IndirectWeight    float64 // 间接影响权重
	CriticalPathBonus float64 // 关键路径加权
	EnableCaching     bool    // 启用缓存优化
}

// DefaultConfig 默认配置
func DefaultConfig() *Config {
	return &Config{
		MaxDepth:          10,
		MaxBreadth:        100,
		DirectWeight:      2.0,
		IndirectWeight:    1.0,
		CriticalPathBonus: 1.5,
		EnableCaching:     true,
	}
}

// NewAnalyzer 创建影响面分析器
func NewAnalyzer(callGraph *callgraph.Builder, config *Config) *Analyzer {
	if config == nil {
		config = DefaultConfig()
	}
	return &Analyzer{
		callGraph: callGraph,
		config:    config,
	}
}

// ImpactResult 影响面分析结果
type ImpactResult struct {
	FuncName       string              // 被分析的函数名
	DirectImpact   int                 // 直接影响数(调用者数量)
	IndirectImpact int                 // 间接影响数(传播链上的所有调用者)
	TotalImpact    int                 // 总影响数
	MaxDepth       int                 // 最大传播深度
	ImpactScore    float64             // 影响面得分
	ImpactByLevel  map[int]int         // 按层级统计的影响数
	CriticalPaths  [][]string          // 关键传播路径
	TopImpactFuncs []*ImpactFuncInfo   // 影响力最大的函数列表
	ImpactGraph    map[string][]string // 影响传播图(用于可视化)
}

// ImpactFuncInfo 影响函数信息
type ImpactFuncInfo struct {
	Name       string  // 函数名
	Distance   int     // 与变更函数的距离
	Importance float64 // 重要性得分
	CallCount  int     // 被调用次数
	IsCritical bool    // 是否在关键路径上
}

// AnalyzeImpact 分析函数的影响面
func (a *Analyzer) AnalyzeImpact(funcName string) *ImpactResult {
	result := &ImpactResult{
		FuncName:       funcName,
		ImpactByLevel:  make(map[int]int),
		CriticalPaths:  make([][]string, 0),
		TopImpactFuncs: make([]*ImpactFuncInfo, 0),
		ImpactGraph:    make(map[string][]string),
	}

	if a.callGraph == nil {
		return result
	}

	// 使用 BFS 分析影响传播
	visited := make(map[string]bool)
	levelFuncs := make(map[string]int) // 记录每个函数的层级
	queue := []struct {
		name  string
		depth int
		path  []string
	}{{funcName, 0, []string{funcName}}}

	visited[funcName] = true
	levelFuncs[funcName] = 0

	var allPaths [][]string

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		if current.depth > a.config.MaxDepth {
			continue
		}

		// 查找所有调用当前函数的调用者
		callers := a.findCallers(current.name)

		if len(callers) == 0 && current.depth > 0 {
			// 这是一条完整的传播路径
			allPaths = append(allPaths, current.path)
		}

		// 统计当前层级的影响数
		if current.depth > 0 {
			result.ImpactByLevel[current.depth]++
		}

		// 构建影响图
		result.ImpactGraph[current.name] = callers

		// 继续向上追溯
		addedInLevel := 0
		for _, caller := range callers {
			if visited[caller] {
				continue
			}

			if addedInLevel >= a.config.MaxBreadth {
				break
			}

			visited[caller] = true
			levelFuncs[caller] = current.depth + 1

			newPath := make([]string, len(current.path)+1)
			copy(newPath, current.path)
			newPath[len(current.path)] = caller

			queue = append(queue, struct {
				name  string
				depth int
				path  []string
			}{caller, current.depth + 1, newPath})

			addedInLevel++
		}

		if current.depth > result.MaxDepth {
			result.MaxDepth = current.depth
		}
	}

	// 计算直接和间接影响
	for fn, level := range levelFuncs {
		if fn == funcName {
			continue
		}
		if level == 1 {
			result.DirectImpact++
		} else {
			result.IndirectImpact++
		}
	}

	result.TotalImpact = result.DirectImpact + result.IndirectImpact

	// 选择关键路径(最长的几条路径)
	result.CriticalPaths = a.selectCriticalPaths(allPaths, 5)

	// 计算影响力得分
	result.ImpactScore = a.calculateImpactScore(result)

	// 获取影响力最大的函数
	result.TopImpactFuncs = a.getTopImpactFuncs(levelFuncs, 10)

	return result
}

// findCallers 查找调用指定函数的所有调用者
func (a *Analyzer) findCallers(funcName string) []string {
	if a.callGraph == nil {
		return nil
	}
	return a.callGraph.FindCallers(funcName)
}

// selectCriticalPaths 选择关键传播路径
func (a *Analyzer) selectCriticalPaths(paths [][]string, maxCount int) [][]string {
	if len(paths) <= maxCount {
		return paths
	}

	// 按路径长度排序,选择最长的几条
	sort.Slice(paths, func(i, j int) bool {
		return len(paths[i]) > len(paths[j])
	})

	return paths[:maxCount]
}

// calculateImpactScore 计算影响面得分
func (a *Analyzer) calculateImpactScore(result *ImpactResult) float64 {
	// 基于美团后羿系统的评分公式
	// 得分 = 直接影响 * 直接权重 + 间接影响 * 间接权重 * 衰减系数
	score := float64(result.DirectImpact) * a.config.DirectWeight

	// 间接影响按深度衰减
	for level, count := range result.ImpactByLevel {
		if level > 1 {
			decay := 1.0 / float64(level) // 衰减系数
			score += float64(count) * a.config.IndirectWeight * decay
		}
	}

	// 关键路径加成
	if len(result.CriticalPaths) > 0 {
		maxPathLen := len(result.CriticalPaths[0])
		if maxPathLen > 3 {
			score *= a.config.CriticalPathBonus
		}
	}

	return score
}

// getTopImpactFuncs 获取影响力最大的函数
func (a *Analyzer) getTopImpactFuncs(levelFuncs map[string]int, maxCount int) []*ImpactFuncInfo {
	var funcs []*ImpactFuncInfo

	for fn, level := range levelFuncs {
		if level == 0 {
			continue // 跳过源函数
		}

		// 计算重要性(距离越近,调用越多,越重要)
		callCount := len(a.findCallers(fn))
		importance := (1.0 / float64(level)) * float64(1+callCount)

		funcs = append(funcs, &ImpactFuncInfo{
			Name:       fn,
			Distance:   level,
			Importance: importance,
			CallCount:  callCount,
			IsCritical: level <= 2, // 距离小于等于2视为关键
		})
	}

	// 按重要性排序
	sort.Slice(funcs, func(i, j int) bool {
		return funcs[i].Importance > funcs[j].Importance
	})

	if len(funcs) > maxCount {
		funcs = funcs[:maxCount]
	}

	return funcs
}

// ToModel 转换为模型
func (r *ImpactResult) ToModel() *models.ImpactDetail {
	impactByLevel := make(map[int]int)
	for k, v := range r.ImpactByLevel {
		impactByLevel[k] = v
	}

	topFuncs := make([]*models.ImpactFuncInfo, len(r.TopImpactFuncs))
	for i, f := range r.TopImpactFuncs {
		topFuncs[i] = &models.ImpactFuncInfo{
			Name:       f.Name,
			Distance:   f.Distance,
			Importance: f.Importance,
			CallCount:  f.CallCount,
			IsCritical: f.IsCritical,
		}
	}

	return &models.ImpactDetail{
		TotalImpact:     r.TotalImpact,
		MaxDepthReached: r.MaxDepth,
		ImpactScore:     r.ImpactScore,
		ImpactByLevel:   impactByLevel,
		CriticalPaths:   r.CriticalPaths,
		TopImpactFuncs:  topFuncs,
	}
}
