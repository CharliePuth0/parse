package models

import "time"

// AnalysisTask 分析任务
type AnalysisTask struct {
	ID           string    `json:"id"`
	RepoPath     string    `json:"repo_path"`
	BaseCommit   string    `json:"base_commit"`
	TargetCommit string    `json:"target_commit"`
	Status       string    `json:"status"` // pending, running, completed, failed
	Progress     int       `json:"progress"`
	CreatedAt    time.Time `json:"created_at"`
	CompletedAt  time.Time `json:"completed_at,omitempty"`
	Error        string    `json:"error,omitempty"`
}

// ChangeFile 变更文件
type ChangeFile struct {
	Path         string        `json:"path"`
	Type         string        `json:"type"` // added, modified, deleted
	Package      string        `json:"package"`
	AddedLines   int           `json:"added_lines"`
	DeletedLines int           `json:"deleted_lines"`
	Functions    []*ChangeFunc `json:"functions"`
	Imports      []string      `json:"imports"`
}

// ChangeFunc 变更函数
type ChangeFunc struct {
	Name         string   `json:"name"`
	Signature    string   `json:"signature"`
	ReceiverType string   `json:"receiver_type,omitempty"`
	StartLine    int      `json:"start_line"`
	EndLine      int      `json:"end_line"`
	IsNew        bool     `json:"is_new"`
	IsModified   bool     `json:"is_modified"`
	IsDeleted    bool     `json:"is_deleted"`
	ChangeType   string   `json:"change_type"` // signature, body, both
	Complexity   int      `json:"complexity"`
	CalledBy     []string `json:"called_by"` // 被谁调用
	Calls        []string `json:"calls"`     // 调用了谁
}

// Symbol 符号(函数、方法、类型等)
type Symbol struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	FullName     string                 `json:"full_name"` // 包含包路径的完整名称
	Type         string                 `json:"type"`      // function, method, interface, struct, variable
	Package      string                 `json:"package"`
	File         string                 `json:"file"`
	StartLine    int                    `json:"start_line"`
	EndLine      int                    `json:"end_line"`
	Signature    string                 `json:"signature"`
	IsExported   bool                   `json:"is_exported"`
	ReceiverType string                 `json:"receiver_type,omitempty"`
	Complexity   int                    `json:"complexity"`
	Properties   map[string]interface{} `json:"properties,omitempty"`
}

// CallRelation 调用关系
type CallRelation struct {
	From     string `json:"from"`     // 调用者
	To       string `json:"to"`       // 被调用者
	Type     string `json:"type"`     // direct, indirect, interface
	Position string `json:"position"` // 调用位置 file:line
	Count    int    `json:"count"`    // 调用次数
}

// DependencyRelation 依赖关系
type DependencyRelation struct {
	From  string `json:"from"`   // 依赖方包
	To    string `json:"to"`     // 被依赖方包
	Type  string `json:"type"`   // import, embed
	IsStd bool   `json:"is_std"` // 是否标准库
}

// RiskReport 风险报告
type RiskReport struct {
	TaskID          string            `json:"task_id"`
	GeneratedAt     time.Time         `json:"generated_at"`
	Summary         *RiskSummary      `json:"summary"`
	Files           []*FileRisk       `json:"files"`
	Functions       []*FunctionRisk   `json:"functions"`
	Dependencies    []*DependencyRisk `json:"dependencies"`
	Features        []*FeatureRisk    `json:"features"`
	Recommendations []string          `json:"recommendations"`
}

// RiskSummary 风险摘要
type RiskSummary struct {
	TotalScore     float64         `json:"total_score"`
	Level          string          `json:"level"` // low, medium, high, critical
	FilesChanged   int             `json:"files_changed"`
	FuncsChanged   int             `json:"funcs_changed"`
	LinesChanged   int             `json:"lines_changed"`
	DirectImpact   int             `json:"direct_impact"`   // 直接影响的函数数
	IndirectImpact int             `json:"indirect_impact"` // 间接影响的函数数
	ScoreBreakdown *ScoreBreakdown `json:"score_breakdown"`
}

// ScoreBreakdown 分数分解
type ScoreBreakdown struct {
	ComplexityScore float64 `json:"complexity_score"`
	ImpactScore     float64 `json:"impact_score"`
	HistoryScore    float64 `json:"history_score"`
	FeatureScore    float64 `json:"feature_score"`
}

// FileRisk 文件风险
type FileRisk struct {
	Path         string   `json:"path"`
	Score        float64  `json:"score"`
	Level        string   `json:"level"`
	ChangeType   string   `json:"change_type"`
	Complexity   int      `json:"complexity"`
	ImpactCount  int      `json:"impact_count"`
	AddedLines   int      `json:"added_lines"`
	DeletedLines int      `json:"deleted_lines"`
	Package      string   `json:"package"`
	Functions    []string `json:"functions"`
	Issues       []string `json:"issues"`
}

