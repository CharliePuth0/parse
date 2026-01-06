package graph

import (
	"context"
	"fmt"

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
