package callgraph

import (
	"fmt"
	"go/ast"
	"go/types"
	"strings"

	"github.com/sugerdaddy/go-code-risk-analyzer/pkg/models"
	"golang.org/x/tools/go/callgraph"
	// "golang.org/x/tools/go/callgraph/cha"  // 预留用于更精确的分析
	"golang.org/x/tools/go/callgraph/static"
	"golang.org/x/tools/go/packages"
	"golang.org/x/tools/go/ssa"
	"golang.org/x/tools/go/ssa/ssautil"
)

// Builder 调用图构建器
type Builder struct {
	packages  map[string]*packages.Package
	callGraph *callgraph.Graph
	prog      *ssa.Program
}

// NewBuilder 创建调用图构建器
func NewBuilder() *Builder {
	return &Builder{
		packages: make(map[string]*packages.Package),
	}
}

// LoadPackage 加载包
func (b *Builder) LoadPackage(pkgPath string) error {
	cfg := &packages.Config{
		Mode: packages.NeedName |
			packages.NeedFiles |
			packages.NeedCompiledGoFiles |
			packages.NeedImports |
			packages.NeedDeps |
			packages.NeedTypes |
			packages.NeedSyntax |
			packages.NeedTypesInfo,
	}

	pkgs, err := packages.Load(cfg, pkgPath)
	if err != nil {
		return fmt.Errorf("failed to load package: %w", err)
	}

	for _, pkg := range pkgs {
		b.packages[pkg.PkgPath] = pkg
	}

	return nil
}

// Build 构建调用图
func (b *Builder) Build() error {
	// 创建SSA程序
	pkgList := make([]*packages.Package, 0, len(b.packages))
	for _, pkg := range b.packages {
		pkgList = append(pkgList, pkg)
	}

	prog, _ := ssautil.AllPackages(pkgList, ssa.InstantiateGenerics)
	prog.Build()

	b.prog = prog

	// 使用静态分析构建调用图
	b.callGraph = static.CallGraph(prog)

	// 也可以使用CHA算法(更精确但更慢)
	// b.callGraph = cha.CallGraph(prog)

	return nil
}

// GetCallRelations 获取调用关系
func (b *Builder) GetCallRelations() []*models.CallRelation {
	if b.callGraph == nil {
		return nil
	}

	relations := make([]*models.CallRelation, 0)
	visited := make(map[string]bool)

	// 遍历调用图
	for _, node := range b.callGraph.Nodes {
		if node.Func == nil {
			continue
		}

		caller := b.getFunctionName(node.Func)

		for _, edge := range node.Out {
			if edge.Callee.Func == nil {
				continue
			}

			callee := b.getFunctionName(edge.Callee.Func)

			// 避免重复
			key := caller + "->" + callee
			if visited[key] {
				continue
			}
			visited[key] = true

			relation := &models.CallRelation{
				From:     caller,
				To:       callee,
				Type:     b.getCallType(edge),
				Position: b.getCallPosition(edge),
				Count:    1,
			}

			relations = append(relations, relation)
		}
	}

	return relations
}

// getFunctionName 获取函数名称
func (b *Builder) getFunctionName(fn *ssa.Function) string {
	if fn.Pkg != nil {
		pkg := fn.Pkg.Pkg.Path()
		if fn.Signature.Recv() != nil {
			// 方法
			recv := fn.Signature.Recv().Type().String()
			recv = strings.TrimPrefix(recv, "*")
			return fmt.Sprintf("%s.%s.%s", pkg, recv, fn.Name())
		}
		// 函数
		return fmt.Sprintf("%s.%s", pkg, fn.Name())
	}
	return fn.Name()
}

// getCallType 获取调用类型
func (b *Builder) getCallType(edge *callgraph.Edge) string {
	switch edge.Site.(type) {
	case *ssa.Call:
		return "direct"
	case *ssa.Go:
		return "goroutine"
	case *ssa.Defer:
		return "defer"
	default:
		return "indirect"
	}
}

// getCallPosition 获取调用位置
func (b *Builder) getCallPosition(edge *callgraph.Edge) string {
	if edge.Site == nil {
		return ""
	}

	if edge.Caller.Func == nil {
		return ""
	}

	prog := edge.Caller.Func.Prog
	pos := prog.Fset.Position(edge.Site.Pos())
	return fmt.Sprintf("%s:%d", pos.Filename, pos.Line)
}

// FindCallers 查找调用者
func (b *Builder) FindCallers(funcName string) []string {
	if b.callGraph == nil {
		return nil
	}

	callers := make([]string, 0)

	for _, node := range b.callGraph.Nodes {
		if node.Func == nil {
			continue
		}

		for _, edge := range node.Out {
			if edge.Callee.Func == nil {
				continue
			}

			callee := b.getFunctionName(edge.Callee.Func)
			if strings.Contains(callee, funcName) {
				caller := b.getFunctionName(node.Func)
				callers = append(callers, caller)
			}
		}
	}

	return callers
}

// FindCallees 查找被调用者
func (b *Builder) FindCallees(funcName string) []string {
	if b.callGraph == nil {
		return nil
	}

	callees := make([]string, 0)

	for _, node := range b.callGraph.Nodes {
		if node.Func == nil {
			continue
		}

		caller := b.getFunctionName(node.Func)
		if !strings.Contains(caller, funcName) {
			continue
		}

		for _, edge := range node.Out {
			if edge.Callee.Func == nil {
				continue
			}

			callee := b.getFunctionName(edge.Callee.Func)
			callees = append(callees, callee)
		}
	}

	return callees
}