// FunctionRisk 函数风险
type FunctionRisk struct {
	Name           string        `json:"name"`
	FullName       string        `json:"full_name"`
	File           string        `json:"file"`
	Line           int           `json:"line"`
	Score          float64       `json:"score"`
	Level          string        `json:"level"`
	Complexity     int           `json:"complexity"`
	DirectImpact   int           `json:"direct_impact"`
	IndirectImpact int           `json:"indirect_impact"`
	ChangeType     string        `json:"change_type"`
	ImpactPath     []string      `json:"impact_path"`
	Features       []string      `json:"features"`
	Issues         []string      `json:"issues"`
	ImpactDetail   *ImpactDetail `json:"impact_detail,omitempty"`
}

// DependencyRisk 依赖风险
type DependencyRisk struct {
	Package   string   `json:"package"`
	Type      string   `json:"type"` // added, removed, version_changed
	IsNew     bool     `json:"is_new"`
	IsRemoved bool     `json:"is_removed"`
	Impact    int      `json:"impact"` // 影响的文件数
	Issues    []string `json:"issues"`
}

// FeatureRisk 特征风险
type FeatureRisk struct {
	Type        string   `json:"type"`      // 风险类型
	Severity    string   `json:"severity"`  // low, medium, high
	Count       int      `json:"count"`     // 出现次数
	Locations   []string `json:"locations"` // 位置列表
	Description string   `json:"description"`
	Suggestion  string   `json:"suggestion"`
}

// ImpactGraph 影响图
type ImpactGraph struct {
	Nodes []*ImpactNode `json:"nodes"`
	Edges []*ImpactEdge `json:"edges"`
}

// ImpactNode 影响节点
type ImpactNode struct {
	ID       string                 `json:"id"`
	Label    string                 `json:"label"`
	Type     string                 `json:"type"` // function, package, file
	IsChange bool                   `json:"is_change"`
	Level    int                    `json:"level"` // 影响层级
	Props    map[string]interface{} `json:"props,omitempty"`
}

// ImpactEdge 影响边
type ImpactEdge struct {
	From   string `json:"from"`
	To     string `json:"to"`
	Type   string `json:"type"`   // call, import, implement
	Weight int    `json:"weight"` // 权重
}

// ComplexityMetrics 复杂度指标
type ComplexityMetrics struct {
	Cyclomatic      int     `json:"cyclomatic"`      // 圈复杂度
	Cognitive       int     `json:"cognitive"`       // 认知复杂度
	Lines           int     `json:"lines"`           // 代码行数
	Parameters      int     `json:"parameters"`      // 参数个数
	ReturnValues    int     `json:"return_values"`   // 返回值个数
	NestedLevel     int     `json:"nested_level"`    // 最大嵌套层级
	Maintainability float64 `json:"maintainability"` // 可维护性指数
}

// InterfaceChange 接口变更
type InterfaceChange struct {
	Name            string   `json:"name"`
	Package         string   `json:"package"`
	ChangeType      string   `json:"change_type"` // added, removed, modified
	AddedMethods    []string `json:"added_methods,omitempty"`
	RemovedMethods  []string `json:"removed_methods,omitempty"`
	ModifiedMethods []string `json:"modified_methods,omitempty"`
	Implementations []string `json:"implementations"` // 实现该接口的类型
}

// ConcurrencyFeature 并发特征
type ConcurrencyFeature struct {
	Function     string   `json:"function"`
	HasGoroutine bool     `json:"has_goroutine"`
	HasChannel   bool     `json:"has_channel"`
	HasMutex     bool     `json:"has_mutex"`
	HasWaitGroup bool     `json:"has_wait_group"`
	HasContext   bool     `json:"has_context"`
	Issues       []string `json:"issues"`
}

// ImpactDetail 影响面详情(参考美团后羿系统)
type ImpactDetail struct {
	TotalImpact     int               `json:"total_impact"`
	MaxDepthReached int               `json:"max_depth_reached"`
	ImpactScore     float64           `json:"impact_score"`
	ImpactByLevel   map[int]int       `json:"impact_by_level"`
	CriticalPaths   [][]string        `json:"critical_paths"`
	TopImpactFuncs  []*ImpactFuncInfo `json:"top_impact_funcs"`
}

// ImpactFuncInfo 受影响函数信息
type ImpactFuncInfo struct {
	Name       string  `json:"name"`
	Distance   int     `json:"distance"`
	Importance float64 `json:"importance"`
	CallCount  int     `json:"call_count"`
	IsCritical bool    `json:"is_critical"`
}

// ImpactSummary 影响面摘要统计
type ImpactSummary struct {
	TotalFunctions        int            `json:"total_functions"`
	AverageDirectImpact   float64        `json:"average_direct_impact"`
	AverageIndirectImpact float64        `json:"average_indirect_impact"`
	MaxImpactScore        float64        `json:"max_impact_score"`
	HighestImpactFunc     string         `json:"highest_impact_func"`
	ImpactDistribution    map[string]int `json:"impact_distribution"`
}
