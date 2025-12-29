import { ModelMessage } from 'ai'
import { useCallback } from 'react'
import { T, TldrawUiButton, TldrawUiButtonIcon, TldrawUiInput, useEditor, createShapeId } from 'tldraw'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { HandleIcon } from '../../components/icons/HandleIcon'
import { SendIcon } from '../../components/icons/SendIcon'
import { NODE_HEIGHT_PX, NODE_WIDTH_PX } from '../../constants'
import { getAllConnectedNodes, getNodePorts } from '../nodePorts'
import { createOrUpdateConnectionBinding } from '../../connection/ConnectionBindingUtil.tsx'
import { getConnectionTerminals } from '../../connection/ConnectionShapeUtil.tsx'
import { getNodeBodyHeightPx } from '../nodeTypes'
import {
    NodeComponentProps,
    NodeDefinition,
    shapeInputPort,
    shapeOutputPort,
    updateNode,
} from './shared'

/**
 * This node is a message from the user.
 */
export type MessageNode = T.TypeOf<typeof MessageNode>
export const MessageNode = T.object({
    type: T.literal('message'),
    userMessage: T.string,
    assistantMessage: T.string,
})

export class MessageNodeDefinition extends NodeDefinition<MessageNode> {
    static type = 'message'
    static validator = MessageNode
    title = 'Message'
    heading = 'Message'
    icon = (<SendIcon />)
    getDefault(): MessageNode {
        return {
            type: 'message',
            userMessage: 'hello',
            assistantMessage: '',
        }
    }
    getBodyWidthPx(_shape: NodeShape, _node: MessageNode): number {
        return NODE_WIDTH_PX
    }
    getBodyHeightPx(_shape: NodeShape, _node: MessageNode): number {
        const assistantMessage = _node.assistantMessage.trim()
        if (assistantMessage === '') return NODE_HEIGHT_PX
        const size = this.editor.textMeasure.measureText(assistantMessage, {
            fontFamily: 'Inter',
            fontSize: 12,
            fontWeight: '500',
            fontStyle: 'normal',
            maxWidth: NODE_WIDTH_PX,
            lineHeight: 1.3,
            padding: '12px',
        })
        return NODE_HEIGHT_PX + size.h
    }
    getPorts(shape: NodeShape, node: MessageNode) {
        return {
            input: shapeInputPort,
            output: {
                ...shapeOutputPort,
                y: this.getBodyHeightPx(shape, node),
            },
        }
    }

    Component = MessageNodeComponent
}

