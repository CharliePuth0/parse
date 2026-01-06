import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useTasks } from '../hooks/useApi';
import { formatDate, getRiskColor } from '../utils/helpers';
import { Activity, Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';

const HomePage = () => {
    const { tasks, loading } = useTasks();
    const [stats, setStats] = useState(null);

    useEffect(() => {
        api.getStatistics().then(res => setStats(res.data.data)).catch(console.error);
    }, []);

    const recentTasks = tasks.slice(0, 5);

    return (
        <div className="p-8 bg-gradient-to-br from-gray-50 to-white min-h-full">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Total Tasks</p>
                                <p className="text-3xl font-bold text-gray-900">{stats?.total_tasks || 0}</p>
                            </div>
                            <Activity className="w-12 h-12 text-blue-500 opacity-80" />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Running</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {stats?.status_breakdown?.running || 0}
                                </p>
                            </div>
                            <Clock className="w-12 h-12 text-yellow-500 opacity-80" />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Completed</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {stats?.status_breakdown?.completed || 0}
                                </p>
                            </div>
                            <CheckCircle className="w-12 h-12 text-green-500 opacity-80" />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Failed</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {stats?.status_breakdown?.failed || 0}
                                </p>
                            </div>
                            <AlertTriangle className="w-12 h-12 text-red-500 opacity-80" />
                        </div>
                    </div>
                </div>

                {/* Recent Tasks */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Analysis Tasks</h2>
                    {loading ? (
                        <p className="text-gray-500">Loading tasks...</p>
                    ) : recentTasks.length === 0 ? (
                        <p className="text-gray-500">No tasks yet. Create  your first analysis!</p>
                    ) : (
                        <div className="space-y-3">
                            {recentTasks.map(task => (
                                <div key={task.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">{task.repo_path}</p>
                                        <p className="text-sm text-gray-500">
                                            {task.base_commit} → {task.target_commit}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600">{formatDate(task.created_at)}</p>
                                            <div className="flex items-center space-x-2 mt-1">
                                                <div className="w-32 bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-blue-600 h-2 rounded-full transition-all"
                                                        style={{ width: `${task.progress || 0}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-600">{task.progress || 0}%</span>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${task.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                task.status === 'running' ? 'bg-yellow-100 text-yellow-700' :
                                                    task.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                        'bg-gray-100 text-gray-700'
                                            }`}>
                                            {task.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomePage;
