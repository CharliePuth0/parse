import React, { useState, useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { api } from '../api/client';
import GraphCanvas from '../components/GraphCanvas';
import Layout from '../components/Layout';
import { transformCallGraphData, getVisibleGraph } from '../utils/helpers';
import { Loader2, Search, AlertCircle, Info, Layout as LayoutIcon, GitBranch, Layers } from 'lucide-react';

const GraphPage = () => {
    const [taskId, setTaskId] = useState('task_1767180757658797000');
    const [loading, setLoading] = useState(false);
    const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [apiMessage, setApiMessage] = useState('');

    // Hierarchical state
    const [treeData, setTreeData] = useState(null);
    const [rawEdges, setRawEdges] = useState([]);
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [layoutMode, setLayoutMode] = useState('vertical'); // vertical, horizontal

    // Auto-load on mount
    useEffect(() => {
        if (taskId) {
            handleLoad();
        }
    }, []);

    // Recalculate graph when tree or expansion state changes
    useEffect(() => {
        if (treeData && rawEdges) {
            const { nodes, edges } = getVisibleGraph(treeData, expandedNodes, rawEdges, layoutMode);
            setGraphData({ nodes, edges });
        }
    }, [treeData, rawEdges, expandedNodes, layoutMode]);

    const handleLoad = async () => {
        if (!taskId.trim()) {
            alert('Please enter a task ID');
            return;
        }

        setLoading(true);
        setError(null);
        setHasSearched(true);
        setApiMessage('');
        // Reset state
        setTreeData(null);
        setExpandedNodes(new Set());

        try {
            const response = await api.getCallGraph(taskId);
            const data = response.data.data;

            if (data.message) {
                setApiMessage(data.message);
            }

            console.log('Raw API Data:', {
                nodes: data.nodes?.length,
                edges: data.edges?.length,
                total_relations: data.total_relations
            });

            // Use the new transform which returns tree structure
            const { tree, rawEdges } = transformCallGraphData(data);

            setTreeData(tree);
            setRawEdges(rawEdges);

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Failed to fetch call graph');
        } finally {
            setLoading(false);
        }
    };

    const handleNodeClick = (event, node) => {
        // We stored _treeNode in node data during creation in helpers.js
        const treeNode = node._treeNode;
        if (treeNode && Object.keys(treeNode.children).length > 0) {
            const newExpanded = new Set(expandedNodes);
            const nodeId = treeNode.id;

            if (newExpanded.has(nodeId)) {
                newExpanded.delete(nodeId);
            } else {
                newExpanded.add(nodeId);
            }
            setExpandedNodes(newExpanded);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Call Graph Visualization</h2>
                <p className="text-slate-600 mb-6">Explore package-level dependencies for analysis tasks</p>

                <div className="flex gap-4 mb-4">
                    <input
                        type="text"
                        value={taskId}
                        onChange={(e) => setTaskId(e.target.value)}
                        placeholder="Enter task ID"
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleLoad}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Loading...
                            </>
                        ) : (
                            <>
                                <Search size={20} />
                                Load Graph
                            </>
                        )}
                    </button>
                </div>

                {/* Layout Mode Selector */}
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <LayoutIcon size={16} />
                        Layout:
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setLayoutMode('vertical')}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${layoutMode === 'vertical'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            <Layers size={14} className="inline mr-1" />
                            Vertical
                        </button>
                        <button
                            onClick={() => setLayoutMode('horizontal')}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${layoutMode === 'horizontal'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            <GitBranch size={14} className="inline mr-1" />
                            Horizontal
                        </button>
                    </div>
                </div>

                {apiMessage && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                        {apiMessage}
                    </div>
                )}

                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200" style={{ height: '700px' }}>
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 size={48} className="animate-spin text-blue-600" />
                    </div>
                ) : graphData.nodes.length > 0 ? (
                    <ReactFlowProvider>
                        <GraphCanvas
                            nodes={graphData.nodes}
                            edges={graphData.edges}
                            onNodeClick={handleNodeClick}
                            layout={layoutMode}
                        />
                    </ReactFlowProvider>
                ) : hasSearched ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <Info size={48} className="mb-4 text-slate-400" />
                        <p className="text-lg font-medium">No Graph Data Found</p>
                        <p className="text-sm mt-2">The task might not be completed yet, or no call relations were detected.</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <Search size={48} className="mb-4 text-slate-400" />
                        <p className="text-lg font-medium">Enter a task ID to view the call graph</p>
                    </div>
                )}
            </div>

            {graphData.nodes.length > 0 && (
                <>
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
                        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            📊 Package Dependency Analysis
                        </h3>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                                <p className="text-slate-600">Total Packages</p>
                                <p className="text-2xl font-bold text-blue-600 mt-1">{graphData.nodes.length}</p>
                            </div>
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                                <p className="text-slate-600">Dependencies</p>
                                <p className="text-2xl font-bold text-purple-600 mt-1">{graphData.edges.length}</p>
                            </div>
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                                <p className="text-slate-600">Layout</p>
                                <p className="text-lg font-semibold text-slate-700 mt-1">Hierarchical</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 mt-4">
                            💡 <strong>Tip:</strong> Use mouse wheel to zoom, drag to pan. Edge thickness indicates call frequency.
                        </p>
                    </div>

                    {/* Edge Type Legend */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                        <h3 className="font-semibold text-slate-800 mb-3">调用类型图例</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <svg width="40" height="2">
                                    <line x1="0" y1="1" x2="40" y2="1" stroke="#64748b" strokeWidth="2" />
                                </svg>
                                <span className="text-slate-600">Direct Call</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <svg width="40" height="2">
                                    <line x1="0" y1="1" x2="40" y2="1" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="8,4" />
                                </svg>
                                <span className="text-purple-600 font-medium">Goroutine</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <svg width="40" height="2">
                                    <line x1="0" y1="1" x2="40" y2="1" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,4" />
                                </svg>
                                <span className="text-orange-600 font-medium">Defer</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <svg width="40" height="2">
                                    <line x1="0" y1="1" x2="40" y2="1" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5,5" />
                                </svg>
                                <span className="text-slate-500">Indirect</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default GraphPage;
