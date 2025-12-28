package config

// Config 应用配置
type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Neo4j    Neo4jConfig    `yaml:"neo4j"`
	Analyzer AnalyzerConfig `yaml:"analyzer"`
	Risk     RiskConfig     `yaml:"risk"`
	Features FeaturesConfig `yaml:"features"`
	Logging  LoggingConfig  `yaml:"logging"`
	Cache    CacheConfig    `yaml:"cache"`
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
	Mode string `yaml:"mode"`
}

// Neo4jConfig Neo4j配置
type Neo4jConfig struct {
	URI      string `yaml:"uri"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	Database string `yaml:"database"`
}

// AnalyzerConfig 分析器配置
type AnalyzerConfig struct {
	MaxDepth int `yaml:"max_depth"`
	Timeout  int `yaml:"timeout"`
	Workers  int `yaml:"workers"`
}

// RiskConfig 风险评估配置
type RiskConfig struct {
	ComplexityWeight float64           `yaml:"complexity_weight"`
	ImpactWeight     float64           `yaml:"impact_weight"`
	HistoryWeight    float64           `yaml:"history_weight"`
	FeatureWeight    float64           `yaml:"feature_weight"`
	Thresholds       ThresholdsConfig  `yaml:"thresholds"`
}

// ThresholdsConfig 阈值配置
type ThresholdsConfig struct {
	Low    float64 `yaml:"low"`
	Medium float64 `yaml:"medium"`
	High   float64 `yaml:"high"`
}

// FeaturesConfig 特征配置
type FeaturesConfig struct {
	Enabled []string `yaml:"enabled"`
}

// LoggingConfig 日志配置
type LoggingConfig struct {
	Level      string `yaml:"level"`
	File       string `yaml:"file"`
	MaxSize    int    `yaml:"max_size"`
	MaxBackups int    `yaml:"max_backups"`
	MaxAge     int    `yaml:"max_age"`
}

// CacheConfig 缓存配置
type CacheConfig struct {
	Enabled bool `yaml:"enabled"`
	TTL     int  `yaml:"ttl"`
}