function MessageNodeComponent({ node, shape }: NodeComponentProps<MessageNode>) {
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const editor = useEditor()

    const handleSend = useCallback(() => {
        // 1. gather up parents and create message history
        // 2. create prompt
        // 3. send prompt to ai
        // 4. update node with assistant message

        const messages: ModelMessage[] = []

        const connectedNodeShapes = getAllConnectedNodes(editor, shape, 'end')

        for (const connectedShape of connectedNodeShapes) {
            const node = editor.getShape(connectedShape)

            if (!node) continue
            if (!editor.isShapeOfType<NodeShape>(node, 'node')) continue
            if (node.props.node.type !== 'message') continue

            if (node.props.node.assistantMessage && connectedShape !== shape.id) {
                messages.push({
                    role: 'assistant',
                    content: node.props.node.assistantMessage ?? '',
                })
            }

            messages.push({
                role: 'user',
                content: node.props.node.userMessage ?? '',
            })
        }

        messages.reverse()

        console.log('messages', JSON.stringify(messages))

        // clear any previous assistant message before starting 
        updateNode<MessageNode>(editor, shape, (node) => ({
            ...node,
            assistantMessage: '...',
        }))

        // stream the response and append as chunks arrive
        ;(async () => {
            try {
                const response = await fetch('/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(messages),
                })

                if (!response.body) return

                const reader = response.body.getReader()
                const decoder = new TextDecoder()
                let accumulatedText = ''

                while (true) {
                    const { value, done } = await reader.read()
                    if (done) break
                    const chunk = decoder.decode(value, { stream: true })
                    // Some environments may send SSE-style lines; extract data if so, else use raw chunk
                    const maybeSse = chunk
                        .split('\n')
                        .filter((line) => line.startsWith('data:'))
                        .map((line) => line.replace(/^data:\s?/, ''))
                        .join('')
                    accumulatedText += maybeSse || chunk
                    updateNode<MessageNode>(editor, shape, (node) => ({
                        ...node,
                        assistantMessage: accumulatedText,
                    }))
                }
            } catch (e) {
                console.error(e)
            }
        })()
    }, [editor, shape])

    const handleMessageChange = useCallback(
        (value: string) => {
            updateNode<MessageNode>(editor, shape, (node) => ({
                ...node,
                userMessage: value,
            }))
        },
        [editor, shape]
    )

    const createBranch = useCallback((withContext: boolean) => {
      const parentHeight = getNodeBodyHeightPx(editor, shape)
      const selection = window.getSelection()
      const selectedText = selection?.toString().trim() || ''

      if (!selectedText) return

      const zoom = editor.getZoomLevel()

      const offsetX = 0
      const offsetY = 28

      const newNodeId = createShapeId();
      editor.createShape({
        id: newNodeId,
        type: 'node',
        x: shape.x + offsetX,
        y: shape.y + parentHeight + offsetY,
        props: {
          node: {
            type: 'message',
            userMessage: withContext
              ? `Continuing from previous context:\n"${selectedText}"`
              : selectedText,
            assistantMessage: '',
          },
        },
      })

    const connectionId = createShapeId()
    editor.createShape({
        id: connectionId,
        type: 'connection',
        props: {
          start: { x: 0, y: 0 },
          end: { x: 100, y: 100 },
        },
      })

      // Bind start terminal to parent's output port
      createOrUpdateConnectionBinding(editor, connectionId, shape, {
        portId: 'output',
        terminal: 'start',
      })


      // Bind end terminal to child's input port
      createOrUpdateConnectionBinding(editor, connectionId, newNodeId, {
        portId: 'input',
        terminal: 'end',
      })


      // Clear menu
      setMenuPosition(null)

      // Optional: Focus the new input field after small delay
      setTimeout(() => {
        const input = document.querySelector(`[data-shape-id="${newNodeId}"] input`) as HTMLInputElement
        input?.focus()
        input?.select()
      }, 100)
    }, [editor, shape])

    useEffect(() => {
      if (!menuPosition) return

      const handleOutsideClick = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setMenuPosition(null)
        }
      }

      document.addEventListener('pointerdown', handleOutsideClick)

      return () => {
        document.removeEventListener('pointerdown', handleOutsideClick)
      }
    }, [menuPosition])

    return (
        <>
            <div
                style={{
                    pointerEvents: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <div
                        style={{
                            height: '100%',
                            width: 32,
                            paddingLeft: 4,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'grab',
                        }}
                    >
                        <TldrawUiButtonIcon icon={<HandleIcon />} />
                    </div>
                    <div
                        style={{ padding: '4px 0px 0px 4px', flexGrow: 2 }}
                        onPointerDown={editor.markEventAsHandled}
                    >
                        <div style={{ padding: '0px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                            <TldrawUiInput
                                value={node.userMessage}
                                onValueChange={handleMessageChange}
                                onComplete={handleSend}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0px 0px' }}>
                        <TldrawUiButton
                            type="primary"
                            onClick={handleSend}
                            onPointerDown={editor.markEventAsHandled}
                        >
                            <TldrawUiButtonIcon icon={<SendIcon />} />
                        </TldrawUiButton>
                    </div>
                </div>
                {node.assistantMessage && (
                    <div style={{ padding: 4 }}>
                        <div
                            style={{
                                position: 'relative',
                                padding: 8,
                                lineHeight: '1.3',
                                fontSize: '12px',
                                borderRadius: 6,
                                border: '1px solid #e2e8f0',
                                fontWeight: '500',
                                fontFamily: 'Inter',
                                overflowWrap: 'normal',
                                whiteSpace: 'pre-wrap',
                                userSelect: 'text',
                                cursor: 'text',
                                pointerEvents: 'auto',
                            }}
                            onPointerDown={editor.markEventAsHandled}
                            onContextMenu={(e) => {
                                e.preventDefault()
                                e.stopPropagation()

                                const selection = window.getSelection()
                                const selectedText = selection?.toString().trim()

                                const range = selection.getRangeAt(0)
                                const rect = range.getBoundingClientRect()

                                if (selectedText && selectedText.length > 0) {
                                  // Convert mouse position to canvas coordinates
                                  setMenuPosition({
                                    x: e.clientX,
                                    y: e.clientY,
                                  })
                                } else {
                                    setMenuPosition(null)
                                }
                              }
                            }
                        >
                            {node.assistantMessage}
                            {menuPosition &&
                                  createPortal(
                                    <div
                                      ref={menuRef}
                                      style={{
                                        position: 'fixed',
                                        left: menuPosition.x,
                                        top: menuPosition.y,
                                        background: 'white',
                                        border: '1px solid #ccc',
                                        borderRadius: '6px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        zIndex: 999999, // higher than tldraw layers
                                        padding: '4px 0',
                                        fontSize: '13px',
                                      }}
                                      onPointerDown={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        style={{
                                          display: 'block',
                                          width: '100%',
                                          padding: '8px 16px',
                                          textAlign: 'left',
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                        }}
                                        onClick={() => createBranch(false)}
                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                      >
                                        Branch from selection
                                      </button>

                                      <button
                                        style={{
                                          display: 'block',
                                          width: '100%',
                                          padding: '8px 16px',
                                          textAlign: 'left',
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                        }}
                                        onClick={() => createBranch(true)}
                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                      >
                                        Branch with context
                                      </button>
                                    </div>,
                                    document.body
                                  )}
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
