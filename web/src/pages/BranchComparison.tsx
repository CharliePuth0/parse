import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Steps, Divider, Alert } from 'antd';
import { 
  FolderOpenOutlined, 
  BranchesOutlined, 
  PlayCircleOutlined,
  RightOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { createAnalysis, pollTaskUntilComplete } from '../services/api';

const BranchComparison: React.FC = () => {
  const [form] = Form.useForm();
  const [analyzing, setAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [taskId, setTaskId] = useState<string>('');
  const navigate = useNavigate();

  const handleSubmit = async (values: any) => {
    setAnalyzing(true);
    setCurrentStep(1);

    try {
      // 创建分析任务
      const task = await createAnalysis({
        repo_path: values.repo_path,
        base_commit: values.base_branch,
        target_commit: values.target_branch
      });

      setTaskId(task.id);
      message.success(`分析任务已创建 (ID: ${task.id})`);
      setCurrentStep(2);

      // 轮询任务状态
      await pollTaskUntilComplete(task.id, (updatedTask) => {
        const progress = updatedTask.progress;
        if (progress === 100) {
          setCurrentStep(3);
        }
      });

      message.success('分析完成！即将跳转到报告页面...');
      
      // 延迟1秒后跳转
      setTimeout(() => {
        navigate(`/report/${task.id}`);
      }, 1000);

    } catch (error: any) {
      message.error(error.message || '分析失败');
      setCurrentStep(0);
    } finally {
      setAnalyzing(false);
    }
  };

  const steps = [
    {
      title: '填写信息',
      description: '输入仓库路径和分支'
    },
    {
      title: '创建任务',
      description: '提交分析请求'
    },
    {
      title: '执行分析',
      description: '分析代码差异和风险'
    },
    {
      title: '查看报告',
      description: '展示可视化结果'
    }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* 标题 */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
          🔍 代码分支对比分析
        </h1>
        <p style={{ fontSize: 16, color: '#666' }}>
          指定代码仓库路径和两个分支，系统将自动分析差异并生成风险报告
        </p>
      </div>

      {/* 进度步骤 */}
      <Card style={{ marginBottom: 24 }}>
        <Steps current={currentStep} items={steps} />
      </Card>

      {/* 使用说明 */}
      <Alert
        message="使用说明"
        description={
          <div>
            <p>• <strong>仓库路径</strong>: 填写Git仓库的绝对路径（如: /Users/username/project）</p>
            <p>• <strong>基准分支</strong>: 对比的起点，可以是分支名、提交哈希、或相对引用（如: HEAD~5, main, abc123）</p>
            <p>• <strong>目标分支</strong>: 对比的终点，通常填写 HEAD 或具体分支名（如: feature-branch）</p>
            <p>• 分析完成后将自动跳转到可视化报告页面</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* 主表单 */}
      <Card title="填写对比信息" bordered={false}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            repo_path: '/Users/sugerdaddy/ai/tool/vArmor',
            base_branch: 'HEAD~5',
            target_branch: 'HEAD'
          }}
        >
          {/* 仓库路径 */}
          <Form.Item
            label={
              <span>
                <FolderOpenOutlined style={{ marginRight: 8 }} />
                代码仓库路径
              </span>
            }
            name="repo_path"
            rules={[
              { required: true, message: '请输入仓库路径' },
              { 
                pattern: /^\/.*/,
                message: '请输入绝对路径（以 / 开头）'
              }
            ]}
            tooltip="Git仓库的绝对路径，例如: /Users/username/myproject"
          >
            <Input 
              placeholder="/path/to/your/repository"
              size="large"
              prefix={<FolderOpenOutlined style={{ color: '#1890ff' }} />}
            />
          </Form.Item>

          <Divider>
            <BranchesOutlined /> 分支对比配置
          </Divider>

          {/* 基准分支 */}
          <Form.Item
            label={
              <span>
                <BranchesOutlined style={{ marginRight: 8 }} />
                基准分支 / 提交（起点）
              </span>
            }
            name="base_branch"
            rules={[{ required: true, message: '请输入基准分支' }]}
            tooltip="对比的起点，支持：分支名(main)、相对引用(HEAD~5)、提交哈希(abc123)"
          >
            <Input 
              placeholder="例如: HEAD~5, main, develop, abc123"
              size="large"
            />
          </Form.Item>

          {/* 中间箭头提示 */}
          <div style={{ 
            textAlign: 'center', 
            margin: '16px 0',
            fontSize: 24,
            color: '#1890ff'
          }}>
            <RightOutlined /> 对比差异 <RightOutlined />
          </div>

          {/* 目标分支 */}
          <Form.Item
            label={
              <span>
                <BranchesOutlined style={{ marginRight: 8 }} />
                目标分支 / 提交（终点）
              </span>
            }
            name="target_branch"
            rules={[{ required: true, message: '请输入目标分支' }]}
            tooltip="对比的终点，通常是 HEAD 或具体分支名"
          >
            <Input 
              placeholder="例如: HEAD, feature-branch, def456"
              size="large"
            />
          </Form.Item>

          {/* 提交按钮 */}
          <Form.Item style={{ marginTop: 32 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={analyzing}
              icon={<PlayCircleOutlined />}
              style={{ height: 50, fontSize: 16 }}
            >
              {analyzing ? '分析中...' : '开始分析对比'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 常用场景示例 */}
      <Card 
        title="💡 常用场景示例" 
        style={{ marginTop: 24 }}
        bordered={false}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div 
            style={{ 
              padding: 16, 
              border: '1px solid #e8e8e8', 
              borderRadius: 8,
              cursor: 'pointer'
            }}
            onClick={() => {
              form.setFieldsValue({
                base_branch: 'HEAD~1',
                target_branch: 'HEAD'
              });
            }}
          >
            <strong>📝 检查最新提交</strong>
            <p style={{ margin: '8px 0 0', color: '#666' }}>
              基准: HEAD~1 → 目标: HEAD
            </p>
          </div>

          <div 
            style={{ 
              padding: 16, 
              border: '1px solid #e8e8e8', 
              borderRadius: 8,
              cursor: 'pointer'
            }}
            onClick={() => {
              form.setFieldsValue({
                base_branch: 'main',
                target_branch: 'HEAD'
              });
            }}
          >
            <strong>🔀 分支合并前检查</strong>
            <p style={{ margin: '8px 0 0', color: '#666' }}>
              基准: main → 目标: HEAD
            </p>
          </div>

          <div 
            style={{ 
              padding: 16, 
              border: '1px solid #e8e8e8', 
              borderRadius: 8,
              cursor: 'pointer'
            }}
            onClick={() => {
              form.setFieldsValue({
                base_branch: 'HEAD~10',
                target_branch: 'HEAD'
              });
            }}
          >
            <strong>📊 最近迭代总结</strong>
            <p style={{ margin: '8px 0 0', color: '#666' }}>
              基准: HEAD~10 → 目标: HEAD
            </p>
          </div>

          <div 
            style={{ 
              padding: 16, 
              border: '1px solid #e8e8e8', 
              borderRadius: 8,
              cursor: 'pointer'
            }}
            onClick={() => {
              form.setFieldsValue({
                base_branch: 'v1.0.0',
                target_branch: 'v2.0.0'
              });
            }}
          >
            <strong>🚀 版本升级评估</strong>
            <p style={{ margin: '8px 0 0', color: '#666' }}>
              基准: v1.0.0 → 目标: v2.0.0
            </p>
          </div>
        </div>
      </Card>

      {/* 任务信息显示 */}
      {taskId && (
        <Card 
          title="📋 任务信息" 
          style={{ marginTop: 24 }}
          bordered={false}
        >
          <p><strong>任务ID:</strong> {taskId}</p>
          <p><strong>状态:</strong> {analyzing ? '分析中...' : '已完成'}</p>
          <Button 
            type="link" 
            onClick={() => navigate(`/report/${taskId}`)}
            disabled={analyzing}
          >
            查看报告详情 →
          </Button>
        </Card>
      )}
    </div>
  );
};

export default BranchComparison;
