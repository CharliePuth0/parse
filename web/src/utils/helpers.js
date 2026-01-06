import { MarkerType } from 'reactflow';
import dagre from 'dagre';

// Helper to extract package name from function ID
const getPackageName = (id) => {
    if (!id) return 'unknown';

    // Handle different ID formats:
    // "pkg/path.Type.Func" or "pkg/path.Func" or "FuncName"
    const lastDotIndex = id.lastIndexOf('.');
    if (lastDotIndex === -1) {
        // No package separator, check for slash
        const lastSlashIndex = id.lastIndexOf('/');
        return lastSlashIndex === -1 ? 'main' : id.substring(0, lastSlashIndex);
    }

    // Remove function name (everything after last dot)
    const withoutFunc = id.substring(0, lastDotIndex);

    // Find package path (everything before the type name)
    const lastSlashIndex = withoutFunc.lastIndexOf('/');
    if (lastSlashIndex === -1) {
        // No slash, might be just "package.Type"
        const firstDot = withoutFunc.indexOf('.');
        return firstDot === -1 ? withoutFunc : withoutFunc.substring(0, firstDot);
    }

    // Try to find where package ends and type begins
    // Usually it's the last component before the last dot
    const parts = withoutFunc.split('/');
    const lastPart = parts[parts.length - 1];
    const dotInLast = lastPart.indexOf('.');

    if (dotInLast !== -1) {
        // Last part has a dot, so package is everything before this part
        parts.pop();
        return parts.length > 0 ? parts.join('/') : lastPart.substring(0, dotInLast);
    }

    // No dot in last part, the whole thing is the package
    return withoutFunc;
};

// Helper to extract package path from function ID
// Handles various formats:
// - "github.com/user/repo/pkg.Func" -> "github.com/user/repo/pkg"
// - "github.com/user/repo/pkg.Type.Method" -> "github.com/user/repo/pkg"
// - "flag.Float64" -> "flag" (stdlib without full path)
// - "reflect.interfaceType.Method" -> "reflect"
// - "AppendArrayDelim" -> "<unknown>/AppendArrayDelim" (bare function name)
export const getPackagePath = (id) => {
    if (!id) return '<unknown>';
    
    // If there's no dot at all, it's a bare function name
    const lastDotIndex = id.lastIndexOf('.');
    if (lastDotIndex === -1) {
        // Bare function name without package, use a special marker
        return `<unknown>/${id}`;
    }

    // Get the part before the function name
    let pkgPart = id.substring(0, lastDotIndex);

    // Check if this looks like it has a full path (contains '/')
    const lastSlash = pkgPart.lastIndexOf('/');
    if (lastSlash !== -1) {
        // Full path like "github.com/user/repo/pkg.Type.Func"
        const afterSlash = pkgPart.substring(lastSlash + 1);
        if (afterSlash.includes('.')) {
            // It has a type name, strip it: "github.com/user/repo/pkg.Type" -> "github.com/user/repo/pkg"
            pkgPart = id.substring(0, id.lastIndexOf('.', lastDotIndex - 1));
        }
    } else {
        // No slash, could be:
        // - "flag.Float64" (stdlib package)
        // - "reflect.interfaceType.Method" (stdlib with type)
        const parts = id.split('.');
        if (parts.length > 2) {
            // "reflect.interfaceType.Method" -> "reflect"
            pkgPart = parts[0];
        } else if (parts.length === 2) {
            // "flag.Float64" -> "flag"
            pkgPart = parts[0];
        } else {
            // Single part, shouldn't reach here due to lastDotIndex check
            return `<unknown>/${id}`;
        }
    }

    return pkgPart;
};

