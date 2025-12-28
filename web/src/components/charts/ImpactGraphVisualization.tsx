import React, { useEffect, useRef } from 'react';
import { ImpactDetail } from '../../types';
import { Empty } from 'antd';

interface ImpactGraphProps {
  impactDetail?: ImpactDetail;
  funcName: string;
}

const ImpactGraphVisualization: React.FC<ImpactGraphProps> = ({ impactDetail, funcName }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 简化版本：由于 G6 API 兼容性问题，暂时使用纯 HTML/CSS 展示
    // TODO: 后续使用稳定版本的 G6 或其他图形库
    if (!containerRef.current || !impactDetail) return;

    // 清空容器
    containerRef.current.innerHTML = '';

    // 使用 SVG 绘制简单的层级图
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '500');
    svg.style.border = '1px solid #e8e8e8';
    svg.style.borderRadius = '4px';
    svg.style.background = '#fafafa';

    // 添加标题
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', '50%');
    title.setAttribute('y', '30');
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-size', '16');
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('fill', '#333');
    title.textContent = `调用链路拓扑图 - ${funcName}`;
    svg.appendChild(title);

    // 添加层级展示
    let yOffset = 80;
    const levelData = impactDetail.impact_by_level || {};
    
    Object.entries(levelData).forEach(([level, count], idx) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      // 层级标签
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '50');
      label.setAttribute('y', String(yOffset));
      label.setAttribute('font-size', '14');
      label.setAttribute('fill', '#666');
      label.textContent = `第 ${level} 层 (${count} 个节点)`;
      g.appendChild(label);
      
      // 进度条
      const barWidth = Math.min((count as number) * 30, 400);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '150');
      rect.setAttribute('y', String(yOffset - 15));
      rect.setAttribute('width', String(barWidth));
      rect.setAttribute('height', '20');
      rect.setAttribute('fill', idx === 0 ? '#E74C3C' : '#3498DB');
      rect.setAttribute('rx', '4');
      g.appendChild(rect);
      
      svg.appendChild(g);
      yOffset += 40;
    });

    // 添加总计信息
    const summary = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    summary.setAttribute('x', '50%');
    summary.setAttribute('y', String(yOffset + 20));
    summary.setAttribute('text-anchor', 'middle');
    summary.setAttribute('font-size', '14');
    summary.setAttribute('fill', '#999');
    summary.textContent = `总影响: ${impactDetail.total_impact} | 最大深度: ${impactDetail.max_depth_reached} 层 | 影响分数: ${impactDetail.impact_score.toFixed(1)}`;
    svg.appendChild(summary);

    containerRef.current.appendChild(svg);
  }, [impactDetail, funcName]);

  if (!impactDetail) {
    return (
      <div style={{ 
        height: 500, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#fafafa',
        borderRadius: 4
      }}>
        <Empty 
          description="暂无调用链路数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: 500 }} />
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        right: 10, 
        padding: '8px 12px',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 4,
        fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div><span style={{ color: '#E74C3C' }}>●</span> 变更函数</div>
        <div><span style={{ color: '#F39C12' }}>●</span> 关键影响</div>
        <div><span style={{ color: '#3498DB' }}>●</span> 间接影响</div>
      </div>
    </div>
  );
};

export default ImpactGraphVisualization;
