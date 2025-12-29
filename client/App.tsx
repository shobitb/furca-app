import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'

import { ConnectionBindingUtil } from './connection/ConnectionBindingUtil.tsx'
import { ConnectionShapeUtil } from './connection/ConnectionShapeUtil.tsx'
import { NodeShapeUtil } from './nodes/NodeShapeUtil.tsx'
import { getNodeDefinition } from './nodes/nodeTypes'
import { PointingPort } from './ports/PointingPort.tsx'

// Only the essential custom pieces
const shapeUtils = [NodeShapeUtil, ConnectionShapeUtil]
const bindingUtils = [ConnectionBindingUtil]

function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        // persistenceKey="grok-playground"
        shapeUtils={shapeUtils}
        bindingUtils={bindingUtils}
        // Hide all default UI — pure canvas
        hideUi
        onMount={(editor) => {
          // Optional: expose for debugging
          ;(window as any).editor = editor

          editor.getStateDescendant('select')!.addChild(PointingPort)

          // If canvas is empty, create one centered invitation node
          const shapes = editor.getCurrentPageShapes()
          if (shapes.length > 0) {
            editor.deleteShapes(shapes)
          }
          if (shapes.length === 0 || !shapes.some((s) => s.type === 'node')) {
            const viewport = editor.getViewportPageBounds()
            const centerX = viewport.width / 2 - 150  // rough center, adjust if needed
            const centerY = viewport.height / 2 - 100


            editor.createShape({
              type: 'node',
              x: centerX,
              y: centerY,
              props: {
                node: {
                  type: 'message',
                  userMessage: '',  // Empty input — user types here
                  assistantMessage:
                    'What are you curious about today?\n\n' +
                    'Type your question or idea below and press Send (or Enter) to explore it with Grok.\n\n' +
                    'Select any text in a response and branch from a port to dive deeper.',
                },
              },
            })
          }
        }}
      />
    </div>
  )
}

export default App