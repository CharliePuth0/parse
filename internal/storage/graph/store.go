package graph

import (
	"context"
	"fmt"
	"time"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"github.com/sugerdaddy/go-code-risk-analyzer/pkg/models"
)

// Store Neo4j图数据库存储
type Store struct {
	driver neo4j.DriverWithContext
	config *Config
}

// Config 配置
type Config struct {
	URI      string
	Username string
	Password string
	Database string
}

// NewStore 创建存储实例
func NewStore(config *Config) (*Store, error) {
	driver, err := neo4j.NewDriverWithContext(
		config.URI,
		neo4j.BasicAuth(config.Username, config.Password, ""),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create driver: %w", err)
	}

	// 验证连接
	ctx := context.Background()
	err = driver.VerifyConnectivity(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to verify connectivity: %w", err)
	}

	return &Store{
		driver: driver,
		config: config,
	}, nil
}

// Close 关闭连接
func (s *Store) Close(ctx context.Context) error {
	return s.driver.Close(ctx)
}

// SaveSymbol 保存符号
func (s *Store) SaveSymbol(ctx context.Context, symbol *models.Symbol) error {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	query := `
		MERGE (s:Symbol {id: $id})
		SET s.name = $name,
		    s.full_name = $full_name,
		    s.type = $type,
		    s.package = $package,
		    s.file = $file,
		    s.start_line = $start_line,
		    s.end_line = $end_line,
		    s.signature = $signature,
		    s.is_exported = $is_exported,
		    s.receiver_type = $receiver_type,
		    s.complexity = $complexity
	`

	params := map[string]interface{}{
		"id":            symbol.ID,
		"name":          symbol.Name,
		"full_name":     symbol.FullName,
		"type":          symbol.Type,
		"package":       symbol.Package,
		"file":          symbol.File,
		"start_line":    symbol.StartLine,
		"end_line":      symbol.EndLine,
		"signature":     symbol.Signature,
		"is_exported":   symbol.IsExported,
		"receiver_type": symbol.ReceiverType,
		"complexity":    symbol.Complexity,
	}

	_, err := session.Run(ctx, query, params)
	return err
}

// SaveCallRelation 保存调用关系
func (s *Store) SaveCallRelation(ctx context.Context, relation *models.CallRelation) error {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	query := `
		MATCH (from:Symbol {full_name: $from})
		MATCH (to:Symbol {full_name: $to})
		MERGE (from)-[r:CALLS {type: $type}]->(to)
		SET r.position = $position,
		    r.count = $count
	`

	params := map[string]interface{}{
		"from":     relation.From,
		"to":       relation.To,
		"type":     relation.Type,
		"position": relation.Position,
		"count":    relation.Count,
	}

	_, err := session.Run(ctx, query, params)
	return err
}

// SaveDependencyRelation 保存依赖关系
func (s *Store) SaveDependencyRelation(ctx context.Context, relation *models.DependencyRelation) error {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	query := `
		MERGE (from:Package {name: $from})
		MERGE (to:Package {name: $to})
		MERGE (from)-[r:IMPORTS {type: $type}]->(to)
		SET r.is_std = $is_std
	`

	params := map[string]interface{}{
		"from":   relation.From,
		"to":     relation.To,
		"type":   relation.Type,
		"is_std": relation.IsStd,
	}

	_, err := session.Run(ctx, query, params)
	return err
}

// FindCallers 查找调用者
func (s *Store) FindCallers(ctx context.Context, funcName string, maxDepth int) ([]string, error) {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	query := fmt.Sprintf(`
		MATCH (target:Symbol {full_name: $func_name})
		MATCH path = (caller:Symbol)-[:CALLS*1..%d]->(target)
		RETURN DISTINCT caller.full_name as name
	`, maxDepth)

	result, err := session.Run(ctx, query, map[string]interface{}{
		"func_name": funcName,
	})
	if err != nil {
		return nil, err
	}

	callers := make([]string, 0)
	for result.Next(ctx) {
		record := result.Record()
		if name, ok := record.Get("name"); ok {
			callers = append(callers, name.(string))
		}
	}

	return callers, result.Err()
}

// FindCallees 查找被调用者
func (s *Store) FindCallees(ctx context.Context, funcName string, maxDepth int) ([]string, error) {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	query := fmt.Sprintf(`
		MATCH (caller:Symbol {full_name: $func_name})
		MATCH path = (caller)-[:CALLS*1..%d]->(callee:Symbol)
		RETURN DISTINCT callee.full_name as name
	`, maxDepth)

	result, err := session.Run(ctx, query, map[string]interface{}{
		"func_name": funcName,
	})
	if err != nil {
		return nil, err
	}

	callees := make([]string, 0)
	for result.Next(ctx) {
		record := result.Record()
		if name, ok := record.Get("name"); ok {
			callees = append(callees, name.(string))
		}
	}

	return callees, result.Err()
}

