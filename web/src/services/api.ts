import axios from 'axios';
import type { Task, TaskRequest, Report, Statistics, ApiResponse } from '../types';

const API_BASE_URL = 'http://localhost:8080/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,  // 增加到300秒（5分钟）
  headers: {
    'Content-Type': 'application/json',
  },
});

// 健康检查
export const checkHealth = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};

// 创建分析任务
export const createAnalysis = async (request: TaskRequest): Promise<Task> => {
  const response = await apiClient.post<ApiResponse<Task>>('/analyze', request);
  return response.data.data;
};

// 获取任务列表
export const getTasks = async (): Promise<Task[]> => {
  const response = await apiClient.get<ApiResponse<Task[]>>('/tasks');
  return response.data.data || [];
};

// 获取单个任务详情
export const getTask = async (taskId: string): Promise<Task> => {
  const response = await apiClient.get<ApiResponse<Task>>(`/tasks/${taskId}`);
  return response.data.data;
};

// 获取分析报告
export const getReport = async (taskId: string): Promise<Report> => {
  const response = await apiClient.get<ApiResponse<Report>>(`/reports/${taskId}`);
  return response.data.data;
};

// 获取影响图数据
export const getImpactGraph = async (taskId: string) => {
  const response = await apiClient.get(`/impact-graph?task_id=${taskId}`);
  return response.data.data;
};

// 获取统计数据
export const getStatistics = async (): Promise<Statistics> => {
  const response = await apiClient.get<ApiResponse<Statistics>>('/statistics');
  return response.data.data;
};

// 轮询任务状态直到完成
export const pollTaskUntilComplete = async (
  taskId: string,
  onProgress?: (task: Task) => void
): Promise<Task> => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const task = await getTask(taskId);
        
        if (onProgress) {
          onProgress(task);
        }

        if (task.status === 'completed') {
          clearInterval(interval);
          resolve(task);
        } else if (task.status === 'failed') {
          clearInterval(interval);
          reject(new Error(task.error || '任务执行失败'));
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, 2000); // 每2秒轮询一次
  });
};
