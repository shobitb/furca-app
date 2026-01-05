import { useCallback, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom';
import { Handle, Position, useInternalNode, NodeProps, useUpdateNodeInternals, useReactFlow } from '@xyflow/react'
import { type Node } from '@xyflow/react';
import ReactMarkdown from 'react-markdown'

export type MessageNodeData = {
    userMessage: string
    assistantMessage: string
    contextText?: string,
    isIsolated: boolean,
    onSend: (parentId: string, message: string) => void
    onBranch: (id: string, text: string, isolation: boolean, pos: { x: number; y: number }) => void
    streamFinished?: boolean
    onDelete?: (id: string) => void;
    parentId?: string
}

export type MessageNodeType = Node<MessageNodeData, 'message'>;

export default function MessageNode({ data, id }: NodeProps<MessageNodeType>) {
    const [userMessage, setUserMessage] = useState(data.userMessage || '')
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
    
    const nodeRef = useRef<HTMLDivElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const { screenToFlowPosition } = useReactFlow();
    
    const internalNode = useInternalNode(id);
    
    const updateNodeInternals = useUpdateNodeInternals();
    
    useEffect(() => {
        updateNodeInternals(id);
    }, [data.assistantMessage, id, updateNodeInternals]);
    
    const handleSend = useCallback(() => {
        if (userMessage.trim()) {
            data.onSend(id, userMessage.trim())
        }
    }, [userMessage, data.onSend])
    
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }, [handleSend])
    
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        
        const selection = window.getSelection()
        const selectedText = selection?.toString().trim()
        
        if (selectedText) {
            setMenuPosition({
                x: e.clientX,
                y: e.clientY
            })
        } else {
            setMenuPosition(null)
        }
    }, [])
    
    const createBranch = (isolation: boolean) => {
        const selected = window.getSelection();
        if (!selected || selected.rangeCount === 0 || !nodeRef.current || !internalNode) return;
        const range = selected?.getRangeAt(0);
        const selectedText = selected?.toString().trim() || ''
        if (selectedText) {
            // Calculate position relative to the node container
            const textRect = range.getBoundingClientRect();

            const screenCenter = {
                x: textRect.left + textRect.width / 2,
                y: textRect.top + textRect.height / 2,
            };
            const flowPos = screenToFlowPosition(screenCenter);
            const relativePos = {
                x: flowPos.x - internalNode.internals.positionAbsolute.x,
                y: flowPos.y - internalNode.internals.positionAbsolute.y,
            };
            
            // Notify the App to create the node and edge
            data.onBranch(id, selectedText, isolation, relativePos);
        }
        setMenuPosition(null)
    }
    
    // Close menu on outside click
    useEffect(() => {
        if (!menuPosition) return
        
        const handleClick = () => setMenuPosition(null)
        document.addEventListener('click', handleClick)
        return () => document.removeEventListener('click', handleClick)
    }, [menuPosition])
    
    return (
        <div
        ref={nodeRef}
        style={{
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            width: 680,
            fontFamily: 'system-ui, sans-serif',
        }}
        >
        {/* 1. Delete Button (Hidden for Root) */}
        {id !== 'root' && (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (data.onDelete) data.onDelete(id);
                }}
                style={{
                    position: 'absolute',
                    top: '-12px',
                    right: '-12px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    color: 'white',
                    border: '2px solid white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    zIndex: 100
                }}
            >
            ✕
            </button>
        )}
        {/* Input Port (left) */}
        <Handle type="target" position={Position.Top} id="top" style={{ left: '50%' }} />
        <Handle type="target" position={Position.Left} id="input" style={{ top: '50%' }} />
        
        {/* User Input */}
        <div style={{ padding: '12px 16px 8px' }}>
            {data.contextText && (
                <div style={{
                    background: '#f0f0f0',
                    borderLeft: '4px solid #007bff',
                    padding: '8px',
                    marginBottom: '8px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    color: '#555',
                    maxHeight: '60px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    position: 'relative'
                }}>
                    <strong style={{ display: 'block', fontSize: '0.6rem', color: '#007bff' }}>
                        CONTEXT
                    </strong>
                    "{data.contextText}"
                </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    type="text"
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    style={{
                        flex: 1,
                        padding: '10px 12px',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        fontSize: '14px',
                    }}
                />
                <button
                    onClick={handleSend}
                    style={{
                        padding: '10px 16px',
                        background: '#0066ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                    }}
                >
                    Send
                </button>
            </div>
        </div>
        
        {/* Assistant Message */}
        {data.assistantMessage && (
            <div style={{ padding: '0 16px 16px' }}>
            <div
            onContextMenu={handleContextMenu}
            className="nodrag"
            style={{
                background: '#f8f9fa',
                padding: '14px 16px',
                borderRadius: '10px',
                lineHeight: '1.5',
                fontSize: '14px',
                userSelect: 'text',
                cursor: 'text',
                position: 'relative',
            }}
            >
            <ReactMarkdown>{data.assistantMessage}</ReactMarkdown>
            
            {/* Context Menu */}
            {menuPosition && (
                createPortal(<div
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        whiteSpace: 'nowrap',
                        left: menuPosition.x,
                        top: menuPosition.y,
                        background: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        zIndex: 10000,
                        padding: '4px 0',
                        fontSize: '13px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    >
                    <button
                    onClick={() => createBranch(true)}
                    style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 12px',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                    Branch with selection only
                    </button>
                    <button
                    onClick={() => createBranch(false)}
                    style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 12px',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                    Branch with selection and context
                    </button>
                    </div>,
                    document.body)
                )}
                </div>
                </div>
            )}
            
            {/* Output Port (right) */}
            <Handle type="source" position={Position.Right} id="output" style={{ top: '50%' }} />
            <Handle type="source" position={Position.Bottom} id="bottom" style={{ left: '50%' }} />
            </div>
        )
    }