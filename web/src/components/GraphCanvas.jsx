import React, { useCallback, useState, useMemo, useEffect } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    Panel,
    useReactFlow,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Search, Filter, Layout, Maximize2, Eye, EyeOff } from 'lucide-react';

// Custom node component with enhanced styling and animations
const CustomNode = ({ data, selected }) => {
    const [isHovered, setIsHovered] = useState(false);
    const isGroup = data.label?.includes('📂');
    const risk = data.risk || 'low';

    // Risk-based color coding
    const riskColors = {
        critical: { bg: '#fee2e2', border: '#dc2626', glow: '#ef4444' },
        high: { bg: '#fed7aa', border: '#ea580c', glow: '#f97316' },
        medium: { bg: '#fef3c7', border: '#d97706', glow: '#f59e0b' },
        low: { bg: '#dcfce7', border: '#16a34a', glow: '#22c55e' },
        default: { bg: '#eff6ff', border: '#3b82f6', glow: '#60a5fa' },
    };

    const colors = riskColors[risk] || riskColors.default;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative transition-all duration-300"
            style={{
                background: isGroup ? '#f8fafc' : colors.bg,
                border: `1.5px ${isGroup ? 'dashed' : 'solid'} ${colors.border}`,
                borderRadius: '8px',
                padding: '10px 14px',
                minWidth: '220px',
                boxShadow: selected || isHovered
                    ? `0 0 15px ${colors.glow}30, 0 4px 10px rgba(0,0,0,0.1)`
                    : '0 1px 4px rgba(0,0,0,0.05)',
                transform: selected || isHovered ? 'translateY(-2px)' : 'none',
                animation: data.changed ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
            }}
        >
            <div className="flex flex-col">
                <div className="text-sm font-bold text-slate-800 truncate">
                    {data.label}
                </div>
                {data.subLabel && (
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {data.subLabel}
                    </div>
                )}
            </div>

            {(selected || isHovered) && data.details && (
                <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-600 flex justify-between items-center">
                    <span className="font-medium">Risk: <span className="uppercase">{risk}</span></span>
                    {data.details.calls > 0 && <span>{data.details.calls} connections</span>}
                </div>
            )}

            {data.changed && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm" />
            )}
        </div>
    );
};

const nodeTypes = {
    custom: CustomNode,
};

