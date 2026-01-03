import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Edge
} from '@xyflow/react'
import { useEffect, useRef, useCallback, useState } from 'react'
import OpenAI from 'openai'
import MessageNode, { type MessageNodeType } from './nodes/MessageNode.tsx'
import '@xyflow/react/dist/style.css'
import ELK from 'elkjs/lib/elk.bundled.js'

const elk = new ELK()

const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.nodeNodeBetweenLayers': '120',
  'elk.layered.considerModelOrder': 'true',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
}

const nodeTypes = { message: MessageNode }

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_GROK_API_KEY,
  baseURL: 'https://api.x.ai/v1',
  dangerouslyAllowBrowser: true,
})

// Inner component — this is where hooks are allowed
function ReactFlowContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState<MessageNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);

  const onSendRef = useRef<(parentId: string, message: string) => void>()
  const onBranchRef = useRef<(parentId: string, selectedText: string, withContext: boolean) => void>()

  const triggerSend = useCallback((parentId: string, message: string) => {
    onSendRef.current?.(parentId, message)
  }, [])

  const triggerBranch = useCallback((parentId: string, selectedText: string, withContext: boolean) => {
    onBranchRef.current?.(parentId, selectedText, withContext)
  }, [])

  const onBranch = useCallback(
    (parentId: string, selectedText: string, withContext: boolean) => {
      const parentNode = nodes.find((n) => n.id === parentId)
      if (!parentNode) return

      const newNodeId = Date.now().toString()

      const newNode: MessageNodeType = {
        id: newNodeId,
        type: 'message',
        position: { x: 0, y: 0 },
        data: {
          userMessage: withContext
            ? `Continuing from context:\n"${selectedText}"`
            : selectedText,
          assistantMessage: '',
          onSend: triggerSend,
          onBranch: triggerBranch,
        },
      }

      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [
        ...eds,
        {
          id: `e${parentId}-${newNodeId}`,
          source: parentId,
          target: newNodeId,
        },
      ]);
    },
    [nodes, setNodes, setEdges, triggerSend, triggerBranch]
  )

  const onSend = useCallback(
    async (nodeId: string, message: string) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, assistantMessage: 'Thinking...' } }
            : node
        )
      )

      const getHistory = (id: string): { role: 'user' | 'assistant'; content: string }[] => {
        const history: { role: 'user' | 'assistant'; content: string }[] = []
        let current = id
        while (current) {
          const node = nodes.find((n) => n.id === current)
          if (!node) break
          const data = node.data
          if (data.assistantMessage && data.assistantMessage.trim() && data.assistantMessage !== 'Thinking...') {
            history.unshift({ role: 'assistant', content: data.assistantMessage })
          }
          if (data.userMessage?.trim()) {
            history.unshift({ role: 'user', content: data.userMessage })
          }
          const incoming = edges.find((e) => e.target === current)
          current = incoming?.source ?? ''
        }
        return history
      }

      const messages: any[] = [  // Temporary any to bypass TS — safe here
        ...getHistory(nodeId),
        { role: 'user' as const, content: message },
      ]

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
              node.id === nodeId
                ? { ...node, data: { ...node.data, assistantMessage: fullResponse || 'Thinking...' } }
                : node
            )
          )
        }

        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, assistantMessage: fullResponse, streamFinished: true } }
              : node
          )
        )

        setPendingNodeId(nodeId);
      } catch (error: any) {
        console.error('Grok API error:', error)
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  data: { ...node.data, assistantMessage: `Error: ${error.message || 'Failed'}` },
                }
              : node
          )
        )
      }
    },
    [setNodes]
  )

  useEffect(() => {
    if (!pendingNodeId) return;

    const parentNode = nodes.find(n => n.id === pendingNodeId);
    
    // We wait for BOTH the stream to be finished AND the 'measured' property to exist
    if (parentNode?.data.streamFinished && parentNode.measured?.height) {
      const { x, y } = parentNode.position;
      const height = parentNode.measured.height;
      const spacing = 50;

      const newChildId = `node-${Date.now()}`;
      const newChildNode: MessageNodeType = {
        id: newChildId,
        type: 'message',
        position: { x, y: y + height + spacing },
        data: { 
            userMessage: '', 
            assistantMessage: '', 
            onSend: triggerSend, // Use your refs here
            onBranch: triggerBranch
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
  }, [nodes, pendingNodeId, setNodes, setEdges]);

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
            onSend: triggerSend,
            onBranch: triggerBranch,
          },
        },
      ])
    }
  }, [setNodes, triggerSend, triggerBranch])

  useEffect(() => {
    onSendRef.current = onSend
  }, [onSend])

  useEffect(() => {
    onBranchRef.current = onBranch
  }, [onBranch])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
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