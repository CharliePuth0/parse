package ast

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"go/types"
	"path/filepath"
	"strings"

	"github.com/sugerdaddy/go-code-risk-analyzer/pkg/models"
	"golang.org/x/tools/go/packages"
)

// Analyzer AST分析器
type Analyzer struct {
	fset     *token.FileSet
	packages map[string]*packages.Package
}

// NewAnalyzer 创建AST分析器
func NewAnalyzer() *Analyzer {
	return &Analyzer{
		fset:     token.NewFileSet(),
		packages: make(map[string]*packages.Package),
	}
}

// ParseFile 解析单个文件
func (a *Analyzer) ParseFile(filePath string) (*ast.File, error) {
	return parser.ParseFile(a.fset, filePath, nil, parser.ParseComments)
}

// ParsePackage 解析包
func (a *Analyzer) ParsePackage(pkgPath string) (*packages.Package, error) {
	// 检查缓存
	if pkg, ok := a.packages[pkgPath]; ok {
		return pkg, nil
	}

	// 加载包
	cfg := &packages.Config{
		Mode: packages.NeedName |
			packages.NeedFiles |
			packages.NeedCompiledGoFiles |
			packages.NeedImports |
			packages.NeedDeps |
			packages.NeedTypes |
			packages.NeedSyntax |
			packages.NeedTypesInfo,
		Fset: a.fset,
	}

	pkgs, err := packages.Load(cfg, pkgPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load package: %w", err)
	}

	if len(pkgs) == 0 {
		return nil, fmt.Errorf("no packages found")
	}

	pkg := pkgs[0]
	if len(pkg.Errors) > 0 {
		// 记录错误但继续
		fmt.Printf("Warning: package %s has errors: %v\n", pkgPath, pkg.Errors)
	}

	a.packages[pkgPath] = pkg
	return pkg, nil
}

// ExtractSymbols 提取符号表
func (a *Analyzer) ExtractSymbols(file *ast.File, filePath string) ([]*models.Symbol, error) {
	symbols := make([]*models.Symbol, 0)

	// 获取包名
	pkgName := ""
	if file.Name != nil {
		pkgName = file.Name.Name
	}

	// 遍历所有声明
	for _, decl := range file.Decls {
		switch d := decl.(type) {
		case *ast.FuncDecl:
			// 函数/方法声明
			symbol := a.extractFuncSymbol(d, pkgName, filePath)
			symbols = append(symbols, symbol)

		case *ast.GenDecl:
			// 通用声明(类型、常量、变量、导入)
			genSymbols := a.extractGenDeclSymbols(d, pkgName, filePath)
			symbols = append(symbols, genSymbols...)
		}
	}

	return symbols, nil
}

// extractFuncSymbol 提取函数符号
func (a *Analyzer) extractFuncSymbol(funcDecl *ast.FuncDecl, pkgName, filePath string) *models.Symbol {
	symbol := &models.Symbol{
		Name:       funcDecl.Name.Name,
		Package:    pkgName,
		File:       filePath,
		IsExported: ast.IsExported(funcDecl.Name.Name),
		Properties: make(map[string]interface{}),
	}

	// 位置信息
	symbol.StartLine = a.fset.Position(funcDecl.Pos()).Line
	symbol.EndLine = a.fset.Position(funcDecl.End()).Line

	// 判断是函数还是方法
	if funcDecl.Recv != nil && len(funcDecl.Recv.List) > 0 {
		symbol.Type = "method"
		// 提取接收者类型
		recvType := funcDecl.Recv.List[0].Type
		symbol.ReceiverType = a.typeToString(recvType)
		symbol.FullName = fmt.Sprintf("%s.%s.%s", pkgName, symbol.ReceiverType, symbol.Name)
	} else {
		symbol.Type = "function"
		symbol.FullName = fmt.Sprintf("%s.%s", pkgName, symbol.Name)
	}

	// 生成签名
	symbol.Signature = a.generateFuncSignature(funcDecl)

	// 计算复杂度
	symbol.Complexity = a.calculateComplexity(funcDecl)

	// 提取参数和返回值信息
	if funcDecl.Type.Params != nil {
		symbol.Properties["param_count"] = funcDecl.Type.Params.NumFields()
	}
	if funcDecl.Type.Results != nil {
		symbol.Properties["return_count"] = funcDecl.Type.Results.NumFields()
	}

	// 生成唯一ID
	symbol.ID = fmt.Sprintf("%s:%d", filePath, symbol.StartLine)

	return symbol
}

