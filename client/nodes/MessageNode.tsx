import { useCallback, useState, useRef, useEffect } from 'react'
import { Handle, Position } from 'reactflow'
import ReactMarkdown from 'react-markdown'

type MessageNodeData = {
  userMessage: string
  assistantMessage: string
  onSend: (message: string) => void
  onBranch: (text: string, withContext: boolean) => void
  parentId?: string
}

export default function MessageNode({ data, id }: { data: MessageNodeData; id: string }) {
  const [userMessage, setUserMessage] = useState(data.userMessage || '')
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleSend = useCallback(() => {
    if (userMessage.trim()) {
      data.onSend(userMessage.trim())
      setUserMessage('')
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
        y: e.clientY + 10, // Small offset below cursor
      })
    } else {
      setMenuPosition(null)
    }
  }, [])

    const createBranch = (withContext: boolean) => {
        const selectedText = window.getSelection()?.toString().trim() || ''
        if (selectedText) {
            data.onBranch(id, selectedText, withContext)  // ← Call parent callback with current node ID
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
      style={{
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        width: 340,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Input Port (left) */}
      <Handle type="target" position={Position.Left} id="input" style={{ top: '50%' }} />

      {/* User Input */}
      <div style={{ padding: '12px 16px 8px' }}>
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
              <div
                ref={menuRef}
                style={{
                  position: 'fixed',
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
                  onClick={() => createBranch(false)}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
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
                  onClick={() => createBranch(true)}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* Output Port (right) */}
      <Handle type="source" position={Position.Right} id="output" style={{ top: '50%' }} />
    </div>
  )
}