// Build a tree of packages/directories from flat node list
export const buildPackageTree = (nodes) => {
    const root = { id: 'root', children: {}, type: 'root' };
    const functionMap = new Map(); // funcId -> packagePath

    nodes.forEach(node => {
        const pkgPath = getPackagePath(node.id);
        functionMap.set(node.id, pkgPath);

        const parts = pkgPath.split('/');
        let current = root;
        let currentPath = '';

        parts.forEach((part, index) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!current.children[part]) {
                current.children[part] = {
                    id: currentPath,
                    name: part,
                    children: {},
                    functionCount: 0,
                    type: index === parts.length - 1 ? 'package' : 'directory',
                    isLeaf: false
                };
            }
            current = current.children[part];

            // Increment count for this path segment
            // Note: strictly speaking we should only count functions at the LEAF package level
            // but showing aggregated count is useful.
        });

        // Mark the leaf package and count functions
        if (current) {
            current.isLeaf = true;
            current.functionCount = (current.functionCount || 0) + 1;
            // Also propagate counts up? 
            // For simplicity, let's just count at leaf for now, or re-traverse to sum up.
        }
    });

    // Helper to calculate total functions recursively
    const calculateTotals = (node) => {
        let sum = node.functionCount || 0;
        Object.values(node.children).forEach(child => {
            sum += calculateTotals(child);
        });
        node.totalFunctions = sum;
        return sum;
    };
    calculateTotals(root);

    return { root, functionMap };
};

// Compute the visible graph based on tree and expansion state
export const getVisibleGraph = (treeData, expandedNodeIds, allEdges, layoutMode = 'dagre') => {
    const { root, functionMap } = treeData;
    const nodes = [];
    const visibleNodeMap = new Map(); // path -> node

    // 1. Traverse tree to find visible nodes
    // Show top-level packages, and their children if expanded
    const traverse = (node) => {
        const children = Object.values(node.children);

        children.forEach(child => {
            // Always show children of the current node level being traversed
            nodes.push(createDisplayNode(child));
            visibleNodeMap.set(child.id, child.id);

            // If this node is expanded and has children, traverse deeper
            if (expandedNodeIds.has(child.id) && Object.keys(child.children).length > 0) {
                traverse(child);
            }
        });
    };

    traverse(root);

    // 2. Aggregate edges
    const findVisibleAncestor = (pkgPath) => {
        let current = pkgPath;
        while (current) {
            if (visibleNodeMap.has(current)) return current;
            const lastSlash = current.lastIndexOf('/');
            if (lastSlash === -1) break;
            current = current.substring(0, lastSlash);
        }
        return null;
    };

    const edgeMap = new Map();
    let skippedEdges = 0;
    let processedEdges = 0;

    allEdges.forEach(edge => {
        const srcPkg = functionMap.get(edge.source);
        const tgtPkg = functionMap.get(edge.target);

        if (!srcPkg || !tgtPkg) {
            skippedEdges++;
            // 调试信息：只打印前几条
            if (skippedEdges <= 3) {
                console.warn('Edge skipped - source or target package not found:', {
                    source: edge.source,
                    target: edge.target,
                    srcPkg,
                    tgtPkg
                });
            }
            return;
        }

        const srcVisible = findVisibleAncestor(srcPkg);
        const tgtVisible = findVisibleAncestor(tgtPkg);

        // Connect nodes if they are different
        if (srcVisible && tgtVisible && srcVisible !== tgtVisible) {
            processedEdges++;
            const key = `${srcVisible}->${tgtVisible}`;
            const existingEdge = edgeMap.get(key);
            if (existingEdge) {
                existingEdge.count += 1;
                // 聚合多种类型
                if (!existingEdge.types.includes(edge.type)) {
                    existingEdge.types.push(edge.type);
                }
            } else {
                edgeMap.set(key, {
                    count: 1,
                    types: [edge.type],
                    primaryType: edge.type
                });
            }
        }
    });

    console.log('Edge processing stats:', {
        totalInputEdges: allEdges.length,
        skippedEdges,
        processedEdges,
        finalEdgeCount: edgeMap.size,
        visibleNodes: nodes.length,
        sampleFunctionMap: Array.from(functionMap.entries()).slice(0, 3)
    });

    // 类型映射：将后端的类型映射到显示名称
    const getEdgeTypeLabel = (types) => {
        // 按优先级显示最重要的类型
        if (types.includes('goroutine')) return 'goroutine';
        if (types.includes('defer')) return 'defer';
        if (types.includes('rpc')) return 'RPC';
        if (types.includes('http')) return 'HTTP';
        if (types.includes('indirect')) return 'indirect';
        if (types.includes('direct')) return 'calls';
        return 'calls';
    };

    // 根据类型设置样式
    const getEdgeStyle = (types, count) => {
        // goroutine 和 defer 使用虚线，颜色不同
        const isAsync = types.includes('goroutine');
        const isDefer = types.includes('defer');
        const isIndirect = types.includes('indirect') || types.includes('rpc') || types.includes('http');
        
        let stroke = '#64748b';  // 默认颜色（direct calls）
        let strokeDasharray = undefined;
        
        if (isAsync) {
            stroke = '#8b5cf6';  // 紫色表示goroutine
            strokeDasharray = '8,4';  // 长虚线
        } else if (isDefer) {
            stroke = '#f59e0b';  // 橙色表示defer
            strokeDasharray = '4,4';  // 短虚线
        } else if (isIndirect) {
            stroke = '#94a3b8';  // 灰色表示间接调用
            strokeDasharray = '5,5';  // 中等虚线
        }
        
        return {
            stroke,
            strokeWidth: Math.min(1.5 + Math.log10(count), 4),
            strokeDasharray,
        };
    };

    const edges = [];
    edgeMap.forEach((edgeInfo, key) => {
        const [source, target] = key.split('->');
        const typeLabel = getEdgeTypeLabel(edgeInfo.types);
        edges.push({
            id: `e-${source}-${target}`, // Deterministic ID
            source,
            target,
            label: `${typeLabel} (${edgeInfo.count})`,
            type: 'smoothstep',
            animated: edgeInfo.count > 5,
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#64748b',
            },
            labelStyle: { fill: '#64748b', fontWeight: 500, fontSize: '10px' },
            labelBgPadding: [4, 2],
            labelBgBorderRadius: 4,
            labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
            style: getEdgeStyle(edgeInfo.types, edgeInfo.count)
        });
    });

    // 3. Layout with Dagre
    if (layoutMode === 'horizontal') {
        layoutWithDagre(nodes, edges, 'LR');
    } else {
        layoutWithDagre(nodes, edges, 'TB');
    }

    return { nodes, edges };
};

