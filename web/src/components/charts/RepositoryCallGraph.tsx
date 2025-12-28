import React, { useEffect, useState } from 'react';
import { Card, Spin, Empty, Statistic, Row, Col, Alert } from 'antd';
import { ApartmentOutlined, NodeIndexOutlined, LinkOutlined } from '@ant-design/icons';

interface RepositoryCallGraphProps {
  taskId: string;
}

interface CallGraphData {
  task_id: string;
  repo_path: string;
  total_relations: number;
  node_count: number;
  nodes: Array<{
    id: string;
    label: string;
    type: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    count: number;
  }>;
}

const RepositoryCallGraph: React.FC<RepositoryCallGraphProps> = ({ taskId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CallGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCallGraph();
  }, [taskId]);

  const fetchCallGraph = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/callgraph/${taskId}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || '获取调用图失败');
      }
    } catch (err) {
      setError('网络请求失败');
      console.error('Failed to fetch call graph:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderVisualization = () => {
    if (!data) return null;

    // 使用SVG绘制简化的调用图统计
    const svg = (
      <svg width="100%" height="400" style={{ border: '1px solid #e8e8e8', borderRadius: 4, background: '#fafafa' }}>
        <text x="50%" y="30" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#333">
          仓库完整调用关系图
        </text>
        
        <text x="50%" y="60" textAnchor="middle" fontSize="14" fill="#666">
          {data.repo_path}
        </text>

        {/* 节点统计 */}
        <g transform="translate(150, 120)">
          <circle cx="0" cy="0" r="60" fill="#3498DB" opacity="0.8" />
          <text x="0" y="-10" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#fff">
            {data.node_count}
          </text>
          <text x="0" y="15" textAnchor="middle" fontSize="12" fill="#fff">
            函数节点
          </text>
        </g>

        {/* 关系统计 */}
        <g transform="translate(450, 120)">
          <circle cx="0" cy="0" r="60" fill="#E74C3C" opacity="0.8" />
          <text x="0" y="-10" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#fff">
            {data.total_relations}
          </text>
          <text x="0" y="15" textAnchor="middle" fontSize="12" fill="#fff">
            调用关系
          </text>
        </g>

        {/* 连接线 */}
        <line x1="210" y1="120" x2="390" y2="120" stroke="#95A5A6" strokeWidth="2" strokeDasharray="5,5" />
        <polygon points="390,115 400,120 390,125" fill="#95A5A6" />

        {/* 图例 */}
        <g transform="translate(50, 250)">
          <text x="0" y="0" fontSize="14" fontWeight="bold" fill="#333">调用关系类型分布：</text>
          {getCallTypeStats(data.edges).map((stat, idx) => (
            <g key={stat.type} transform={`translate(0, ${(idx + 1) * 25})`}>
              <rect x="0" y="-12" width="15" height="15" fill={getTypeColor(stat.type)} />
              <text x="25" y="0" fontSize="12" fill="#666">
                {stat.type}: {stat.count} 个
              </text>
            </g>
          ))}
        </g>

        {/* 说明 */}
        <text x="50%" y="380" textAnchor="middle" fontSize="12" fill="#999">
          💡 提示：此图展示了整个仓库的函数调用关系概览
        </text>
      </svg>
    );

    return svg;
  };

  const getCallTypeStats = (edges: CallGraphData['edges']) => {
    const stats: { [key: string]: number } = {};
    edges.forEach(edge => {
      stats[edge.type] = (stats[edge.type] || 0) + 1;
    });
    return Object.entries(stats).map(([type, count]) => ({ type, count }));
  };

  const getTypeColor = (type: string): string => {
    const colors: { [key: string]: string } = {
      'direct': '#3498DB',
      'indirect': '#95A5A6',
      'goroutine': '#F39C12',
      'defer': '#9B59B6',
      'interface': '#1ABC9C'
    };
    return colors[type] || '#7F8C8D';
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="正在构建仓库调用图..." />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert
          message="获取调用图失败"
          description={error}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <Empty description="暂无调用图数据" />
      </Card>
    );
  }

  return (
    <Card
      title={
        <span>
          <ApartmentOutlined style={{ marginRight: 8 }} />
          仓库全景调用拓扑图
        </span>
      }
    >
      {/* 统计概览 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="函数节点总数"
              value={data.node_count}
              prefix={<NodeIndexOutlined />}
              valueStyle={{ color: '#3498DB' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="调用关系总数"
              value={data.total_relations}
              prefix={<LinkOutlined />}
              valueStyle={{ color: '#E74C3C' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="平均调用数"
              value={data.node_count > 0 ? (data.total_relations / data.node_count).toFixed(2) : 0}
              prefix={<ApartmentOutlined />}
              valueStyle={{ color: '#F39C12' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 可视化图表 */}
      <div style={{ marginTop: 16 }}>
        {renderVisualization()}
      </div>

      {/* 提示信息 */}
      <Alert
        style={{ marginTop: 16 }}
        message="功能说明"
        description="此拓扑图展示了整个仓库所有 Go 函数的调用关系，包括直接调用、goroutine、defer 等不同类型的调用方式。可以帮助你全面了解代码架构和依赖关系。"
        type="info"
        showIcon
      />
    </Card>
  );
};

export default RepositoryCallGraph;
