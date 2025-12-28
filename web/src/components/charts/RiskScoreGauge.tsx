import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { RiskSummary } from '../../types';

interface RiskScoreGaugeProps {
  summary: RiskSummary;
}

const RiskScoreGauge: React.FC<RiskScoreGaugeProps> = ({ summary }) => {
  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 10,
        itemStyle: {
          color: summary.total_score >= 70 ? '#E74C3C' : 
                 summary.total_score >= 40 ? '#F39C12' : '#27AE60'
        },
        progress: {
          show: true,
          width: 18
        },
        pointer: {
          show: false
        },
        axisLine: {
          lineStyle: {
            width: 18
          }
        },
        axisTick: {
          distance: -30,
          splitNumber: 5,
          lineStyle: {
            width: 2,
            color: '#999'
          }
        },
        splitLine: {
          distance: -40,
          length: 14,
          lineStyle: {
            width: 3,
            color: '#999'
          }
        },
        axisLabel: {
          distance: -20,
          color: '#999',
          fontSize: 14
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}',
          color: 'inherit',
          fontSize: 40,
          offsetCenter: [0, '80%']
        },
        data: [
          {
            value: summary.total_score,
            name: summary.level.toUpperCase()
          }
        ]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '350px' }} />;
};

export default RiskScoreGauge;
