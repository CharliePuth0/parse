import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Progress, message } from 'antd';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTasks } from '../services/api';
import type { Task } from '../types';
import dayjs from 'dayjs';

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (error) {
      message.error('加载任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '等待中' },
      running: { color: 'processing', text: '执行中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' }
    };
    const config = statusMap[status] || statusMap.pending;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      ellipsis: true
    },
    {
      title: '仓库路径',
      dataIndex: 'repo_path',
      key: 'repo_path',
      render: (path: string) => path.split('/').pop() || path
    },
    {
      title: '提交范围',
      key: 'commits',
      render: (record: Task) => (
        <span>{record.base_commit} → {record.target_commit}</span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (progress: number, record: Task) => (
        record.status === 'running' ? (
          <Progress percent={progress} size="small" status="active" />
        ) : (
          <Progress percent={progress} size="small" />
        )
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (record: Task) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            disabled={record.status !== 'completed'}
            onClick={() => navigate(`/report/${record.id}`)}
          >
            查看报告
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>
          分析任务列表
        </h1>
        <Button icon={<ReloadOutlined />} onClick={loadTasks}>
          刷新
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 条记录`
        }}
      />
    </div>
  );
};

export default TaskList;