const GraphCanvas = ({
    nodes: initialNodes = [],
    edges: initialEdges = [],
    onNodeClick,
    layout = 'dagre',
    showMiniMap = true,
}) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRisk, setSelectedRisk] = useState('all');
    const [highlightedNodes, setHighlightedNodes] = useState(new Set());
    const [showLabels, setShowLabels] = useState(true);
    const { fitView } = useReactFlow();

    // Enhanced nodes with custom styling and animations
    const enhancedNodes = useMemo(() => {
        return initialNodes.map(node => ({
            ...node,
            type: 'custom',
            data: {
                ...node.data,
                details: {
                    calls: initialEdges.filter(e => e.source === node.id).length,
                }
            },
        }));
    }, [initialNodes, initialEdges]);

    // Enhanced edges with animations and styling
    const enhancedEdges = useMemo(() => {
        return initialEdges.map(edge => {
            const count = parseInt(edge.label) || 1;
            const isHighlighted = highlightedNodes.has(edge.source) || highlightedNodes.has(edge.target);

            return {
                ...edge,
                animated: count > 5 || isHighlighted,
                // Preserve and enhance markerEnd for arrows
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: isHighlighted ? '#ef4444' : edge.style?.stroke || '#64748b',
                    width: 20,
                    height: 20,
                },
                style: {
                    ...edge.style,
                    stroke: isHighlighted ? '#ef4444' : edge.style?.stroke || '#64748b',
                    strokeWidth: isHighlighted
                        ? Math.min(4 + Math.log10(count || 1), 8)
                        : edge.style?.strokeWidth || 2,
                    opacity: highlightedNodes.size > 0 && !isHighlighted ? 0.2 : 1,
                },
                label: showLabels ? edge.label : undefined,
                labelStyle: {
                    fill: '#1e293b',
                    fontSize: 12,
                    fontWeight: 600,
                },
                labelBgStyle: {
                    fill: '#ffffff',
                    fillOpacity: 0.9,
                },
            };
        });
    }, [initialEdges, highlightedNodes, showLabels]);

    // Filter nodes based on search and risk level
    const filteredNodes = useMemo(() => {
        let filtered = enhancedNodes;

        if (searchTerm) {
            filtered = filtered.filter(node =>
                node.data.label?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (selectedRisk !== 'all') {
            filtered = filtered.filter(node =>
                node.data.risk === selectedRisk
            );
        }

        return filtered.map(node => ({
            ...node,
            style: {
                ...node.style,
                opacity: highlightedNodes.size > 0 && !highlightedNodes.has(node.id) ? 0.3 : 1,
            }
        }));
    }, [enhancedNodes, searchTerm, selectedRisk, highlightedNodes]);

    // Sync with props
    useEffect(() => {
        setNodes(filteredNodes);
        setEdges(enhancedEdges);
    }, [filteredNodes, enhancedEdges, setNodes, setEdges]);

    // Handle node hover for highlighting related nodes
    const handleNodeMouseEnter = useCallback((event, node) => {
        const connected = new Set([node.id]);
        enhancedEdges.forEach(edge => {
            if (edge.source === node.id) connected.add(edge.target);
            if (edge.target === node.id) connected.add(edge.source);
        });
        setHighlightedNodes(connected);
    }, [enhancedEdges]);

    const handleNodeMouseLeave = useCallback(() => {
        setHighlightedNodes(new Set());
    }, []);

    // Node color for minimap
    const nodeColor = useCallback((node) => {
        const riskColors = {
            critical: '#dc2626',
            high: '#ea580c',
            medium: '#d97706',
            low: '#16a34a',
        };
        return riskColors[node.data?.risk] || '#3b82f6';
    }, []);

    return (
        <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 relative">
            {/* Toolbar Panel */}
            <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-3 m-2 space-y-3">
                {/* Search */}
                <div className="flex items-center gap-2">
                    <Search size={16} className="text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search nodes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="text-sm border border-slate-200 rounded px-2 py-1 w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Risk Filter */}
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-slate-400" />
                    <select
                        value={selectedRisk}
                        onChange={(e) => setSelectedRisk(e.target.value)}
                        className="text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Risks</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>

                {/* Toggle Labels */}
                <button
                    onClick={() => setShowLabels(!showLabels)}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                    {showLabels ? <Eye size={16} /> : <EyeOff size={16} />}
                    <span>{showLabels ? 'Hide' : 'Show'} Labels</span>
                </button>

                {/* Fit View */}
                <button
                    onClick={() => fitView({ duration: 800, padding: 0.2 })}
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                    <Maximize2 size={16} />
                    <span>Fit View</span>
                </button>
            </Panel>

            {/* Legend Panel */}
            <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-3 m-2">
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Risk Levels</h4>
                <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border-2 border-red-600 bg-red-100" />
                        <span>Critical</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border-2 border-orange-600 bg-orange-100" />
                        <span>High</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border-2 border-yellow-600 bg-yellow-100" />
                        <span>Medium</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border-2 border-green-600 bg-green-100" />
                        <span>Low</span>
                    </div>
                </div>
            </Panel>

            {/* Stats Panel */}
            {nodes.length > 0 && (
                <Panel position="bottom-left" className="bg-white rounded-lg shadow-lg p-3 m-2">
                    <div className="text-xs text-slate-600 space-y-1">
                        <div><strong>Nodes:</strong> {nodes.length} / {initialNodes.length}</div>
                        <div><strong>Edges:</strong> {edges.length}</div>
                        {highlightedNodes.size > 0 && (
                            <div><strong>Highlighted:</strong> {highlightedNodes.size}</div>
                        )}
                    </div>
                </Panel>
            )}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onNodeMouseEnter={handleNodeMouseEnter}
                onNodeMouseLeave={handleNodeMouseLeave}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
                minZoom={0.1}
                maxZoom={2}
                defaultEdgeOptions={{
                    type: 'smoothstep',
                    animated: false,
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#64748b',
                    },
                }}
            >
                <Controls showInteractive={false} />
                {showMiniMap && (
                    <MiniMap
                        nodeColor={nodeColor}
                        nodeStrokeWidth={3}
                        zoomable
                        pannable
                        style={{
                            backgroundColor: '#f8fafc',
                        }}
                    />
                )}
                <Background
                    color="#cbd5e1"
                    gap={20}
                    size={1}
                    variant="dots"
                />
            </ReactFlow>

            <style>{`
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.7;
                    }
                }
            `}</style>
        </div>
    );
};

export default GraphCanvas;