// extractGenDeclSymbols 提取通用声明符号
func (a *Analyzer) extractGenDeclSymbols(genDecl *ast.GenDecl, pkgName, filePath string) []*models.Symbol {
	symbols := make([]*models.Symbol, 0)

	for _, spec := range genDecl.Specs {
		switch s := spec.(type) {
		case *ast.TypeSpec:
			// 类型声明
			symbol := &models.Symbol{
				Name:       s.Name.Name,
				Package:    pkgName,
				File:       filePath,
				FullName:   fmt.Sprintf("%s.%s", pkgName, s.Name.Name),
				IsExported: ast.IsExported(s.Name.Name),
				StartLine:  a.fset.Position(s.Pos()).Line,
				EndLine:    a.fset.Position(s.End()).Line,
				Properties: make(map[string]interface{}),
			}

			// 判断类型种类
			switch t := s.Type.(type) {
			case *ast.InterfaceType:
				symbol.Type = "interface"
				// 提取接口方法
				methods := make([]string, 0)
				if t.Methods != nil {
					for _, method := range t.Methods.List {
						if len(method.Names) > 0 {
							methods = append(methods, method.Names[0].Name)
						}
					}
				}
				symbol.Properties["methods"] = methods

			case *ast.StructType:
				symbol.Type = "struct"
				// 提取字段数
				if t.Fields != nil {
					symbol.Properties["field_count"] = t.Fields.NumFields()
				}

			default:
				symbol.Type = "type"
			}

			symbol.ID = fmt.Sprintf("%s:%d", filePath, symbol.StartLine)
			symbols = append(symbols, symbol)

		case *ast.ValueSpec:
			// 变量/常量声明
			for _, name := range s.Names {
				symbol := &models.Symbol{
					Name:       name.Name,
					Package:    pkgName,
					File:       filePath,
					FullName:   fmt.Sprintf("%s.%s", pkgName, name.Name),
					IsExported: ast.IsExported(name.Name),
					StartLine:  a.fset.Position(name.Pos()).Line,
					EndLine:    a.fset.Position(s.End()).Line,
					Properties: make(map[string]interface{}),
				}

				if genDecl.Tok == token.CONST {
					symbol.Type = "const"
				} else {
					symbol.Type = "var"
				}

				symbol.ID = fmt.Sprintf("%s:%d", filePath, symbol.StartLine)
				symbols = append(symbols, symbol)
			}
		}
	}

	return symbols
}

// generateFuncSignature 生成函数签名
func (a *Analyzer) generateFuncSignature(funcDecl *ast.FuncDecl) string {
	var sig strings.Builder

	// 接收者
	if funcDecl.Recv != nil {
		sig.WriteString("(")
		for i, field := range funcDecl.Recv.List {
			if i > 0 {
				sig.WriteString(", ")
			}
			sig.WriteString(a.typeToString(field.Type))
		}
		sig.WriteString(") ")
	}

	// 函数名
	sig.WriteString(funcDecl.Name.Name)

	// 参数
	sig.WriteString("(")
	if funcDecl.Type.Params != nil {
		for i, field := range funcDecl.Type.Params.List {
			if i > 0 {
				sig.WriteString(", ")
			}
			sig.WriteString(a.typeToString(field.Type))
		}
	}
	sig.WriteString(")")

	// 返回值
	if funcDecl.Type.Results != nil && len(funcDecl.Type.Results.List) > 0 {
		sig.WriteString(" ")
		if len(funcDecl.Type.Results.List) > 1 {
			sig.WriteString("(")
		}
		for i, field := range funcDecl.Type.Results.List {
			if i > 0 {
				sig.WriteString(", ")
			}
			sig.WriteString(a.typeToString(field.Type))
		}
		if len(funcDecl.Type.Results.List) > 1 {
			sig.WriteString(")")
		}
	}

	return sig.String()
}

