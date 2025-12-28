// 数据模型类型定义

export interface TaskRequest {
  repo_path: string;
  base_commit: string;
  target_commit: string;
}

export interface Task {
  id: string;
  repo_path: string;
  base_commit: string;
  target_commit: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  completed_at: string;
  error?: string;
}

export interface RiskSummary {
  total_score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  files_changed: number;
  funcs_changed: number;
  lines_changed: number;
  direct_impact: number;
  indirect_impact: number;
  score_breakdown: {
    complexity_score: number;
    impact_score: number;
    history_score: number;
    feature_score: number;
  };
}

export interface FileChange {
  path: string;
  score: number;
  level: string;
  change_type: string;
  complexity: number;
  impact_count: number;
  added_lines: number;
  deleted_lines: number;
  package: string;
  functions: string[];
  issues: string[];
}

export interface FunctionChange {
  name: string;
  action: string;
  complexity: number;
  lines: number;
  risk_score: number;
}

// 影响面详情(参考美团后羿系统)
export interface ImpactDetail {
  total_impact: number;
  max_depth_reached: number;
  impact_score: number;
  impact_by_level: Record<number, number>;
  critical_paths: string[][];
  top_impact_funcs: ImpactFuncInfo[];
}

export interface ImpactFuncInfo {
  name: string;
  distance: number;
  importance: number;
  call_count: number;
  is_critical: boolean;
}

// 函数风险详情
export interface FunctionRisk {
  name: string;
  full_name: string;
  file: string;
  line: number;
  score: number;
  level: string;
  complexity: number;
  direct_impact: number;
  indirect_impact: number;
  change_type: string;
  impact_path: string[];
  features: string[];
  issues: string[];
  impact_detail?: ImpactDetail;
}

export interface RiskFeature {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  locations: string[];
  description: string;
  suggestion: string;
}

export interface Report {
  task_id: string;
  summary: RiskSummary;
  files: FileChange[];
  functions?: FunctionRisk[];
  features: RiskFeature[];
  impact_chain?: ImpactNode[];
}

export interface ImpactNode {
  id: string;
  name: string;
  type: string;
  risk_score: number;
  children?: ImpactNode[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface Statistics {
  total_tasks: number;
  completed_tasks: number;
  avg_risk_score: number;
  high_risk_count: number;
}
