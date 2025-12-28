import React from 'react';
import { Timeline, Tag, Card, Empty, Badge } from 'antd';
import { 
  FunctionOutlined, 
  ArrowRightOutlined, 
  FireOutlined,
  CheckCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { FunctionRisk, ImpactDetail } from '../../types';

interface CallChainNode {
  funcName: string;
  level: number;
  isAffected: boolean;
  isCritical: boolean;
  distance: number;
  importance?: number;
}

interface FullCallChainProps {
  function: FunctionRisk;
}

const FullCallChainTimeline: React.FC<FullCallChainProps> = ({ function: func }) => {
  // 构建完整调用链数据
  const buildCallChain = (impactDetail?: ImpactDetail): CallChainNode[] => {
    if (!impactDetail) return [];

    const chain: CallChainNode[] = [];
    const processedFuncs = new Set<string>();

    // 添加源函数
    chain.push({
      funcName: func.name,
      level: 0,
      isAffected: true,
      isCritical: true,
      distance: 0
    });
    processedFuncs.add(func.name);

    // 按层级添加受影响的函数
    const maxLevel = impactDetail.max_depth_reached;
    for (let level = 1; level <= maxLevel; level++) {
      const funcsAtLevel = impactDetail.top_impact_funcs?.filter(
        f => f.distance === level && !processedFuncs.has(f.name)
      ) || [];

      funcsAtLevel.forEach(fn => {
        chain.push({
          funcName: fn.name,
          level: level,
          isAffected: true,
          isCritical: fn.is_critical,
          distance: fn.distance,
          importance: fn.importance
        });
        processedFuncs.add(fn.name);
      });
    }

    // 如果从关键路径也能获取信息，补充进来
    impactDetail.critical_paths?.forEach((path, idx) => {
      if (idx === 0) { // 只处理第一条关键路径
        path.forEach((fnName, i) => {
          if (!processedFuncs.has(fnName) && fnName !== func.name) {
            chain.push({
              funcName: fnName,
              level: i,
              isAffected: true,
              isCritical: i <= 2,
              distance: i
            });
            processedFuncs.add(fnName);
          }
        });
      }
    });

    // 按 level 排序
    return chain.sort((a, b) => a.level - b.level);
  };

  const callChain = buildCallChain(func.impact_detail);

  if (callChain.length === 0) {
    return (
      <Empty 
        description="暂无调用链数据"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ padding: '40px 0' }}
      />
    );
  }

  // 获取时间轴节点颜色
  const getTimelineColor = (node: CallChainNode): string => {
    if (node.level === 0) return 'red';
    if (node.isCritical) return 'orange';
    return 'blue';
  };

  // 获取时间轴节点图标
  const getTimelineIcon = (node: CallChainNode) => {
    if (node.level === 0) {
      return <FireOutlined style={{ fontSize: 16 }} />;
    }
    if (node.isCritical) {
      return <WarningOutlined style={{ fontSize: 14 }} />;
    }
    return <CheckCircleOutlined style={{ fontSize: 14 }} />;
  };

  return (
    <div style={{ padding: '16px 0' }}>
      {/* 统计概览 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'space-around' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#E74C3C' }}>
              {func.impact_detail?.total_impact || 0}
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>总影响数</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#F39C12' }}>
              {func.impact_detail?.max_depth_reached || 0}
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>最大深度</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#3498DB' }}>
              {func.direct_impact}
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>直接影响</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#9B59B6' }}>
              {func.indirect_impact}
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>间接影响</div>
          </div>
        </div>
      </Card>

      {/* 调用链时间轴 */}
      <Card 
        size="small" 
        title={
          <span>
            <FunctionOutlined /> 完整调用链路（共 {callChain.length} 个节点）
          </span>
        }
      >
        <Timeline mode="left">
          {callChain.map((node, idx) => (
            <Timeline.Item
              key={`${node.funcName}-${idx}`}
              color={getTimelineColor(node)}
              dot={getTimelineIcon(node)}
              label={
                <div style={{ width: 80, textAlign: 'right', fontSize: 12, color: '#666' }}>
                  第 {node.level} 层
                  {node.level === 0 && <div style={{ color: '#E74C3C', fontSize: 10 }}>源函数</div>}
                </div>
              }
            >
              <div style={{ 
                padding: '12px 16px', 
                background: node.level === 0 ? '#FFF5F5' : '#FAFAFA',
                borderRadius: 4,
                border: node.level === 0 ? '2px solid #E74C3C' : '1px solid #E8E8E8'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: 8
                }}>
                  <span style={{ 
                    fontSize: 14, 
                    fontWeight: node.level === 0 ? 600 : 400,
                    fontFamily: 'Monaco, monospace'
                  }}>
                    {node.funcName.split('.').pop()}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {node.level === 0 && <Tag color="red">变更源</Tag>}
                    {node.isCritical && node.level > 0 && <Tag color="orange">关键路径</Tag>}
                    {node.isAffected && <Tag color="blue">受影响</Tag>}
                  </div>
                </div>
                
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                  完整路径: <code style={{ 
                    background: '#F5F5F5', 
                    padding: '2px 6px', 
                    borderRadius: 2,
                    fontSize: 11
                  }}>{node.funcName}</code>
                </div>

                {node.importance && (
                  <div style={{ fontSize: 12, color: '#999' }}>
                    重要性指数: 
                    <Badge 
                      count={node.importance.toFixed(1)} 
                      style={{ 
                        backgroundColor: node.importance > 50 ? '#F39C12' : '#52C41A',
                        marginLeft: 8
                      }} 
                    />
                  </div>
                )}

                {idx < callChain.length - 1 && (
                  <div style={{ 
                    marginTop: 8, 
                    paddingTop: 8, 
                    borderTop: '1px dashed #E8E8E8',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#999',
                    fontSize: 11
                  }}>
                    <ArrowRightOutlined style={{ marginRight: 4 }} />
                    调用 {callChain[idx + 1].funcName.split('.').pop()}
                  </div>
                )}
              </div>
            </Timeline.Item>
          ))}
        </Timeline>

        {/* 影响路径摘要 */}
        {func.impact_detail?.critical_paths && func.impact_detail.critical_paths.length > 0 && (
          <Card 
            size="small" 
            title="🔥 关键影响路径" 
            style={{ marginTop: 16, background: '#FFF7E6', border: '1px solid #FFD591' }}
          >
            {func.impact_detail.critical_paths.slice(0, 3).map((path, idx) => (
              <div key={idx} style={{ 
                marginBottom: 8, 
                padding: 8, 
                background: '#FFF', 
                borderRadius: 4,
                fontSize: 12
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#D46B08' }}>
                  路径 {idx + 1} (深度: {path.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  {path.slice(0, 6).map((fn, i) => (
                    <React.Fragment key={i}>
                      <Tag 
                        color={i === 0 ? 'red' : i <= 2 ? 'orange' : 'default'}
                        style={{ margin: 0, fontSize: 11 }}
                      >
                        {fn.split('.').pop()}
                      </Tag>
                      {i < Math.min(path.length, 6) - 1 && (
                        <ArrowRightOutlined style={{ fontSize: 10, color: '#999' }} />
                      )}
                    </React.Fragment>
                  ))}
                  {path.length > 6 && (
                    <span style={{ color: '#999', fontSize: 11 }}>...+{path.length - 6} 个</span>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </Card>
    </div>
  );
};

export default FullCallChainTimeline;
