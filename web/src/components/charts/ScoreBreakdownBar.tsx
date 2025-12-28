import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { RiskSummary } from '../../types';

interface ScoreBreakdownBarProps {
  summary: RiskSummary;
}

const ScoreBreakdownBar: React.FC<ScoreBreakdownBarProps> = ({ summary }) => {
  const { score_breakdown } = summary;

  const option = {
    title: {
      text: '风险评分细分',
      left: 'center',
      top: 10,
      textStyle: { fontSize: 16 }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['复杂度\n(30%)', '影响面\n(40%)', '历史\n(20%)', '特征\n(10%)'],
      axisLabel: { interval: 0 }
    },
    yAxis: {
      type: 'value',
      max: 100
    },
    series: [
      {
        name: '得分',
        type: 'bar',
        data: [
          {
            value: score_breakdown.complexity_score,
            itemStyle: { color: '#3498DB' }
          },
          {
            value: score_breakdown.impact_score,
            itemStyle: { color: '#9B59B6' }
          },
          {
            value: score_breakdown.history_score,
            itemStyle: { color: '#E67E22' }
          },
          {
            value: score_breakdown.feature_score,
            itemStyle: { color: '#E74C3C' }
          }
        ],
        label: {
          show: true,
          position: 'top',
          formatter: '{c}'
        },
        barWidth: '50%'
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '350px' }} />;
};

export default ScoreBreakdownBar;