// GetImpactGraph 获取影响图
func (s *Store) GetImpactGraph(ctx context.Context, funcName string, maxDepth int) (*models.ImpactGraph, error) {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	query := fmt.Sprintf(`
		MATCH (target:Symbol {full_name: $func_name})
		OPTIONAL MATCH path = (caller:Symbol)-[:CALLS*1..%d]->(target)
		WITH target, path
		UNWIND nodes(path) as node
		WITH collect(DISTINCT node) as other_nodes, target
		WITH other_nodes + [target] as all_nodes
		UNWIND all_nodes as n
		OPTIONAL MATCH (n)-[r:CALLS]->(m)
		WHERE m IN all_nodes
		RETURN 
			collect(DISTINCT {
				id: n.full_name, 
				label: n.name, 
				type: n.type,
				file: n.file,
				line: n.start_line
			}) as nodes,
			collect(DISTINCT {
				from: n.full_name, 
				to: m.full_name,
				type: r.type
			}) as edges
	`, maxDepth)

	result, err := session.Run(ctx, query, map[string]interface{}{
		"func_name": funcName,
	})
	if err != nil {
		return nil, err
	}

	graph := &models.ImpactGraph{
		Nodes: make([]*models.ImpactNode, 0),
		Edges: make([]*models.ImpactEdge, 0),
	}

	if result.Next(ctx) {
		record := result.Record()

		if nodesData, ok := record.Get("nodes"); ok {
			for _, nodeData := range nodesData.([]interface{}) {
				nodeMap := nodeData.(map[string]interface{})
				node := &models.ImpactNode{
					ID:    nodeMap["id"].(string),
					Label: nodeMap["label"].(string),
					Type:  nodeMap["type"].(string),
					Props: make(map[string]interface{}),
				}
				if file, ok := nodeMap["file"]; ok {
					node.Props["file"] = file
				}
				if line, ok := nodeMap["line"]; ok {
					node.Props["line"] = line
				}
				graph.Nodes = append(graph.Nodes, node)
			}
		}

		if edgesData, ok := record.Get("edges"); ok {
			for _, edgeData := range edgesData.([]interface{}) {
				edgeMap := edgeData.(map[string]interface{})
				if edgeMap["to"] != nil {
					edge := &models.ImpactEdge{
						From:   edgeMap["from"].(string),
						To:     edgeMap["to"].(string),
						Type:   edgeMap["type"].(string),
						Weight: 1,
					}
					graph.Edges = append(graph.Edges, edge)
				}
			}
		}
	}

	return graph, result.Err()
}

// GetPackageDependencies 获取包依赖
func (s *Store) GetPackageDependencies(ctx context.Context, packageName string) ([]*models.DependencyRelation, error) {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	query := `
		MATCH (pkg:Package {name: $package})-[r:IMPORTS]->(dep:Package)
		RETURN dep.name as to, r.type as type, r.is_std as is_std
	`

	result, err := session.Run(ctx, query, map[string]interface{}{
		"package": packageName,
	})
	if err != nil {
		return nil, err
	}

	dependencies := make([]*models.DependencyRelation, 0)
	for result.Next(ctx) {
		record := result.Record()
		dep := &models.DependencyRelation{
			From: packageName,
		}
		if to, ok := record.Get("to"); ok {
			dep.To = to.(string)
		}
		if depType, ok := record.Get("type"); ok {
			dep.Type = depType.(string)
		}
		if isStd, ok := record.Get("is_std"); ok {
			dep.IsStd = isStd.(bool)
		}
		dependencies = append(dependencies, dep)
	}

	return dependencies, result.Err()
}

// ClearAll 清空所有数据
func (s *Store) ClearAll(ctx context.Context) error {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	queries := []string{
		"MATCH (n:Symbol) DETACH DELETE n",
		"MATCH (n:Package) DETACH DELETE n",
	}

	for _, query := range queries {
		_, err := session.Run(ctx, query, nil)
		if err != nil {
			return err
		}
	}

	return nil
}