// GetImpactChain 获取影响链(BFS遍历)
func (b *Builder) GetImpactChain(funcName string, maxDepth int) *models.ImpactGraph {
	if b.callGraph == nil {
		return nil
	}

	graph := &models.ImpactGraph{
		Nodes: make([]*models.ImpactNode, 0),
		Edges: make([]*models.ImpactEdge, 0),
	}

	visited := make(map[string]bool)
	queue := []struct {
		name  string
		level int
	}{{funcName, 0}}

	nodeMap := make(map[string]*models.ImpactNode)

	// 添加起始节点
	startNode := &models.ImpactNode{
		ID:       funcName,
		Label:    funcName,
		Type:     "function",
		IsChange: true,
		Level:    0,
	}
	graph.Nodes = append(graph.Nodes, startNode)
	nodeMap[funcName] = startNode

	// BFS遍历
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		if visited[current.name] {
			continue
		}
		visited[current.name] = true

		if current.level >= maxDepth {
			continue
		}

		// 查找调用者
		callers := b.FindCallers(current.name)
		for _, caller := range callers {
			if !visited[caller] {
				queue = append(queue, struct {
					name  string
					level int
				}{caller, current.level + 1})

				// 添加节点
				if _, ok := nodeMap[caller]; !ok {
					node := &models.ImpactNode{
						ID:       caller,
						Label:    caller,
						Type:     "function",
						IsChange: false,
						Level:    current.level + 1,
					}
					graph.Nodes = append(graph.Nodes, node)
					nodeMap[caller] = node
				}

				// 添加边
				edge := &models.ImpactEdge{
					From:   caller,
					To:     current.name,
					Type:   "call",
					Weight: 1,
				}
				graph.Edges = append(graph.Edges, edge)
			}
		}
	}

	return graph
}

// AnalyzeDependencies 分析包依赖
func (b *Builder) AnalyzeDependencies() []*models.DependencyRelation {
	relations := make([]*models.DependencyRelation, 0)
	visited := make(map[string]bool)

	for _, pkg := range b.packages {
		for importPath := range pkg.Imports {
			key := pkg.PkgPath + "->" + importPath
			if visited[key] {
				continue
			}
			visited[key] = true

			relation := &models.DependencyRelation{
				From:  pkg.PkgPath,
				To:    importPath,
				Type:  "import",
				IsStd: isStdPackage(importPath),
			}
			relations = append(relations, relation)
		}
	}

	return relations
}

// isStdPackage 判断是否是标准库
func isStdPackage(pkgPath string) bool {
	// 简化判断:不包含'.'的视为标准库
	return !strings.Contains(pkgPath, ".")
}

// FindInterfaceImplementations 查找接口实现
func (b *Builder) FindInterfaceImplementations(interfaceName string) map[string][]string {
	result := make(map[string][]string)

	for _, pkg := range b.packages {
		// 查找接口定义
		scope := pkg.Types.Scope()
		interfaceObj := scope.Lookup(interfaceName)
		if interfaceObj == nil {
			continue
		}

		interfaceType, ok := interfaceObj.Type().Underlying().(*types.Interface)
		if !ok {
			continue
		}

		// 查找实现
		implementations := make([]string, 0)
		for _, name := range scope.Names() {
			obj := scope.Lookup(name)
			if obj == interfaceObj {
				continue
			}

			// 检查是否实现接口
			if types.Implements(obj.Type(), interfaceType) {
				implementations = append(implementations, name)
			}

			// 检查指针类型是否实现接口
			if ptr := types.NewPointer(obj.Type()); types.Implements(ptr, interfaceType) {
				implementations = append(implementations, "*"+name)
			}
		}

		if len(implementations) > 0 {
			result[pkg.PkgPath] = implementations
		}
	}

	return result
}

// AnalyzeMethodCalls 分析方法调用
func (b *Builder) AnalyzeMethodCalls(file *ast.File) map[string][]string {
	result := make(map[string][]string)

	ast.Inspect(file, func(n ast.Node) bool {
		if funcDecl, ok := n.(*ast.FuncDecl); ok {
			funcName := funcDecl.Name.Name
			calls := make([]string, 0)

			ast.Inspect(funcDecl.Body, func(n ast.Node) bool {
				if callExpr, ok := n.(*ast.CallExpr); ok {
					callName := getCallName(callExpr.Fun)
					if callName != "" {
						calls = append(calls, callName)
					}
				}
				return true
			})

			result[funcName] = calls
		}
		return true
	})

	return result
}

// getCallName 获取调用名称
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

// BuildFromFiles 从文件列表构建调用图
func (b *Builder) BuildFromFiles(files []string) error {
	// 按包分组
	pkgMap := make(map[string][]string)
	for _, file := range files {
		// 从文件路径推导包路径
		// 这里简化处理,实际应该更精确
		pkgPath := "."
		pkgMap[pkgPath] = append(pkgMap[pkgPath], file)
	}

	// 加载包
	for pkgPath := range pkgMap {
		if err := b.LoadPackage(pkgPath); err != nil {
			return err
		}
	}

	// 构建调用图
	return b.Build()
}

// GetStatistics 获取统计信息
func (b *Builder) GetStatistics() map[string]interface{} {
	stats := make(map[string]interface{})

	if b.callGraph != nil {
		stats["node_count"] = len(b.callGraph.Nodes)

		edgeCount := 0
		for _, node := range b.callGraph.Nodes {
			edgeCount += len(node.Out)
		}
		stats["edge_count"] = edgeCount
	}

	stats["package_count"] = len(b.packages)

	return stats
}