// typeToString 将类型转换为字符串
func (a *Analyzer) typeToString(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		return t.Name
	case *ast.StarExpr:
		return "*" + a.typeToString(t.X)
	case *ast.SelectorExpr:
		return a.typeToString(t.X) + "." + t.Sel.Name
	case *ast.ArrayType:
		return "[]" + a.typeToString(t.Elt)
	case *ast.MapType:
		return "map[" + a.typeToString(t.Key) + "]" + a.typeToString(t.Value)
	case *ast.InterfaceType:
		return "interface{}"
	case *ast.ChanType:
		return "chan " + a.typeToString(t.Value)
	case *ast.FuncType:
		return "func"
	default:
		return "unknown"
	}
}

// calculateComplexity 计算圈复杂度
func (a *Analyzer) calculateComplexity(funcDecl *ast.FuncDecl) int {
	complexity := 1 // 基础复杂度

	ast.Inspect(funcDecl.Body, func(n ast.Node) bool {
		switch n.(type) {
		case *ast.IfStmt, *ast.ForStmt, *ast.RangeStmt,
			*ast.CaseClause, *ast.CommClause:
			complexity++
		case *ast.BinaryExpr:
			// 逻辑运算符增加复杂度
			if b, ok := n.(*ast.BinaryExpr); ok {
				if b.Op == token.LAND || b.Op == token.LOR {
					complexity++
				}
			}
		}
		return true
	})

	return complexity
}

// ExtractImports 提取导入
func (a *Analyzer) ExtractImports(file *ast.File) []string {
	imports := make([]string, 0)

	for _, imp := range file.Imports {
		path := strings.Trim(imp.Path.Value, "\"")
		imports = append(imports, path)
	}

	return imports
}

// FindFunctionCalls 查找函数调用
func (a *Analyzer) FindFunctionCalls(funcDecl *ast.FuncDecl) []string {
	calls := make([]string, 0)

	ast.Inspect(funcDecl.Body, func(n ast.Node) bool {
		if callExpr, ok := n.(*ast.CallExpr); ok {
			callName := a.getCallName(callExpr.Fun)
			if callName != "" {
				calls = append(calls, callName)
			}
		}
		return true
	})

	return calls
}

// getCallName 获取调用名称
func (a *Analyzer) getCallName(expr ast.Expr) string {
	switch e := expr.(type) {
	case *ast.Ident:
		return e.Name
	case *ast.SelectorExpr:
		return a.getCallName(e.X) + "." + e.Sel.Name
	default:
		return ""
	}
}

// GetPosition 获取位置信息
func (a *Analyzer) GetPosition(pos token.Pos) token.Position {
	return a.fset.Position(pos)
}

// FindChangedFunctions 查找变更的函数
func (a *Analyzer) FindChangedFunctions(file *ast.File, changedLines map[int]bool) []*models.ChangeFunc {
	changedFuncs := make([]*models.ChangeFunc, 0)

	for _, decl := range file.Decls {
		if funcDecl, ok := decl.(*ast.FuncDecl); ok {
			startLine := a.fset.Position(funcDecl.Pos()).Line
			endLine := a.fset.Position(funcDecl.End()).Line

			// 检查是否有变更行落在函数范围内
			hasChange := false
			for line := startLine; line <= endLine; line++ {
				if changedLines[line] {
					hasChange = true
					break
				}
			}

			if hasChange {
				changeFunc := &models.ChangeFunc{
					Name:       funcDecl.Name.Name,
					StartLine:  startLine,
					EndLine:    endLine,
					IsModified: true,
					Complexity: a.calculateComplexity(funcDecl),
					Calls:      a.FindFunctionCalls(funcDecl),
				}

				// 提取签名
				changeFunc.Signature = a.generateFuncSignature(funcDecl)

				// 接收者类型
				if funcDecl.Recv != nil && len(funcDecl.Recv.List) > 0 {
					changeFunc.ReceiverType = a.typeToString(funcDecl.Recv.List[0].Type)
				}

				changedFuncs = append(changedFuncs, changeFunc)
			}
		}
	}

	return changedFuncs
}

