import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { 
  DashboardOutlined, 
  UnorderedListOutlined, 
  FileTextOutlined 
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import TaskList from './pages/TaskList';
import ReportDetail from './pages/ReportDetail';
import BranchComparison from './pages/BranchComparison';

const { Header, Content, Footer } = Layout;

const App: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">仪表盘</Link>
    },
    {
      key: '/compare',
      icon: <FileTextOutlined />,
      label: <Link to="/compare">分支对比</Link>
    },
    {
      key: '/tasks',
      icon: <UnorderedListOutlined />,
      label: <Link to="/tasks">任务列表</Link>
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 1, 
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#001529'
      }}>
        <div style={{ 
          color: 'white', 
          fontSize: 20, 
          fontWeight: 600, 
          marginRight: 50,
          whiteSpace: 'nowrap'
        }}>
          🔍 Go代码风险分析系统
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[currentPath.startsWith('/report') ? '/tasks' : currentPath]}
          items={menuItems}
          style={{ flex: 1, minWidth: 0 }}
        />
      </Header>
      
      <Content style={{ backgroundColor: '#f0f2f5' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/compare" element={<BranchComparison />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/report/:taskId" element={<ReportDetail />} />
        </Routes>
      </Content>
      
      <Footer style={{ textAlign: 'center', backgroundColor: '#f0f2f5' }}>
        Go代码变更风险可视化系统 ©2025 | 基于Go AST + 风险特征检测
      </Footer>
    </Layout>
  );
};

export default App;
