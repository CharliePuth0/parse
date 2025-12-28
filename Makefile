.PHONY: all build run test clean install docker-build docker-run help

# 变量定义
BINARY_NAME=code-risk-analyzer
MAIN_PATH=cmd/server/main.go
BUILD_DIR=build
GO=go
GOFLAGS=-v

# 默认目标
all: build

# 帮助信息
help:
	@echo "Go代码变更风险可视化系统 - Makefile命令"
	@echo ""
	@echo "使用方法: make [target]"
	@echo ""
	@echo "可用目标:"
	@echo "  help          - 显示此帮助信息"
	@echo "  install       - 安装依赖"
	@echo "  build         - 编译项目"
	@echo "  run           - 运行服务器"
	@echo "  test          - 运行测试"
	@echo "  clean         - 清理构建文件"
	@echo "  docker-build  - 构建Docker镜像"
	@echo "  docker-run    - 运行Docker容器"
	@echo "  web-install   - 安装前端依赖"
	@echo "  web-build     - 构建前端"
	@echo "  web-dev       - 前端开发模式"

# 安装依赖
install:
	@echo "安装Go依赖..."
	$(GO) mod download
	$(GO) mod tidy
	@echo "依赖安装完成"

# 编译项目
build: install
	@echo "编译项目..."
	@mkdir -p $(BUILD_DIR)
	$(GO) build $(GOFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) $(MAIN_PATH)
	@echo "编译完成: $(BUILD_DIR)/$(BINARY_NAME)"

# 运行服务器
run: build
	@echo "启动服务器..."
	./$(BUILD_DIR)/$(BINARY_NAME)

# 运行测试
test:
	@echo "运行测试..."
	$(GO) test -v ./...

# 清理构建文件
clean:
	@echo "清理构建文件..."
	@rm -rf $(BUILD_DIR)
	@rm -rf web/dist
	@rm -rf web/node_modules
	@echo "清理完成"

# 前端相关
web-install:
	@echo "安装前端依赖..."
	cd web && npm install

web-build: web-install
	@echo "构建前端..."
	cd web && npm run build

web-dev:
	@echo "启动前端开发服务器..."
	cd web && npm run dev

# Docker相关
docker-build:
	@echo "构建Docker镜像..."
	docker build -t go-code-risk-analyzer:latest .

docker-run:
	@echo "运行Docker容器..."
	docker-compose up -d

docker-stop:
	@echo "停止Docker容器..."
	docker-compose down

# 开发模式(后端+Neo4j)
dev: 
	@echo "启动开发环境..."
	docker-compose up -d neo4j
	@sleep 5
	@make run

# 生产构建
prod: web-build build
	@echo "生产环境构建完成"

# 代码格式化
fmt:
	@echo "格式化代码..."
	$(GO) fmt ./...

# 代码检查
lint:
	@echo "代码检查..."
	golangci-lint run ./...

# 生成文档
docs:
	@echo "生成API文档..."
	swag init -g $(MAIN_PATH)
