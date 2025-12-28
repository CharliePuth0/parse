import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Row, Col, Table, Tag, Descriptions, Spin, message, Collapse, Progress, Tooltip, Tabs } from 'antd';
import { 
  WarningOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  NodeIndexOutlined,
  ApartmentOutlined,
  FunctionOutlined,
  ShareAltOutlined
} from '@ant-design/icons';
import { getReport } from '../services/api';
import type { Report, RiskFeature, FileChange, FunctionRisk } from '../types';
import RiskScoreGauge from '../components/charts/RiskScoreGauge';
import RiskDistributionPie from '../components/charts/RiskDistributionPie';
import ScoreBreakdownBar from '../components/charts/ScoreBreakdownBar';
import ImpactGraphVisualization from '../components/charts/ImpactGraphVisualization';
import FullCallChainTimeline from '../components/charts/FullCallChainTimeline';
import RepositoryCallGraph from '../components/charts/RepositoryCallGraph';

const { Panel } = Collapse;
const { TabPane } = Tabs;

const ReportDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (taskId) {
      loadReport(taskId);
    }
  }, [taskId]);

  const loadReport = async (id: string) => {
    setLoading(true);
    try {
      const data = await getReport(id);
      setReport(data);
    } catch (error) {
      message.error('加载报告失败');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityTag = (severity: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode }> = {
      high: { color: 'red', icon: <ExclamationCircleOutlined /> },
      medium: { color: 'orange', icon: <WarningOutlined /> },
      low: { color: 'blue', icon: <CheckCircleOutlined /> }
    };
    const config = map[severity] || map.low;
    return (
      <Tag color={config.color} icon={config.icon}>
        {severity.toUpperCase()}
      </Tag>
    );
  };

  const featureColumns = [
    {
      title: '风险类型',
      dataIndex: 'type',
      key: 'type',
      width: 150
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (severity: string) => getSeverityTag(severity)
    },
    {
      title: '检测次数',
      dataIndex: 'count',
      key: 'count',
      width: 100
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: '修复建议',
      dataIndex: 'suggestion',
      key: 'suggestion'
    }
  ];

  // 函数风险表格列定义
  const functionColumns = [
    {
      title: '函数名',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record: FunctionRisk) => (
        <Tooltip title={record.full_name}>
          <span style={{ fontWeight: 500 }}>{name}</span>
        </Tooltip>
      )
    },
    {
      title: '文件',
      dataIndex: 'file',
      key: 'file',
      width: 200,
      ellipsis: true
    },
    {
      title: '复杂度',
      dataIndex: 'complexity',
      key: 'complexity',
      width: 80,
      render: (complexity: number) => (
        <span style={{ color: complexity > 20 ? '#E74C3C' : complexity > 10 ? '#F39C12' : '#27AE60' }}>
          {complexity}
        </span>
      )
    },
    {
      title: '直接影响',
      dataIndex: 'direct_impact',
      key: 'direct_impact',
      width: 90,
      render: (impact: number) => (
        <Tag color={impact > 10 ? 'red' : impact > 5 ? 'orange' : 'blue'}>{impact}</Tag>
      )
    },
    {
      title: '间接影响',
      dataIndex: 'indirect_impact',
      key: 'indirect_impact',
      width: 90,
      render: (impact: number) => (
        <Tag color={impact > 20 ? 'red' : impact > 10 ? 'orange' : 'green'}>{impact}</Tag>
      )
    },
    {
      title: '风险分数',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      render: (score: number) => (
        <span style={{ 
          color: score >= 70 ? '#E74C3C' : score >= 40 ? '#F39C12' : '#27AE60',
          fontWeight: 600
        }}>
          {score?.toFixed(1) || 0}
        </span>
      )
    },
    {
      title: '风险等级',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => getSeverityTag(level)
    }
  ];

  // 渲染影响面详情 - 四个核心部分
  const renderImpactDetail = (record: FunctionRisk) => {
    return (
      <div style={{ padding: '16px 24px' }}>
        <Tabs defaultActiveKey="1">
          {/* 1. 变更方法详情 */}
          <TabPane 
            tab={
              <span>
                <FunctionOutlined /> 变更方法详情
              </span>
            } 
            key="1"
          >
            {!record.impact_detail ? (
              <div style={{ padding: 16, color: '#999' }}>暂无详细影响面信息</div>
            ) : (
              <Row gutter={16}>
                {/* 影响面概览 */}
                <Col span={8}>
                  <Card size="small" title={
                    <span><NodeIndexOutlined /> 影响面概览</span>
                  }>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="总影响数">
                        <span style={{ fontWeight: 600, color: '#1890ff' }}>{record.impact_detail.total_impact}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="影响深度">
                        <Progress 
                          percent={record.impact_detail.max_depth_reached * 10} 
                          steps={10} 
                          size="small"
                          format={() => `${record.impact_detail.max_depth_reached}层`}
                        />
                      </Descriptions.Item>
                      <Descriptions.Item label="影响分数">
                        <span style={{ 
                          fontWeight: 600, 
                          color: record.impact_detail.impact_score >= 50 ? '#E74C3C' : record.impact_detail.impact_score >= 20 ? '#F39C12' : '#27AE60'
                        }}>
                          {record.impact_detail.impact_score.toFixed(1)}
                        </span>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>

                {/* 各层级影响分布 */}
                <Col span={8}>
                  <Card size="small" title={
                    <span><ApartmentOutlined /> 层级影响分布</span>
                  }>
                    <div style={{ maxHeight: 150, overflow: 'auto' }}>
                      {Object.entries(record.impact_detail.impact_by_level).map(([level, count]) => (
                        <div key={level} style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                          <span style={{ width: 60 }}>第{level}层:</span>
                          <Progress 
                            percent={Math.min((count as number) * 10, 100)} 
                            size="small" 
                            style={{ flex: 1 }}
                            format={() => `${count}个`}
                          />
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>

                {/* 关键影响路径 */}
                <Col span={8}>
                  <Card size="small" title="🚨 关键影响路径">
                    {record.impact_detail.critical_paths.length > 0 ? (
                      <div style={{ maxHeight: 150, overflow: 'auto' }}>
                        {record.impact_detail.critical_paths.slice(0, 3).map((path, idx) => (
                          <div key={idx} style={{ marginBottom: 8, padding: 8, background: '#fafafa', borderRadius: 4 }}>
                            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>路径 {idx + 1}:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {path.slice(0, 5).map((fn, i) => (
                                <React.Fragment key={i}>
                                  <Tag color={i === 0 ? 'red' : 'blue'} style={{ fontSize: 11 }}>
                                    {fn.split('.').pop()}
                                  </Tag>
                                  {i < Math.min(path.length, 5) - 1 && <span style={{ color: '#999' }}>→</span>}
                                </React.Fragment>
                              ))}
                              {path.length > 5 && <span style={{ color: '#999' }}>...+{path.length - 5}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>未检测到关键路径</div>
                    )}
                  </Card>
                </Col>
              </Row>
            )}

            {/* 受影响最大的函数 */}
            {record.impact_detail && record.impact_detail.top_impact_funcs && record.impact_detail.top_impact_funcs.length > 0 && (
              <Card size="small" title="📊 受影响最大的函数 (Top 10)" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {record.impact_detail.top_impact_funcs.slice(0, 10).map((fn, idx) => (
                    <Tooltip 
                      key={idx} 
                      title={`距离: ${fn.distance}层 | 重要性: ${fn.importance.toFixed(1)} | 被调用: ${fn.call_count}次`}
                    >
                      <Tag 
                        color={fn.is_critical ? 'red' : fn.importance > 50 ? 'orange' : 'default'}
                        style={{ cursor: 'pointer' }}
                      >
                        {fn.is_critical && '⚡'} {fn.name.split('.').pop()}
                      </Tag>
                    </Tooltip>
                  ))}
                </div>
              </Card>
            )}

            {/* 问题列表 */}
            {record.issues && record.issues.length > 0 && (
              <Card size="small" title="⚠️ 检测到的问题" style={{ marginTop: 16 }}>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {record.issues.map((issue, idx) => (
                    <li key={idx} style={{ color: '#E74C3C', marginBottom: 4 }}>{issue}</li>
                  ))}
                </ul>
              </Card>
            )}
          </TabPane>

          {/* 2. 调用链路拓扑图 */}
          <TabPane 
            tab={
              <span>
                <ShareAltOutlined /> 调用链路拓扑图
              </span>
            } 
            key="2"
          >
            <ImpactGraphVisualization 
              impactDetail={record.impact_detail} 
              funcName={record.name} 
            />
          </TabPane>

          {/* 3. 全链路调用链 */}
          <TabPane 
            tab={
              <span>
                <ApartmentOutlined /> 全链路调用链
              </span>
            } 
            key="3"
          >
            <FullCallChainTimeline function={record} />
          </TabPane>
        </Tabs>
      </div>
    );
  };

  const fileColumns = [
    {
      title: '文件路径',
      dataIndex: 'path',
      key: 'path',
      width: 300,
      ellipsis: true
    },
    {
      title: '变更类型',
      dataIndex: 'change_type',
      key: 'change_type',
      width: 100,
      render: (changeType: string) => (
        <Tag color={changeType === 'added' ? 'green' : changeType === 'deleted' ? 'red' : 'blue'}>
          {changeType === 'added' ? '新增' : changeType === 'deleted' ? '删除' : '修改'}
        </Tag>
      )
    },
    {
      title: '包名',
      dataIndex: 'package',
      key: 'package',
      width: 120,
      ellipsis: true
    },
    {
      title: '新增行',
      dataIndex: 'added_lines',
      key: 'added_lines',
      width: 100,
      render: (lines: number) => (
        <span style={{ color: lines > 100 ? '#E74C3C' : '#27AE60' }}>{lines}</span>
      )
    },
    {
      title: '删除行',
      dataIndex: 'deleted_lines',
      key: 'deleted_lines',
      width: 100,
      render: (lines: number) => (
        <span style={{ color: lines > 100 ? '#E74C3C' : '#F39C12' }}>{lines}</span>
      )
    },
    {
      title: '复杂度',
      dataIndex: 'complexity',
      key: 'complexity',
      width: 100,
      render: (complexity: number) => (
        <span style={{ color: complexity > 50 ? '#E74C3C' : complexity > 20 ? '#F39C12' : '#27AE60' }}>
          {complexity}
        </span>
      )
    },
    {
      title: '影响面',
      dataIndex: 'impact_count',
      key: 'impact_count',
      width: 100,
      render: (impact: number) => (
        <Tag color={impact > 20 ? 'red' : impact > 10 ? 'orange' : 'blue'}>{impact}</Tag>
      )
    },
    {
      title: '风险分数',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      render: (score: number) => (
        <span style={{ 
          color: score >= 70 ? '#E74C3C' : score >= 40 ? '#F39C12' : '#27AE60',
          fontWeight: 600
        }}>
          {score?.toFixed(1) || 0}
        </span>
      )
    },
    {
      title: '风险等级',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => getSeverityTag(level)
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!report) {
    return <div style={{ padding: '24px' }}>报告不存在</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>
        风险分析报告详情
      </h1>

      {/* 概要信息 */}
      <Card title="风险评估概要" style={{ marginBottom: 24 }}>
        <Descriptions bordered column={3}>
          <Descriptions.Item label="总风险分数">
            <span style={{ 
              fontSize: 20,
              fontWeight: 600,
              color: report.summary.total_score >= 70 ? '#E74C3C' : 
                     report.summary.total_score >= 40 ? '#F39C12' : '#27AE60'
            }}>
              {report.summary.total_score.toFixed(1)}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="风险等级">
            {getSeverityTag(report.summary.level)}
          </Descriptions.Item>
          <Descriptions.Item label="变更文件数">
            {report.summary.files_changed}
          </Descriptions.Item>
          <Descriptions.Item label="函数变更数">
            {report.summary.funcs_changed}
          </Descriptions.Item>
          <Descriptions.Item label="代码变更行数">
            {report.summary.lines_changed}
          </Descriptions.Item>
          <Descriptions.Item label="风险特征数">
            {report.features.length}
          </Descriptions.Item>
          <Descriptions.Item label="直接影响">
            {report.summary.direct_impact}
          </Descriptions.Item>
          <Descriptions.Item label="间接影响">
            {report.summary.indirect_impact}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 可视化图表 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card title="风险评分" bordered={false}>
            <RiskScoreGauge summary={report.summary} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="评分细分" bordered={false}>
            <ScoreBreakdownBar summary={report.summary} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="特征分布" bordered={false}>
            <RiskDistributionPie features={report.features} />
          </Card>
        </Col>
      </Row>

      {/* 风险特征详情 */}
      <Card title="风险特征详情" style={{ marginBottom: 24 }}>
        <Table
          columns={featureColumns}
          dataSource={report.features}
          rowKey={(record, index) => `${record.type}-${index}`}
          pagination={false}
        />
      </Card>

      {/* 函数风险详情(新增的影响面分析) */}
      {report.functions && report.functions.length > 0 && (
        <Card 
          title={
            <span>
              <ApartmentOutlined style={{ marginRight: 8 }} />
              函数风险详情 - 影响面分析
              <Tag color="blue" style={{ marginLeft: 12 }}>参考美团后羿系统</Tag>
            </span>
          } 
          style={{ marginBottom: 24 }}
        >
          <Table
            columns={functionColumns}
            dataSource={report.functions}
            rowKey="full_name"
            pagination={{ pageSize: 10 }}
            expandable={{
              expandedRowRender: renderImpactDetail,
              rowExpandable: () => true
            }}
          />
        </Card>
      )}

      {/* 仓库全景调用拓扑图 */}
      {taskId && (
        <div style={{ marginBottom: 24 }}>
          <RepositoryCallGraph taskId={taskId} />
        </div>
      )}

      {/* 文件变更详情 */}
      <Card title="文件变更详情">
        <Table
          columns={fileColumns}
          dataSource={report.files}
          rowKey="path"
          pagination={{ pageSize: 10 }}
          expandable={{
            expandedRowRender: (record: FileChange) => (
              <div style={{ padding: '12px 24px' }}>
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="包名">{record.package || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="复杂度">{record.complexity}</Descriptions.Item>
                  <Descriptions.Item label="影响面">{record.impact_count}</Descriptions.Item>
                  <Descriptions.Item label="函数数量">{record.functions?.length || 0}</Descriptions.Item>
                </Descriptions>
                
                {record.functions && record.functions.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>变更函数列表:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {record.functions.map((func, idx) => (
                        <Tag key={idx} color="blue">{func}</Tag>
                      ))}
                    </div>
                  </div>
                )}
                
                {record.issues && record.issues.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: '#E74C3C' }}>检测到的问题:</div>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#E74C3C' }}>
                      {record.issues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ),
            rowExpandable: (record) => (record.functions && record.functions.length > 0) || (record.issues && record.issues.length > 0)
          }}
        />
      </Card>
    </div>
  );
};

export default ReportDetail;
