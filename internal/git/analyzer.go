package git

import (
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/sugerdaddy/go-code-risk-analyzer/pkg/models"
)

// Analyzer Git分析器
type Analyzer struct {
	repo *git.Repository
	path string
}

// NewAnalyzer 创建Git分析器
func NewAnalyzer(repoPath string) (*Analyzer, error) {
	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open repository: %w", err)
	}

	return &Analyzer{
		repo: repo,
		path: repoPath,
	}, nil
}

// GetChanges 获取两个提交之间的变更
func (a *Analyzer) GetChanges(baseCommit, targetCommit string) ([]*models.ChangeFile, error) {
	// 解析基准提交
	baseHash, err := a.resolveCommit(baseCommit)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve base commit: %w", err)
	}

	// 解析目标提交
	targetHash, err := a.resolveCommit(targetCommit)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve target commit: %w", err)
	}

	// 获取提交对象
	baseCommitObj, err := a.repo.CommitObject(baseHash)
	if err != nil {
		return nil, fmt.Errorf("failed to get base commit object: %w", err)
	}

	targetCommitObj, err := a.repo.CommitObject(targetHash)
	if err != nil {
		return nil, fmt.Errorf("failed to get target commit object: %w", err)
	}

	// 获取树对象
	baseTree, err := baseCommitObj.Tree()
	if err != nil {
		return nil, fmt.Errorf("failed to get base tree: %w", err)
	}

	targetTree, err := targetCommitObj.Tree()
	if err != nil {
		return nil, fmt.Errorf("failed to get target tree: %w", err)
	}

	// 比较两个树
	changes, err := baseTree.Diff(targetTree)
	if err != nil {
		return nil, fmt.Errorf("failed to diff trees: %w", err)
	}

	// 解析变更
	changeFiles := make([]*models.ChangeFile, 0)
	for _, change := range changes {
		// 只处理Go文件
		if !strings.HasSuffix(change.To.Name, ".go") && !strings.HasSuffix(change.From.Name, ".go") {
			continue
		}

		changeFile, err := a.parseChange(change, baseTree, targetTree)
		if err != nil {
			// 记录错误但继续处理其他文件
			fmt.Printf("Warning: failed to parse change for %s: %v\n", change.To.Name, err)
			continue
		}

		if changeFile != nil {
			changeFiles = append(changeFiles, changeFile)
		}
	}

	return changeFiles, nil
}

// resolveCommit 解析提交引用(分支名、标签、SHA)
func (a *Analyzer) resolveCommit(ref string) (plumbing.Hash, error) {
	// 尝试作为SHA解析
	hash := plumbing.NewHash(ref)
	if !hash.IsZero() {
		_, err := a.repo.CommitObject(hash)
		if err == nil {
			return hash, nil
		}
	}

	// 尝试作为引用解析
	resolved, err := a.repo.ResolveRevision(plumbing.Revision(ref))
	if err != nil {
		return plumbing.ZeroHash, fmt.Errorf("failed to resolve revision %s: %w", ref, err)
	}

	return *resolved, nil
}

// parseChange 解析单个变更
func (a *Analyzer) parseChange(change *object.Change, baseTree, targetTree *object.Tree) (*models.ChangeFile, error) {
	action, err := change.Action()
	if err != nil {
		return nil, err
	}

	changeFile := &models.ChangeFile{
		Functions: make([]*models.ChangeFunc, 0),
		Imports:   make([]string, 0),
	}

	actionStr := action.String()

	switch actionStr {
	case "Insert":
		// 新增文件
		changeFile.Path = change.To.Name
		changeFile.Type = "added"

		content, err := a.getFileContent(targetTree, change.To.Name)
		if err != nil {
			return nil, err
		}

		changeFile.AddedLines = countLines(content)

	case "Delete":
		// 删除文件
		changeFile.Path = change.From.Name
		changeFile.Type = "deleted"

		content, err := a.getFileContent(baseTree, change.From.Name)
		if err != nil {
			return nil, err
		}

		changeFile.DeletedLines = countLines(content)

	case "Modify":
		// 修改文件
		changeFile.Path = change.To.Name
		changeFile.Type = "modified"

		baseContent, err := a.getFileContent(baseTree, change.From.Name)
		if err != nil {
			return nil, err
		}

		targetContent, err := a.getFileContent(targetTree, change.To.Name)
		if err != nil {
			return nil, err
		}

		added, deleted := countDiffLines(baseContent, targetContent)
		changeFile.AddedLines = added
		changeFile.DeletedLines = deleted
	}

	return changeFile, nil
}

// getFileContent 获取文件内容
func (a *Analyzer) getFileContent(tree *object.Tree, path string) (string, error) {
	file, err := tree.File(path)
	if err != nil {
		return "", err
	}

	reader, err := file.Reader()
	if err != nil {
		return "", err
	}
	defer reader.Close()

	content, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	return string(content), nil
}

// countLines 统计行数
func countLines(content string) int {
	if content == "" {
		return 0
	}
	return len(strings.Split(content, "\n"))
}

// countDiffLines 简单的行差异统计
func countDiffLines(base, target string) (added, deleted int) {
	baseLines := strings.Split(base, "\n")
	targetLines := strings.Split(target, "\n")

	// 简化实现:只统计行数差异
	// 实际应该使用更精确的diff算法
	if len(targetLines) > len(baseLines) {
		added = len(targetLines) - len(baseLines)
	} else {
		deleted = len(baseLines) - len(targetLines)
	}

	return
}

// GetFileAtCommit 获取指定提交的文件内容
func (a *Analyzer) GetFileAtCommit(commitRef, filePath string) (string, error) {
	hash, err := a.resolveCommit(commitRef)
	if err != nil {
		return "", err
	}

	commit, err := a.repo.CommitObject(hash)
	if err != nil {
		return "", err
	}

	tree, err := commit.Tree()
	if err != nil {
		return "", err
	}

	return a.getFileContent(tree, filePath)
}

// GetCommitInfo 获取提交信息
func (a *Analyzer) GetCommitInfo(commitRef string) (*CommitInfo, error) {
	hash, err := a.resolveCommit(commitRef)
	if err != nil {
		return nil, err
	}

	commit, err := a.repo.CommitObject(hash)
	if err != nil {
		return nil, err
	}

	return &CommitInfo{
		Hash:      commit.Hash.String(),
		Author:    commit.Author.Name,
		Email:     commit.Author.Email,
		Message:   commit.Message,
		Timestamp: commit.Author.When,
	}, nil
}

// CommitInfo 提交信息
type CommitInfo struct {
	Hash      string
	Author    string
	Email     string
	Message   string
	Timestamp interface{}
}

// GetRepoPath 获取仓库路径
func (a *Analyzer) GetRepoPath() string {
	return a.path
}

// GetAbsolutePath 获取文件的绝对路径
func (a *Analyzer) GetAbsolutePath(relativePath string) string {
	return filepath.Join(a.path, relativePath)
}

// ListGoFiles 列出所有Go文件
func (a *Analyzer) ListGoFiles(commitRef string) ([]string, error) {
	hash, err := a.resolveCommit(commitRef)
	if err != nil {
		return nil, err
	}

	commit, err := a.repo.CommitObject(hash)
	if err != nil {
		return nil, err
	}

	tree, err := commit.Tree()
	if err != nil {
		return nil, err
	}

	files := make([]string, 0)
	err = tree.Files().ForEach(func(f *object.File) error {
		if strings.HasSuffix(f.Name, ".go") {
			files = append(files, f.Name)
		}
		return nil
	})

	return files, err
}
