import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, Form, Input, Modal, message, Spin } from 'antd';
import { 
  FileTextOutlined, 
  CodeOutlined, 
  BugOutlined, 
  CheckCircleOutlined,
  PlusOutlined 
} from '@ant-design/icons';
import { getTasks, createAnalysis, pollTaskUntilComplete, getReport } from '../services/api';
import type { Task, TaskRequest, Report } from '../types';
import RiskScoreGauge from '../components/charts/RiskScoreGauge';
import RiskDistributionPie from '../components/charts/RiskDistributionPie';
import ScoreBreakdownBar from '../components/charts/ScoreBreakdownBar';

const Dashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [latestReport, setLatestReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const taskList = await getTasks();
      setTasks(taskList);

      // 获取最新完成的任务报告
      const completedTask = taskList.find(t => t.status === 'completed');
      if (completedTask) {
        const report = await getReport(completedTask.id);
        setLatestReport(report);
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (values: TaskRequest) => {
    setAnalyzing(true);
    try {
      const task = await createAnalysis(values);
      message.success('分析任务已创建');
      setModalVisible(false);
      form.resetFields();

      // 轮询任务状态
      await pollTaskUntilComplete(task.id, (updatedTask) => {
        message.info(`分析进度: ${updatedTask.progress}%`);
      });

      message.success('分析完成！');
      loadData();
    } catch (error: any) {
      message.error(error.message || '创建任务失败');
    } finally {
      setAnalyzing(false);
    }
  };

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const avgRiskScore = latestReport?.summary.total_score || 0;
  const highRiskCount = tasks.filter(t => t.status === 'completed').length; // 简化统计

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
          Go代码变更风险分析 - 仪表盘
        </h1>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
          size="large"
        >
          创建新分析
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总任务数"
                  value={tasks.length}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#3498DB' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已完成"
                  value={completedTasks}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#27AE60' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="平均风险分数"
                  value={avgRiskScore.toFixed(1)}
                  prefix={<BugOutlined />}
                  valueStyle={{ color: avgRiskScore >= 50 ? '#E74C3C' : '#F39C12' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="变更文件数"
                  value={latestReport?.summary.files_changed || 0}
                  prefix={<CodeOutlined />}
                  valueStyle={{ color: '#9B59B6' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 图表展示 */}
          {latestReport && (
            <>
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={8}>
                  <Card title="风险评分仪表盘" bordered={false}>
                    <RiskScoreGauge summary={latestReport.summary} />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card title="评分细分" bordered={false}>
                    <ScoreBreakdownBar summary={latestReport.summary} />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card title="风险特征分布" bordered={false}>
                    <RiskDistributionPie features={latestReport.features} />
                  </Card>
                </Col>
              </Row>

              {/* 详细信息 */}
              <Card title="最新分析报告摘要" bordered={false}>
                <Row gutter={16}>
                  <Col span={8}>
                    <div style={{ marginBottom: 16 }}>
                      <strong>风险等级：</strong>
                      <span style={{ 
                        color: latestReport.summary.level === 'high' ? '#E74C3C' : 
                               latestReport.summary.level === 'medium' ? '#F39C12' : '#27AE60',
                        marginLeft: 8,
                        fontSize: 16,
                        fontWeight: 600
                      }}>
                        {latestReport.summary.level.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <strong>变更行数：</strong> {latestReport.summary.lines_changed}
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ marginBottom: 16 }}>
                      <strong>函数变更：</strong> {latestReport.summary.funcs_changed}
                    </div>
                    <div>
                      <strong>直接影响：</strong> {latestReport.summary.direct_impact}
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ marginBottom: 16 }}>
                      <strong>间接影响：</strong> {latestReport.summary.indirect_impact}
                    </div>
                    <div>
                      <strong>风险特征：</strong> {latestReport.features.length} 个
                    </div>
                  </Col>
                </Row>
              </Card>
            </>
          )}
        </>
      )}

      {/* 创建任务弹窗 */}
      <Modal
        title="创建代码风险分析任务"
        open={modalVisible}
        onCancel={() => !analyzing && setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateTask}
          initialValues={{
            repo_path: '/Users/sugerdaddy/ai/tool/vArmor',
            base_commit: 'HEAD~5',
            target_commit: 'HEAD'
          }}
        >
          <Form.Item
            label="仓库路径"
            name="repo_path"
            rules={[{ required: true, message: '请输入仓库路径' }]}
          >
            <Input placeholder="/path/to/repository" />
          </Form.Item>
          <Form.Item
            label="基准提交"
            name="base_commit"
            rules={[{ required: true, message: '请输入基准提交' }]}
          >
            <Input placeholder="HEAD~5 或 commit hash" />
          </Form.Item>
          <Form.Item
            label="目标提交"
            name="target_commit"
            rules={[{ required: true, message: '请输入目标提交' }]}
          >
            <Input placeholder="HEAD 或 commit hash" />
          </Form.Item>
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={analyzing}
              block
              size="large"
            >
              {analyzing ? '分析中...' : '开始分析'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Dashboard;
