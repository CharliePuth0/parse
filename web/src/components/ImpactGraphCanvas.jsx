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

// Custom impact node component
const ImpactNode = ({ data, selected }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    // Level-based color coding for impact analysis
    const levelColors = {
        critical: { bg: '#fef2f2', border: '#dc2626', glow: '#ef4444', text: 'Changed' },
        high: { bg: '#fff7ed', border: '#ea580c', glow: '#f97316', text: 'Direct' },
        medium: { bg: '#fefce8', border: '#ca8a04', glow: '#eab308', text: 'L2-3' },
        low: { bg: '#f0fdf4', border: '#16a34a', glow: '#22c55e', text: 'L4+' },
    };
    
    const colors = levelColors[data.risk] || levelColors.low;
    
    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="relative transition-all duration-300"
            style={{
                background: colors.bg,
                border: `3px solid ${colors.border}`,
                borderRadius: '12px',
                padding: '12px 16px',
                minWidth: '180px',
                maxWidth: '280px',
                boxShadow: selected || isHovered 
                    ? `0 0 25px ${colors.glow}50, 0 4px 20px rgba(0,0,0,0.2)` 
                    : '0 2px 10px rgba(0,0,0,0.1)',
                transform: selected || isHovered ? 'scale(1.08)' : 'scale(1)',
                animation: data.isChanged ? 'impactPulse 2s ease-in-out infinite' : 'none',
            }}
        >
            {/* Level badge */}
            <div 
                className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: colors.border }}
            >
                {data.isChanged ? '🎯 Source' : `L${data.level}`}
            </div>
            
            {/* Function name */}
            <div className="font-semibold text-slate-800 text-sm truncate" title={data.fullName}>
                {data.label}
            </div>
            
            {/* Full path on hover */}
            {isHovered && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                    <div className="text-xs text-slate-500 break-all">
                        {data.fullName}
                    </div>
                    {data.file && (
                        <div className="text-xs text-slate-400 mt-1">
                            📄 {data.file}{data.line ? `:${data.line}` : ''}
                        </div>
                    )}
                </div>
            )}
            
            {/* Impact indicator */}
            {data.isChanged && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            )}
        </div>
    );
};

const nodeTypes = {
    impact: ImpactNode,
};

const ImpactGraphCanvas = ({ 
    nodes: initialNodes = [], 
    edges: initialEdges = [],
}) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [highlightedPath, setHighlightedPath] = useState(new Set());
    const { fitView } = useReactFlow();

    // Enhanced edges with arrows and animations
    const enhancedEdges = useMemo(() => {
        return initialEdges.map(edge => {
            const isHighlighted = highlightedPath.has(edge.source) || highlightedPath.has(edge.target);
            
            return {
                ...edge,
                type: 'smoothstep',
                animated: true,
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: isHighlighted ? '#ef4444' : '#64748b',
                    width: 25,
                    height: 25,
                },
                style: {
                    stroke: isHighlighted ? '#ef4444' : '#64748b',
                    strokeWidth: isHighlighted ? 4 : 2.5,
                    opacity: highlightedPath.size > 0 && !isHighlighted ? 0.2 : 1,
                },
                labelStyle: {
                    fill: '#475569',
                    fontSize: 11,
                    fontWeight: 600,
                },
                labelBgStyle: {
                    fill: '#ffffff',
                    fillOpacity: 0.9,
                },
            };
        });
    }, [initialEdges, highlightedPath]);

    // Enhanced nodes
    const enhancedNodes = useMemo(() => {
        return initialNodes.map(node => ({
            ...node,
            type: 'impact',
            style: {
                ...node.style,
                opacity: highlightedPath.size > 0 && !highlightedPath.has(node.id) ? 0.3 : 1,
            }
        }));
    }, [initialNodes, highlightedPath]);

    // Sync with props
    useEffect(() => {
        setNodes(enhancedNodes);
        setEdges(enhancedEdges);
    }, [enhancedNodes, enhancedEdges, setNodes, setEdges]);

    // Highlight path on node hover
    const handleNodeMouseEnter = useCallback((event, node) => {
        const path = new Set([node.id]);
        
        // Find all connected nodes (upstream and downstream)
        const findConnected = (nodeId, visited = new Set()) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            path.add(nodeId);
            
            enhancedEdges.forEach(edge => {
                if (edge.source === nodeId && !visited.has(edge.target)) {
                    findConnected(edge.target, visited);
                }
                if (edge.target === nodeId && !visited.has(edge.source)) {
                    findConnected(edge.source, visited);
                }
            });
        };
        
        findConnected(node.id);
        setHighlightedPath(path);
    }, [enhancedEdges]);

    const handleNodeMouseLeave = useCallback(() => {
        setHighlightedPath(new Set());
    }, []);

    // Node color for minimap
    const nodeColor = useCallback((node) => {
        const colors = {
            critical: '#dc2626',
            high: '#ea580c',
            medium: '#ca8a04',
            low: '#16a34a',
        };
        return colors[node.data?.risk] || '#3b82f6';
    }, []);

    return (
        <div className="w-full h-full bg-gradient-to-br from-orange-50 to-red-50 relative">
            {/* Info Panel */}
            <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-3 m-2">
                <h4 className="text-sm font-semibold text-slate-800 mb-2">🎯 Impact Analysis</h4>
                <div className="text-xs text-slate-600 space-y-1">
                    <div>Nodes: <strong>{nodes.length}</strong></div>
                    <div>Edges: <strong>{edges.length}</strong></div>
                    {highlightedPath.size > 0 && (
                        <div className="text-orange-600">Path: <strong>{highlightedPath.size}</strong> nodes</div>
                    )}
                </div>
                <button
                    onClick={() => fitView({ duration: 800, padding: 0.3 })}
                    className="mt-2 w-full px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200 transition-colors"
                >
                    Fit View
                </button>
            </Panel>

            {/* Arrow Direction Legend */}
            <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-3 m-2">
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Arrow Direction</h4>
                <div className="text-xs text-slate-600">
                    <div className="flex items-center gap-2 mb-1">
                        <span>Caller</span>
                        <span className="text-orange-500">→</span>
                        <span>Callee</span>
                    </div>
                    <p className="text-slate-400 mt-2">
                        Arrows point from the calling<br/>
                        function to the called function
                    </p>
                </div>
            </Panel>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeMouseEnter={handleNodeMouseEnter}
                onNodeMouseLeave={handleNodeMouseLeave}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
                minZoom={0.2}
                maxZoom={2}
                defaultEdgeOptions={{
                    type: 'smoothstep',
                    animated: true,
                }}
            >
                <Controls showInteractive={false} />
                <MiniMap 
                    nodeColor={nodeColor} 
                    nodeStrokeWidth={3} 
                    zoomable 
                    pannable
                    style={{
                        backgroundColor: '#fef2f2',
                    }}
                />
                <Background 
                    color="#fdba74" 
                    gap={25} 
                    size={1}
                    variant="dots"
                />
            </ReactFlow>
            
            <style>{`
                @keyframes impactPulse {
                    0%, 100% {
                        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
                    }
                    50% {
                        box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
                    }
                }
            `}</style>
        </div>
    );
};

export default ImpactGraphCanvas;
