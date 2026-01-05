import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge
} from '@xyflow/react'
import { useEffect, useCallback, useState } from 'react'
import OpenAI from 'openai'
import MessageNode, { MessageNodeData, type MessageNodeType } from './nodes/MessageNode.tsx'
import AnchorNode from './nodes/AnchorNode.tsx';
import '@xyflow/react/dist/style.css'

// import ELK from 'elkjs/lib/elk.bundled.js'

// const elk = new ELK()

// const elkOptions = {
//   'elk.algorithm': 'layered',
//   'elk.direction': 'DOWN',
//   'elk.spacing.nodeNode': '80',
//   'elk.layered.spacing.nodeNodeBetweenLayers': '120',
//   'elk.layered.considerModelOrder': 'true',
//   'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
// }

const nodeTypes = {
  message: MessageNode,
  anchor: AnchorNode
}

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_GROK_API_KEY,
  baseURL: 'https://api.x.ai/v1',
  dangerouslyAllowBrowser: true,
})

// Inner component — this is where hooks are allowed
function ReactFlowContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  
  const { getNodes, getEdges } = useReactFlow();

  const onDelete = useCallback((nodeId: string) => {
    const currentEdges = getEdges();
    const currentNodes = getNodes();

    const getDescendants = (id: string, allEdges: Edge[]): string[] => {
      const children = allEdges
      .filter((e) => e.source === id)
      .map((e) => e.target);
      
      let descendants = [...children];
      for (const childId of children) {
        descendants = [...descendants, ...getDescendants(childId, allEdges)];
      }
      return descendants;
    };
    
    const descendantIds = getDescendants(nodeId, currentEdges);
    const incomingEdge = currentEdges.find((e) => e.target === nodeId);
    const sourceNode = currentNodes.find((n) => n.id === incomingEdge?.source);
    const anchorIdToRemove = sourceNode?.type === 'anchor' ? sourceNode.id : null;
    
    const idsToRemove = new Set([nodeId, ...descendantIds]);
    if (anchorIdToRemove) { idsToRemove.add(anchorIdToRemove); }
    setNodes((nds) => nds.filter((n) => !idsToRemove.has(n.id)));
    setEdges((eds) => eds.filter((e) => !idsToRemove.has(e.source) && !idsToRemove.has(e.target)));
  }, [getEdges, getNodes, setNodes, setEdges]);
  
  const onSend = useCallback(async (nodeId: string, message: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId 
          ? { ...node, data: { ...node.data, userMessage: message, assistantMessage: 'Thinking...' } } 
          : node
      )
    )

    const formatPrompt = (userMsg: string, context?: string) => {
      if (!context) return userMsg;
      return `<context_attachment>\n${context}\n</context_attachment>\n\nUser follow-up: ${userMsg}`;
    };
  
    const getHistory = (id: string): { role: 'user' | 'assistant'; content: string }[] => {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const history: { role: 'user' | 'assistant'; content: string }[] = [];
      let searchId: string | undefined = id;

      while (searchId) {
        const node = currentNodes.find((n) => n.id === searchId);
        if (!node) break;

        if (node.data.isIsolated && node.id !== id) {
          break;
        }

        if (node.type === 'anchor') {
          searchId = node.parentId; 
          continue; 
        }

        if (node.type === 'message') {
          const data = node.data as MessageNodeData;

          console.log('data.contextText', data.contextText);
          
          // Skip the 'current' node's data because we are passing the 
          // new 'message' manually in the final array.
          if (node.id !== nodeId) {
            if (data.assistantMessage && data.assistantMessage !== 'Thinking...' && data.assistantMessage.trim()) {
              history.unshift({ role: 'assistant', content: data.assistantMessage });
            }
            if (data.userMessage || data.contextText) {
              history.unshift(
                { 
                  role: 'user', 
                  content: formatPrompt(data.userMessage || '', data.contextText) 
                }
              );
            }
          }
        }

        // Logic to move up the tree
        const incoming = currentEdges.find((e) => e.target === searchId);
        if (!incoming) break;

        const sourceNode = currentNodes.find(n => n.id === incoming.source);
        if (sourceNode?.type === 'anchor' && sourceNode.parentId) {
          searchId = sourceNode.parentId;
        } else {
          searchId = incoming.source;
        }
      }

      return history;
    };
  
    const currentNode = getNodes().find(n => n.id === nodeId);
    if (!currentNode) return;
    const currentNodeData = (currentNode.data as MessageNodeData);
    const currentContext = currentNodeData.contextText;

    console.log("DEBUG: currentNode Data", currentNode.id, currentNode.data);

    const history = currentNodeData.isIsolated ? [] : getHistory(nodeId);

    const messages = [
      ...history,
      { 
        role: 'user' as const, 
        content: formatPrompt(message, currentContext) 
      },
    ];

    console.log('messages',messages);

    try {
      const stream = await openai.chat.completions.create({
        model: 'grok-4',
        messages,
        stream: true,
        temperature: 0.7,
      })
      
      let fullResponse = ''
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || ''
        fullResponse += content
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId ? { ...node, data: { ...node.data, assistantMessage: fullResponse || 'Thinking...' } } : node
          )
        )
      }

      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, assistantMessage: fullResponse, streamFinished: true } } : node
        ) 
      )

      setPendingNodeId(nodeId);
    } catch (error: any) {
      console.error('Grok API error:', error)
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId ? {
            ...node, 
            data: { ...node.data, assistantMessage: `Error: ${error.message || 'Failed'}` },
          } : node
        )
      )
    }
  }, [getNodes, getEdges, setNodes])


  const onBranch = useCallback(
    (parentId: string, selectedText: string, isolation: boolean, relativePos: { x: number, y: number }) => {
      const currentNodes = getNodes();
      const parentNode = currentNodes.find(n => n.id === parentId);
      if (!parentNode) return;
      
      const anchorId = `anchor-${Date.now()}`;
      const newNodeId = `node-${Date.now()}`;
      
      const anchorNode: Node = {
        id: anchorId,
        type: 'anchor',
        // Position is relative to the parent because we set parentId
        position: { x: relativePos.x - 4, y: relativePos.y - 4 },
        parentId: parentId, // This makes the anchor move with the message box
        extent: 'parent' as const,   // Keeps it locked inside the parent container
        draggable: false,
        zIndex: 1001,       // Sits on top of the parent message
        data: {},
      };
      
      const newNode: MessageNodeType = {
        id: newNodeId,
        type: 'message',
        position: { 
          x: parentNode.position.x + relativePos.x + 85, // 60px to the right of the highlight
          y: parentNode.position.y + relativePos.y - 20  // Slightly higher for better alignment
        },
        zIndex: 1000,
        data: {
          contextText: selectedText,
          isIsolated: isolation,
          userMessage: '',
          assistantMessage: '',
          onSend,
          onBranch,
          onDelete
        },
      }
      
      setNodes((nds) => [...nds, anchorNode, newNode]);
      setEdges((eds) => [
        ...eds,
        {
          id: `e${anchorId}-${newNodeId}`,
          source: anchorId,
          target: newNodeId,
          targetHandle: 'input',
          style: { 
            stroke: '#0066ff', 
            strokeWidth: 1,
            opacity: 0.3 
          },
        },
      ]);
    },
    [onSend, onDelete, setNodes, setEdges, getNodes]
  )
  
  useEffect(() => {
    if (!pendingNodeId) return;

    const parentNode = nodes.find(n => n.id === pendingNodeId);
    
    // We wait for BOTH the stream to be finished AND the 'measured' property to exist
    if (parentNode?.data.streamFinished && parentNode.measured?.height) {
      const { x, y } = parentNode.position;
      const height = parentNode.measured.height;
      const spacing = 25;
      
      const newChildId = `node-${Date.now()}`;
      const newChildNode: MessageNodeType = {
        id: newChildId,
        type: 'message',
        position: { x, y: y + height + spacing },
        data: { 
          userMessage: '', 
          assistantMessage: '', 
          isIsolated: false,
          onSend,
          onBranch,
          onDelete
        },
      };
      
      setNodes((nds) => nds.concat(newChildNode));
      setEdges((eds) => eds.concat({
        id: `e${pendingNodeId}-${newChildId}`,
        source: pendingNodeId,
        target: newChildId,
        sourceHandle: 'bottom',
        targetHandle: 'top'
      }));
      
      setPendingNodeId(null); // Clear pending status
    }
  }, [nodes, pendingNodeId, onSend, onBranch, onDelete, setNodes, setEdges]);

  useEffect(() => {
    if (nodes.length === 0) {
      setNodes([
        {
          id: 'root',
          type: 'message',
          position: { x: 400, y: 200 },
          data: {
            userMessage: '',
            assistantMessage:
            'What are you curious about today?\n\nType your question or idea below and press Send (or Enter) to explore it with Grok.\n\nSelect text in a response → right-click to branch.',
            onSend,
            onBranch,
            onDelete
          },
        },
      ])
    }
  }, [setNodes, onSend, onBranch, onDelete])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      panOnScroll={true}
      zoomOnScroll={false}
      zoomActivationKeyCode="Meta"
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  )
}

// Main App component — only wraps with provider
export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ReactFlowProvider>
        <ReactFlowContent />
      </ReactFlowProvider>
    </div>
  )
}