// CreateIndexes 创建索引
func (s *Store) CreateIndexes(ctx context.Context) error {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	indexes := []string{
		"CREATE INDEX symbol_id IF NOT EXISTS FOR (s:Symbol) ON (s.id)",
		"CREATE INDEX symbol_full_name IF NOT EXISTS FOR (s:Symbol) ON (s.full_name)",
		"CREATE INDEX symbol_name IF NOT EXISTS FOR (s:Symbol) ON (s.name)",
		"CREATE INDEX symbol_package IF NOT EXISTS FOR (s:Symbol) ON (s.package)",
		"CREATE INDEX package_name IF NOT EXISTS FOR (p:Package) ON (p.name)",
		"CREATE INDEX repository_name IF NOT EXISTS FOR (r:Repository) ON (r.name)",
		"CREATE INDEX branch_name_repo IF NOT EXISTS FOR (b:Branch) ON (b.name, b.repo)",
	}

	for _, index := range indexes {
		_, err := session.Run(ctx, index, nil)
		if err != nil {
			return fmt.Errorf("failed to create index: %w", err)
		}
	}

	return nil
}

// BatchSaveSymbols 批量保存符号
func (s *Store) BatchSaveSymbols(ctx context.Context, symbols []*models.Symbol) error {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
			UNWIND $symbols as symbol
			MERGE (s:Symbol {id: symbol.id})
			SET s = symbol
		`

		symbolMaps := make([]map[string]interface{}, len(symbols))
		for i, sym := range symbols {
			symbolMaps[i] = map[string]interface{}{
				"id":            sym.ID,
				"name":          sym.Name,
				"full_name":     sym.FullName,
				"type":          sym.Type,
				"package":       sym.Package,
				"file":          sym.File,
				"start_line":    sym.StartLine,
				"end_line":      sym.EndLine,
				"signature":     sym.Signature,
				"is_exported":   sym.IsExported,
				"receiver_type": sym.ReceiverType,
				"complexity":    sym.Complexity,
			}
		}

		_, err := tx.Run(ctx, query, map[string]interface{}{
			"symbols": symbolMaps,
		})
		return nil, err
	})
	return err
}

// SaveRepository 保存仓库信息
func (s *Store) SaveRepository(ctx context.Context, repo *models.Repository) error {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	query := `
		MERGE (r:Repository {name: $name})
		SET r.url = $url, r.updated_at = datetime()
	`

	_, err := session.Run(ctx, query, map[string]interface{}{
		"name": repo.Name,
		"url":  repo.URL,
	})
	return err
}

// SaveBranchComparison 保存分支对比记录
func (s *Store) SaveBranchComparison(ctx context.Context, comp *models.BranchComparison) error {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	query := `
		MERGE (r:Repository {name: $repo_name})
		MERGE (b1:Branch {name: $base_branch, repo: $repo_name})
		MERGE (b2:Branch {name: $target_branch, repo: $repo_name})
		MERGE (r)-[:HAS_BRANCH]->(b1)
		MERGE (r)-[:HAS_BRANCH]->(b2)
		CREATE (b2)-[c:COMPARED_WITH]->(b1)
		SET c.id = $id,
		    c.base_commit = $base_commit,
		    c.target_commit = $target_commit,
		    c.analyzed_at = datetime($analyzed_at),
		    c.conflict_count = $conflict_count,
		    c.diff_file_count = $diff_file_count,
		    c.risk_score = $risk_score,
		    c.risk_level = $risk_level
	`

	params := map[string]interface{}{
		"repo_name":       comp.RepoName,
		"base_branch":     comp.BaseBranch,
		"target_branch":   comp.TargetBranch,
		"id":              comp.ID,
		"base_commit":     comp.BaseCommit,
		"target_commit":   comp.TargetCommit,
		"analyzed_at":     comp.AnalyzedAt.Format(time.RFC3339),
		"conflict_count":  comp.ConflictCount,
		"diff_file_count": comp.DiffFileCount,
		"risk_score":      comp.RiskScore,
		"risk_level":      comp.RiskLevel,
	}

	_, err := session.Run(ctx, query, params)
	return err
}

// GetLatestBranchComparison 获取最新的分支对比记录
func (s *Store) GetLatestBranchComparison(ctx context.Context, repoName, baseBranch, targetBranch string) (*models.BranchComparison, error) {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	query := `
		MATCH (b2:Branch {name: $target_branch, repo: $repo_name})-[c:COMPARED_WITH]->(b1:Branch {name: $base_branch, repo: $repo_name})
		RETURN c.id as id, c.base_commit as base_commit, c.target_commit as target_commit, 
		       toString(c.analyzed_at) as analyzed_at, c.conflict_count as conflict_count,
		       c.diff_file_count as diff_file_count, c.risk_score as risk_score,
		       c.risk_level as risk_level
		ORDER BY c.analyzed_at DESC
		LIMIT 1
	`

	result, err := session.Run(ctx, query, map[string]interface{}{
		"repo_name":     repoName,
		"base_branch":   baseBranch,
		"target_branch": targetBranch,
	})
	if err != nil {
		return nil, err
	}

	if result.Next(ctx) {
		return s.mapRecordToBranchComparison(result.Record(), repoName, baseBranch, targetBranch), nil
	}

	return nil, nil
}

// FindBranchComparisons 查找分支对比历史
// baseBranch: 目标分支（如 main），如果为空则不限制
// targetBranch: 源分支（如 feature），如果为空则不限制
// limit: 返回记录数量限制
func (s *Store) FindBranchComparisons(ctx context.Context, repoName, baseBranch, targetBranch string, limit int) ([]*models.BranchComparison, error) {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	// 构建动态查询
	query := "MATCH (b2:Branch {repo: $repo_name})-[c:COMPARED_WITH]->(b1:Branch {repo: $repo_name}) WHERE 1=1 "
	params := map[string]interface{}{
		"repo_name": repoName,
		"limit":     limit,
	}

	if baseBranch != "" {
		query += "AND b1.name = $base_branch "
		params["base_branch"] = baseBranch
	}
	if targetBranch != "" {
		query += "AND b2.name = $target_branch "
		params["target_branch"] = targetBranch
	}

	query += `
		RETURN c.id as id, c.base_commit as base_commit, c.target_commit as target_commit, 
		       toString(c.analyzed_at) as analyzed_at, c.conflict_count as conflict_count,
		       c.diff_file_count as diff_file_count, c.risk_score as risk_score,
		       c.risk_level as risk_level,
		       b1.name as base_branch_name,
		       b2.name as target_branch_name
		ORDER BY c.analyzed_at DESC
		LIMIT $limit
	`

	result, err := session.Run(ctx, query, params)
	if err != nil {
		return nil, err
	}

	comparisons := make([]*models.BranchComparison, 0)
	for result.Next(ctx) {
		record := result.Record()

		// 获取分支名称（如果未指定，从查询结果中获取）
		currentBase := baseBranch
		if currentBase == "" {
			if b, ok := record.Get("base_branch_name"); ok {
				currentBase = b.(string)
			}
		}

		currentTarget := targetBranch
		if currentTarget == "" {
			if t, ok := record.Get("target_branch_name"); ok {
				currentTarget = t.(string)
			}
		}

		comp := s.mapRecordToBranchComparison(record, repoName, currentBase, currentTarget)
		comparisons = append(comparisons, comp)
	}

	return comparisons, result.Err()
}

// mapRecordToBranchComparison 将Neo4j记录映射为BranchComparison结构体
func (s *Store) mapRecordToBranchComparison(record *neo4j.Record, repoName, baseBranch, targetBranch string) *models.BranchComparison {
	comp := &models.BranchComparison{
		RepoName:     repoName,
		BaseBranch:   baseBranch,
		TargetBranch: targetBranch,
	}

	if id, ok := record.Get("id"); ok && id != nil {
		comp.ID = id.(string)
	}
	if bc, ok := record.Get("base_commit"); ok && bc != nil {
		comp.BaseCommit = bc.(string)
	}
	if tc, ok := record.Get("target_commit"); ok && tc != nil {
		comp.TargetCommit = tc.(string)
	}
	if at, ok := record.Get("analyzed_at"); ok && at != nil {
		t, _ := time.Parse(time.RFC3339, at.(string))
		comp.AnalyzedAt = t
	}
	if cc, ok := record.Get("conflict_count"); ok && cc != nil {
		comp.ConflictCount = int(cc.(int64))
	}
	if dfc, ok := record.Get("diff_file_count"); ok && dfc != nil {
		comp.DiffFileCount = int(dfc.(int64))
	}
	if rs, ok := record.Get("risk_score"); ok && rs != nil {
		comp.RiskScore = rs.(float64)
	}
	if rl, ok := record.Get("risk_level"); ok && rl != nil {
		comp.RiskLevel = rl.(string)
	}

	return comp
}

// BatchSaveCallRelations 批量保存调用关系
func (s *Store) BatchSaveCallRelations(ctx context.Context, relations []*models.CallRelation) error {
	session := s.driver.NewSession(ctx, neo4j.SessionConfig{
		DatabaseName: s.config.Database,
	})
	defer session.Close(ctx)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
			UNWIND $relations as rel
			MATCH (from:Symbol {full_name: rel.from})
			MATCH (to:Symbol {full_name: rel.to})
			MERGE (from)-[r:CALLS {type: rel.type}]->(to)
			SET r.position = rel.position, r.count = rel.count
		`

		relationMaps := make([]map[string]interface{}, len(relations))
		for i, rel := range relations {
			relationMaps[i] = map[string]interface{}{
				"from":     rel.From,
				"to":       rel.To,
				"type":     rel.Type,
				"position": rel.Position,
				"count":    rel.Count,
			}
		}

		_, err := tx.Run(ctx, query, map[string]interface{}{
			"relations": relationMaps,
		})
		return nil, err
	})
	return err
}