// Standard Dagre layout helper
const layoutWithDagre = (nodes, edges, direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
        rankdir: direction,
        nodesep: direction === 'TB' ? 120 : 80,
        ranksep: direction === 'TB' ? 150 : 200,
        marginx: 50,
        marginy: 50,
    });

    nodes.forEach(node => {
        dagreGraph.setNode(node.id, { width: 240, height: 60 });
    });

    edges.forEach(edge => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach(node => {
        const pos = dagreGraph.node(node.id);
        node.position = { x: pos.x - 120, y: pos.y - 30 };
    });
};

// Legacy support/alias
const layoutWithForce = (nodes, edges) => layoutWithDagre(nodes, edges, 'TB');

// Calculate risk level based on node properties
const calculateRisk = (treeNode) => {
    const funcCount = treeNode.totalFunctions || 0;
    if (funcCount > 50) return 'critical';
    if (funcCount > 20) return 'high';
    if (funcCount > 5) return 'medium';
    return 'low';
};

const createDisplayNode = (treeNode) => {
    const isGroup = Object.keys(treeNode.children).length > 0;
    const risk = calculateRisk(treeNode);

    return {
        id: treeNode.id,
        type: 'custom',
        data: {
            label: `${isGroup ? '📂' : '📦'} ${treeNode.name}`,
            subLabel: `${treeNode.totalFunctions} functions`,
            risk: risk,
            changed: treeNode.changed || false,
            isGroup: isGroup,
            details: {
                totalFunctions: treeNode.totalFunctions,
                isGroup: isGroup,
            }
        },
        style: {
            width: 240,
        },
        _treeNode: treeNode
    };
};

// Legacy support (rename of original function if needed, or we just utilize the new logic in the Page)
// But to keep API simple for the Page component:
export const transformCallGraphData = (apiData) => {
    if (!apiData || !apiData.nodes) return { tree: null, rawEdges: [] };
    const { root, functionMap } = buildPackageTree(apiData.nodes);
    return { tree: { root, functionMap }, rawEdges: apiData.edges };
};

// Format date
export const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
};

// Get risk color
export const getRiskColor = (level) => {
    const colors = {
        low: 'bg-green-100 text-green-800',
        medium: 'bg-yellow-100 text-yellow-800',
        high: 'bg-red-100 text-red-800',
        critical: 'bg-purple-100 text-purple-800',
    };
    return colors[level?.toLowerCase()] || 'bg-gray-100 text-gray-800';
};
