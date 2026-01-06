import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { api } from '../api/client';
import { Loader2, Search, AlertCircle, Info, Target, ArrowRight, Zap, AlertTriangle } from 'lucide-react';
import ImpactGraphCanvas from '../components/ImpactGraphCanvas';

const ImpactPage = () => {
    const [functionName, setFunctionName] = useState('');
    const [maxDepth, setMaxDepth] = useState(5);
    const [loading, setLoading] = useState(false);
    const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [impactStats, setImpactStats] = useState(null);

    // 从报告加载变更函数列表
    const [taskId, setTaskId] = useState('');
    const [tasks, setTasks] = useState([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [changedFunctions, setChangedFunctions] = useState([]);
    const [loadingFunctions, setLoadingFunctions] = useState(false);

    const fetchTasks = async () => {
        setLoadingTasks(true);
        try {
            const response = await api.listTasks();
            const allTasks = response.data.data || [];
            setTasks(allTasks);
            // Default to the first completed task
            const completed = allTasks.find(t => t.status === 'completed');
            if (completed && !taskId) setTaskId(completed.id);
        } catch (err) {
            console.error('Failed to fetch tasks:', err);
        } finally {
            setLoadingTasks(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    // 加载任务的变更函数列表
    const loadChangedFunctions = async () => {
        if (!taskId.trim()) return;

        setLoadingFunctions(true);
        setError(null);
        try {
            const response = await api.getReport(taskId);
            const report = response.data.data;

            // 提取变更函数
            const functions = [];
            
            // 后端返回的数据结构是 report.functions，不是 report.file_risks
            if (report?.functions && report.functions.length > 0) {
                report.functions.forEach(fn => {
                    functions.push({
                        name: fn.name,
                        fullName: fn.full_name || fn.name,
                        file: fn.file,
                        risk: fn.level || 'low',
                    });
                });
            }

            if (functions.length === 0) {
                setError('No changed functions found in this task. The task may not be completed yet.');
            } else {
                setChangedFunctions(functions);
            }
        } catch (err) {
            console.error('Failed to load changed functions:', err);
            setError(err.response?.data?.error || 'Failed to load report. Please check the task ID.');
        } finally {
            setLoadingFunctions(false);
        }
    };

    // 搜索函数影响链
    const handleSearch = async () => {
        if (!functionName.trim()) {
            alert('Please enter a function name');
            return;
        }

        setLoading(true);
        setError(null);
        setHasSearched(true);

        try {
            const response = await api.getImpactGraph(functionName, maxDepth);
            const data = response.data.data;

            // 转换为 ReactFlow 格式
            const { nodes, edges, stats } = transformImpactData(data);
            setGraphData({ nodes, edges });
            setImpactStats(stats);

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Failed to fetch impact graph');
            setGraphData({ nodes: [], edges: [] });
        } finally {
            setLoading(false);
        }
    };

    // 转换影响图数据
    const transformImpactData = (data) => {
        if (!data || !data.nodes) {
            return { nodes: [], edges: [], stats: null };
        }

        const nodes = data.nodes.map((node, index) => {
            const isChanged = node.is_change || node.level === 0;
            const level = node.level || 0;

            // 根据层级和变更状态确定颜色
            let riskLevel = 'low';
            if (isChanged) riskLevel = 'critical';
            else if (level === 1) riskLevel = 'high';
            else if (level <= 3) riskLevel = 'medium';

            return {
                id: node.id,
                type: 'impact',
                position: { x: level * 300, y: index * 100 },
                data: {
                    label: node.label || node.id.split('.').pop(),
                    fullName: node.id,
                    isChanged,
                    level,
                    risk: riskLevel,
                    file: node.file,
                    line: node.line,
                },
            };
        });

        const edges = (data.edges || []).map((edge, index) => ({
            id: `e-${index}`,
            source: edge.from || edge.source,
            target: edge.to || edge.target,
            type: 'smoothstep',
            label: edge.type || 'calls',
            animated: true,
        }));

        // 计算统计信息
        const stats = {
            totalNodes: nodes.length,
            changedNodes: nodes.filter(n => n.data.isChanged).length,
            directImpact: nodes.filter(n => n.data.level === 1).length,
            indirectImpact: nodes.filter(n => n.data.level > 1).length,
            maxLevel: Math.max(...nodes.map(n => n.data.level), 0),
        };

        // 使用层级布局
        layoutByLevel(nodes, edges);

        return { nodes, edges, stats };
    };

    // 按层级布局
    const layoutByLevel = (nodes, edges) => {
        const levelGroups = {};
        nodes.forEach(node => {
            const level = node.data.level;
            if (!levelGroups[level]) levelGroups[level] = [];
            levelGroups[level].push(node);
        });

        Object.entries(levelGroups).forEach(([level, levelNodes]) => {
            const levelNum = parseInt(level);
            levelNodes.forEach((node, index) => {
                node.position = {
                    x: levelNum * 350 + 100,
                    y: index * 120 + 50,
                };
            });
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg shadow-sm border border-orange-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-100 rounded-lg">
                        <Target size={24} className="text-orange-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Change Impact Analysis</h2>
                        <p className="text-slate-600">Analyze how code changes affect other parts of the system</p>
                    </div>
                </div>

                {/* Task ID for loading changed functions */}
                <div className="mb-4 p-4 bg-white rounded-lg border border-orange-100">
                    <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Zap size={16} className="text-orange-500" />
                        Quick Start: Load from Analysis Task
                    </h3>
                    <div className="flex gap-3">
                        <select
                            value={taskId}
                            onChange={(e) => setTaskId(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="">Select a task...</option>
                            {tasks.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.id} ({t.status}) - {new Date(t.created_at).toLocaleString()}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={loadChangedFunctions}
                            disabled={loadingFunctions || !taskId.trim()}
                            className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50 text-sm font-medium"
                        >
                            {loadingFunctions ? 'Loading...' : 'Load Functions'}
                        </button>
                        <button
                            onClick={fetchTasks}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                            title="Refresh tasks"
                        >
                            <Loader2 size={16} className={loadingTasks ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {/* Changed functions list */}
                    {changedFunctions.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs text-slate-500 mb-2">Click to analyze impact:</p>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                {changedFunctions.map((fn, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setFunctionName(fn.fullName || fn.name);
                                            handleSearch();
                                        }}
                                        className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                                            fn.risk === 'high' || fn.risk === 'critical'
                                                ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                                                : fn.risk === 'medium'
                                                    ? 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'
                                                    : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                                            }`}
                                        title={fn.fullName || fn.name}
                                    >
                                        {fn.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Manual search */}
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Function Name</label>
                        <input
                            type="text"
                            value={functionName}
                            onChange={(e) => setFunctionName(e.target.value)}
                            placeholder="e.g., CreateUser, handler.UserHandler"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Max Depth</label>
                        <select
                            value={maxDepth}
                            onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            {[1, 2, 3, 5, 10].map(d => (
                                <option key={d} value={d}>{d} levels</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleSearch}
                            disabled={loading || !functionName.trim()}
                            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Search size={20} />
                                    Analyze Impact
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}
            </div>

            {/* Impact Stats */}
            {impactStats && (
                <div className="grid grid-cols-5 gap-4">
                    <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
                        <div className="text-3xl font-bold text-slate-800">{impactStats.totalNodes}</div>
                        <div className="text-sm text-slate-600">Total Affected</div>
                    </div>
                    <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-4 text-center">
                        <div className="text-3xl font-bold text-red-600">{impactStats.changedNodes}</div>
                        <div className="text-sm text-red-700">Changed</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-200 p-4 text-center">
                        <div className="text-3xl font-bold text-orange-600">{impactStats.directImpact}</div>
                        <div className="text-sm text-orange-700">Direct Impact</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 p-4 text-center">
                        <div className="text-3xl font-bold text-yellow-600">{impactStats.indirectImpact}</div>
                        <div className="text-sm text-yellow-700">Indirect Impact</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-4 text-center">
                        <div className="text-3xl font-bold text-blue-600">{impactStats.maxLevel}</div>
                        <div className="text-sm text-blue-700">Max Depth</div>
                    </div>
                </div>
            )}

            {/* Graph Canvas */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200" style={{ height: '600px' }}>
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <Loader2 size={48} className="animate-spin text-orange-600 mx-auto" />
                            <p className="mt-4 text-slate-600">Analyzing impact chain...</p>
                        </div>
                    </div>
                ) : graphData.nodes.length > 0 ? (
                    <ReactFlowProvider>
                        <ImpactGraphCanvas
                            nodes={graphData.nodes}
                            edges={graphData.edges}
                        />
                    </ReactFlowProvider>
                ) : hasSearched ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <Info size={48} className="mb-4 text-slate-400" />
                        <p className="text-lg font-medium">No Impact Data Found</p>
                        <p className="text-sm mt-2">The function might not have any callers or the analysis data is not available.</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <div className="relative">
                            <Target size={64} className="text-orange-200" />
                            <ArrowRight size={24} className="absolute -right-4 top-1/2 -translate-y-1/2 text-orange-300 animate-pulse" />
                        </div>
                        <p className="text-lg font-medium mt-4">Enter a function name to analyze its impact</p>
                        <p className="text-sm mt-2 text-slate-400">Discover which parts of the codebase are affected by changes</p>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800 mb-3">Impact Level Legend</h3>
                <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm text-slate-600">Changed Function (Source)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-orange-500" />
                        <span className="text-sm text-slate-600">Direct Impact (Level 1)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-yellow-500" />
                        <span className="text-sm text-slate-600">Indirect Impact (Level 2-3)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-500" />
                        <span className="text-sm text-slate-600">Distant Impact (Level 4+)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ArrowRight size={16} className="text-slate-400" />
                        <span className="text-sm text-slate-600">Call Direction</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImpactPage;