// ExtractAllFunctions 提取文件中所有函数（不区分是否变更）
func (a *Analyzer) ExtractAllFunctions(file *ast.File) []*models.ChangeFunc {
	allFuncs := make([]*models.ChangeFunc, 0)

	for _, decl := range file.Decls {
		if funcDecl, ok := decl.(*ast.FuncDecl); ok {
			startLine := a.fset.Position(funcDecl.Pos()).Line
			endLine := a.fset.Position(funcDecl.End()).Line

			changeFunc := &models.ChangeFunc{
				Name:       funcDecl.Name.Name,
				StartLine:  startLine,
				EndLine:    endLine,
				IsModified: true, // 假设都是变更的
				Complexity: a.calculateComplexity(funcDecl),
				Calls:      a.FindFunctionCalls(funcDecl),
			}

			// 提取签名
			changeFunc.Signature = a.generateFuncSignature(funcDecl)

			// 接收者类型
			if funcDecl.Recv != nil && len(funcDecl.Recv.List) > 0 {
				changeFunc.ReceiverType = a.typeToString(funcDecl.Recv.List[0].Type)
			}

			allFuncs = append(allFuncs, changeFunc)
		}
	}

	return allFuncs
}

// AnalyzePackageDir 分析包目录
func (a *Analyzer) AnalyzePackageDir(dir string) (map[string]*ast.File, error) {
	pkgs, err := parser.ParseDir(a.fset, dir, nil, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("failed to parse directory: %w", err)
	}

	files := make(map[string]*ast.File)
	for _, pkg := range pkgs {
		for name, file := range pkg.Files {
			files[name] = file
		}
	}

	return files, nil
}

// GetPackageName 获取包名
func (a *Analyzer) GetPackageName(filePath string) (string, error) {
	file, err := a.ParseFile(filePath)
	if err != nil {
		return "", err
	}

	if file.Name != nil {
		return file.Name.Name, nil
	}

	return "", fmt.Errorf("no package name found")
}

// IsTestFile 判断是否是测试文件
func IsTestFile(filePath string) bool {
	return strings.HasSuffix(filepath.Base(filePath), "_test.go")
}

// GetInterfaceMethods 获取接口方法
func (a *Analyzer) GetInterfaceMethods(pkg *packages.Package, interfaceName string) ([]string, error) {
	for _, file := range pkg.Syntax {
		for _, decl := range file.Decls {
			if genDecl, ok := decl.(*ast.GenDecl); ok {
				for _, spec := range genDecl.Specs {
					if typeSpec, ok := spec.(*ast.TypeSpec); ok {
						if typeSpec.Name.Name == interfaceName {
							if interfaceType, ok := typeSpec.Type.(*ast.InterfaceType); ok {
								methods := make([]string, 0)
								for _, method := range interfaceType.Methods.List {
									if len(method.Names) > 0 {
										methods = append(methods, method.Names[0].Name)
									}
								}
								return methods, nil
							}
						}
					}
				}
			}
		}
	}

	return nil, fmt.Errorf("interface %s not found", interfaceName)
}

// FindInterfaceImplementations 查找接口实现
func (a *Analyzer) FindInterfaceImplementations(pkg *packages.Package, interfaceName string) ([]string, error) {
	implementations := make([]string, 0)

	// 获取接口类型
	var interfaceType types.Type
	scope := pkg.Types.Scope()
	if obj := scope.Lookup(interfaceName); obj != nil {
		interfaceType = obj.Type()
	} else {
		return nil, fmt.Errorf("interface %s not found", interfaceName)
	}

	// 遍历所有类型,检查是否实现了接口
	for _, name := range scope.Names() {
		obj := scope.Lookup(name)
		if types.Implements(obj.Type(), interfaceType.Underlying().(*types.Interface)) {
			implementations = append(implementations, name)
		}
	}

	return implementations, nil
}
