import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState } from 'reactflow'
import { useEffect, useCallback } from 'react'
import MessageNode from './nodes/MessageNode.tsx'
import 'reactflow/dist/style.css'

const nodeTypes = { message: MessageNode }

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // The callback that creates new node + edge
  const onBranch = useCallback((parentId: string, selectedText: string, withContext: boolean) => {
    const parentNode = nodes.find(n => n.id === parentId)
    if (!parentNode) return

    const newNodeId = Date.now().toString()

    const newNode = {
      id: newNodeId,
      type: 'message',
      position: {
        x: parentNode.position.x + 460,
        y: parentNode.position.y + 300,  // Adjust as needed
      },
      data: {
        userMessage: withContext
          ? `Continuing from context:\n"${selectedText}"`
          : selectedText,
        assistantMessage: '',
        onBranch,  // Pass it down to the new node too!
      },
    }

    setNodes((nds) => nds.concat(newNode))

    setEdges((eds) => eds.concat({
      id: `e${parentId}-${newNodeId}`,
      source: parentId,
      target: newNodeId,
      sourceHandle: 'output',
      targetHandle: 'input',
    }))
  }, [nodes, setNodes, setEdges])

  // Initial invitation node
  useEffect(() => {
    if (nodes.length === 0) {
      setNodes([
        {
          id: 'root',
          type: 'message',
          position: { x: 400, y: 200 },
          data: {
            userMessage: '',
            assistantMessage: 'What are you curious about today?\n\nType your question or idea below and press Send (or Enter) to explore it with Grok.\n\nSelect text in a response → right-click to branch.',
            onBranch,  // Pass the callback
          },
        },
      ])
    }
  }, [nodes.length, setNodes, onBranch])

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
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
    </div>
  )
}

export default App