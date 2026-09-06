import { useState, useEffect, useRef } from 'react';
import { Network, ZoomIn, ZoomOut, Maximize2, Info } from 'lucide-react';
import { knowledgeAPI } from '../services/api';

interface KGNode {
  id: number;
  label: string;
  type: string;
  properties: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface KGEdge {
  id: number;
  source_id: number;
  target_id: number;
  relation_type: string;
  confidence: number;
  evidence: string;
}

const TYPE_COLORS: Record<string, string> = {
  '天体对象': '#F59E0B',
  '物理概念': '#3B82F6',
  '观测设备': '#10B981',
  '科学方法': '#8B5CF6',
  '数据产品': '#EC4899',
  '研究机构': '#6B7280',
};

const RELATION_COLORS: Record<string, string> = {
  '因果关系': '#EF4444',
  '观测关系': '#3B82F6',
  '分类关系': '#10B981',
  '方法关系': '#8B5CF6',
  '数据关系': '#EC4899',
  '演化关系': '#F59E0B',
};

export default function KnowledgeGraphPage() {
  const [nodes, setNodes] = useState<KGNode[]>([]);
  const [edges, setEdges] = useState<KGEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<KGEdge | null>(null);
  const [scale, setScale] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    loadGraph();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const loadGraph = async () => {
    try {
      const res = await knowledgeAPI.getGraph({ limit: 50 });
      const rawNodes = res.data.nodes || [];
      const rawEdges = res.data.edges || [];
      initGraph(rawNodes, rawEdges);
    } catch {
      // Mock数据
      initGraph(getMockNodes(), getMockEdges());
    }
  };

  const initGraph = (rawNodes: any[], rawEdges: any[]) => {
    const width = 800, height = 600;
    const initializedNodes: KGNode[] = rawNodes.map((n, i) => ({
      ...n,
      x: width / 2 + (Math.cos(i * 2.4) * 200) + (Math.random() - 0.5) * 100,
      y: height / 2 + (Math.sin(i * 2.4) * 180) + (Math.random() - 0.5) * 100,
      vx: 0,
      vy: 0,
    }));
    setNodes(initializedNodes);
    setEdges(rawEdges);
    // 启动力导向模拟
    simulate(initializedNodes, rawEdges);
  };

  const simulate = (simNodes: KGNode[], simEdges: KGEdge[]) => {
    let iterations = 0;
    const maxIter = 150;

    const tick = () => {
      if (iterations >= maxIter) return;
      iterations++;

      const updated = simNodes.map((n) => ({ ...n }));

      // 斥力（节点间）
      for (let i = 0; i < updated.length; i++) {
        for (let j = i + 1; j < updated.length; j++) {
          const dx = updated[i].x - updated[j].x;
          const dy = updated[i].y - updated[j].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 3000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          updated[i].vx += fx;
          updated[i].vy += fy;
          updated[j].vx -= fx;
          updated[j].vy -= fy;
        }
      }

      // 引力（边连接的节点）
      for (const edge of simEdges) {
        const source = updated.find((n) => n.id === edge.source_id);
        const target = updated.find((n) => n.id === edge.target_id);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (dist - 120) * 0.01;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      // 向心力
      for (const node of updated) {
        node.vx += (400 - node.x) * 0.001;
        node.vy += (300 - node.y) * 0.001;
        node.x += node.vx * 0.3;
        node.y += node.vy * 0.3;
        node.vx *= 0.85;
        node.vy *= 0.85;
      }

      setNodes([...updated]);
      animRef.current = requestAnimationFrame(tick);
    };

    tick();
  };

  const getNodeById = (id: number) => nodes.find((n) => n.id === id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="kicker mb-1">KNOWLEDGE GRAPH</p>
          <h1 className="text-2xl font-bold text-white">天文知识图谱</h1>
          <p className="text-sm text-gray-400 mt-1">太阳物理领域概念关系网络 · {nodes.length}节点 · {edges.length}关系</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setScale((s) => Math.max(0.5, s - 0.1))} className="btn-secondary p-2">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="mono text-xs text-gray-400 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.min(2, s + 0.1))} className="btn-secondary p-2">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Graph Canvas */}
        <div className="lg:col-span-3 card-lab p-0 overflow-hidden relative" style={{ height: '520px' }}>
          <svg
            ref={svgRef}
            viewBox="0 0 800 600"
            className="w-full h-full"
            style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
          >
            {/* Edges */}
            {edges.map((edge) => {
              const source = getNodeById(edge.source_id);
              const target = getNodeById(edge.target_id);
              if (!source || !target) return null;
              const color = RELATION_COLORS[edge.relation_type] || '#4B5563';
              const isHighlighted = selectedNode &&
                (edge.source_id === selectedNode.id || edge.target_id === selectedNode.id);
              return (
                <g key={edge.id}>
                  <line
                    x1={source.x} y1={source.y}
                    x2={target.x} y2={target.y}
                    stroke={color}
                    strokeWidth={isHighlighted ? 2.5 : 1}
                    strokeOpacity={isHighlighted ? 0.9 : 0.35}
                    onMouseEnter={() => setHoveredEdge(edge)}
                    onMouseLeave={() => setHoveredEdge(null)}
                  />
                  {isHighlighted && (
                    <text
                      x={(source.x + target.x) / 2}
                      y={(source.y + target.y) / 2 - 5}
                      fill={color}
                      fontSize="8"
                      textAnchor="middle"
                    >
                      {edge.relation_type}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const color = TYPE_COLORS[node.type] || '#6B7280';
              const isSelected = selectedNode?.id === node.id;
              const isConnected = selectedNode && edges.some(
                (e) => (e.source_id === selectedNode.id && e.target_id === node.id) ||
                       (e.target_id === selectedNode.id && e.source_id === node.id)
              );
              const opacity = selectedNode ? (isSelected || isConnected ? 1 : 0.3) : 1;
              return (
                <g
                  key={node.id}
                  onClick={() => setSelectedNode(isSelected ? null : node)}
                  className="cursor-pointer"
                  opacity={opacity}
                >
                  <circle
                    cx={node.x} cy={node.y}
                    r={isSelected ? 14 : 10}
                    fill={color}
                    fillOpacity={0.85}
                    stroke={isSelected ? '#fff' : color}
                    strokeWidth={isSelected ? 2 : 0.5}
                  />
                  <text
                    x={node.x} y={node.y + 20}
                    fill="#E5E7EB"
                    fontSize="9"
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1 text-[10px] text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                {type}
              </span>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="space-y-4">
          {selectedNode ? (
            <div className="card-lab animate-in">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: TYPE_COLORS[selectedNode.type] }}
                />
                <h3 className="font-semibold text-white">{selectedNode.label}</h3>
              </div>
              <p className="text-xs text-gray-400 mb-2">类型: {selectedNode.type}</p>
              {selectedNode.properties && (
                <p className="text-xs text-gray-300 leading-relaxed">
                  {(() => { try { return JSON.parse(selectedNode.properties).description; } catch { return selectedNode.properties; } })()}
                </p>
              )}
              <div className="mt-4 pt-3 border-t border-deep-border">
                <p className="text-xs text-gray-400 mb-2">关联关系:</p>
                <div className="space-y-1.5">
                  {edges
                    .filter((e) => e.source_id === selectedNode.id || e.target_id === selectedNode.id)
                    .slice(0, 6)
                    .map((e) => {
                      const other = getNodeById(e.source_id === selectedNode.id ? e.target_id : e.source_id);
                      return (
                        <div key={e.id} className="flex items-center gap-2 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: RELATION_COLORS[e.relation_type] }} />
                          <span className="text-gray-300">{other?.label}</span>
                          <span className="text-gray-500 ml-auto">{e.relation_type}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            <div className="card-lab flex flex-col items-center justify-center py-12 text-center">
              <Network className="w-8 h-8 text-gray-600 mb-3" />
              <p className="text-sm text-gray-400">点击节点查看详情</p>
              <p className="text-xs text-gray-500 mt-1">展示太阳物理领域知识网络</p>
            </div>
          )}

          {/* Relation Legend */}
          <div className="card">
            <p className="text-xs font-medium text-gray-300 mb-3">关系类型</p>
            <div className="space-y-2">
              {Object.entries(RELATION_COLORS).map(([rel, color]) => (
                <div key={rel} className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-4 h-0.5 rounded" style={{ background: color }} />
                  {rel}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getMockNodes() {
  return [
    { id: 1, label: '太阳耀斑', type: '天体对象', properties: '{"description":"太阳表面突然释放的巨大能量爆发"}' },
    { id: 2, label: '磁场重联', type: '物理概念', properties: '{"description":"磁力线拓扑结构重新连接"}' },
    { id: 3, label: '太阳黑子', type: '天体对象', properties: '{"description":"太阳光球上温度较低的暗色区域"}' },
    { id: 4, label: '磁剪切角', type: '物理概念', properties: '{"description":"观测磁场方向与势场方向的偏差角度"}' },
    { id: 5, label: 'SDO卫星', type: '观测设备', properties: '{"description":"NASA太阳动力学天文台"}' },
    { id: 6, label: '深度学习预测', type: '科学方法', properties: '{"description":"CNN/LSTM等模型用于耀斑预测"}' },
    { id: 7, label: 'JW-SSD数据集', type: '数据产品', properties: '{"description":"国家天文台太阳黑子数据"}' },
    { id: 8, label: '活动区', type: '天体对象', properties: '{"description":"太阳表面磁场复杂的活跃区域"}' },
    { id: 9, label: '自由磁能', type: '物理概念', properties: '{"description":"非势场磁能与势场磁能之差"}' },
    { id: 10, label: '国家天文科学数据中心', type: '研究机构', properties: '{"description":"NADC"}' },
  ];
}

function getMockEdges() {
  return [
    { id: 1, source_id: 1, target_id: 2, relation_type: '因果关系', confidence: 0.95, evidence: '' },
    { id: 2, source_id: 4, target_id: 1, relation_type: '因果关系', confidence: 0.82, evidence: '' },
    { id: 3, source_id: 3, target_id: 8, relation_type: '分类关系', confidence: 0.99, evidence: '' },
    { id: 4, source_id: 5, target_id: 4, relation_type: '数据关系', confidence: 0.95, evidence: '' },
    { id: 5, source_id: 6, target_id: 1, relation_type: '方法关系', confidence: 0.85, evidence: '' },
    { id: 6, source_id: 7, target_id: 10, relation_type: '数据关系', confidence: 1.0, evidence: '' },
    { id: 7, source_id: 9, target_id: 1, relation_type: '因果关系', confidence: 0.90, evidence: '' },
    { id: 8, source_id: 2, target_id: 9, relation_type: '因果关系', confidence: 0.92, evidence: '' },
    { id: 9, source_id: 1, target_id: 8, relation_type: '观测关系', confidence: 0.98, evidence: '' },
    { id: 10, source_id: 7, target_id: 3, relation_type: '数据关系', confidence: 0.95, evidence: '' },
  ];
}
