import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { RiskFeature } from '../../types';

interface RiskDistributionPieProps {
  features: RiskFeature[];
}

const RiskDistributionPie: React.FC<RiskDistributionPieProps> = ({ features }) => {
  // 按类型聚合特征
  const featureMap = features.reduce((acc, feature) => {
    const type = feature.type;
    if (!acc[type]) {
      acc[type] = { count: 0, severity: feature.severity };
    }
    acc[type].count += feature.count;
    return acc;
  }, {} as Record<string, { count: number; severity: string }>);

  const data = Object.entries(featureMap).map(([type, info]) => ({
    name: type,
    value: info.count,
    itemStyle: {
      color: info.severity === 'high' ? '#E74C3C' :
             info.severity === 'medium' ? '#F39C12' : '#3498DB'
    }
  }));

  const option = {
    title: {
      text: '风险特征分布',
      left: 'center',
      top: 10,
      textStyle: { fontSize: 16 }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle'
    },
    series: [
      {
        name: '风险特征',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '55%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        data: data
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '400px' }} />;
};

export default RiskDistributionPie;
