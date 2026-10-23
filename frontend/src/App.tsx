import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from './store/useStore'
import Sidebar from './components/Sidebar'
import Toolbar from './components/Toolbar'
import LoginModal from './components/LoginModal'
import CreateModal from './components/CreateModal'
import SentimentOverview from './components/SentimentOverview'
import StickyNoteCard from './components/StickyNote'
import { getWsUrl } from './utils'

export default function App() {
  // 1. 从 store 中完整解构需要的状态（必须包含 syncStatus 和 token）
  const {
    comments,
    showLogin,
    showCreate,
    setShowCreate,
    setUser,
    setToken,
    token, // 确保你的 store 里有 token 状态
    addComment,
    updateComment,
    setShowLogin,
    setWs,
    setSyncStatus,
    setOnlineUsers,
    syncStatus,
  } = useStore()

  const wsRef = useRef<WebSocket | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString('zh-CN'))

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleString('zh-CN')), 1000)
    return () => clearInterval(timer)
  }, [])

  // 2. WebSocket 连接逻辑
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const wsUrl = getWsUrl()
    const socket = new WebSocket(wsUrl)
    wsRef.current = socket
    setWs(socket)

    socket.onopen = () => {
      setSyncStatus('已连接')
      // 刚连上时，如果本地有 token，立即发送 AUTH
      const storedToken = localStorage.getItem('token')
      if (storedToken) {
        socket.send(JSON.stringify({ type: 'AUTH', payload: { token: storedToken } }))
      }
    }

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'NEW_COMMENT':
          addComment(msg.payload)
          break
        case 'COMMENT_MOVED':
          updateComment(msg.payload.id, { x: msg.payload.x, y: msg.payload.y })
          break
        case 'COMMENT_LIKED':
          updateComment(msg.payload.id, { likes: msg.payload.likes, liked_by_me: msg.payload.liked_by_me })
          break
        case 'presence:update':
          setOnlineUsers(msg.payload.users || [])
          break
        case 'PONG':
          break
        default:
          console.log('收到未处理的 WS 消息:', msg)
      }
    }

    socket.onclose = () => {
      setSyncStatus('断开，重连中...')
      setTimeout(() => connectWs(), 3000) // 3秒后自动重连
    }

    socket.onerror = () => {
      setSyncStatus('连接错误')
    }
  }, [setWs, setSyncStatus, addComment, updateComment, setOnlineUsers])

  // 3. 初始化加载与恢复登录状态
  useEffect(() => {
    connectWs()
    
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
    }

    return () => {
      wsRef.current?.close()
    }
  }, [connectWs, setToken, setUser])

  // 4. 监听 token 变化（非常重要）
  // 如果你在页面打开后才登录成功，需要立刻让 WS 知道你的身份
  useEffect(() => {
    if (token && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'AUTH', payload: { token } }))
    }
  }, [token])

  // 5. 心跳保活，防止被 CloudBase 网关断开
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING', payload: {} }))
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  // 6. 智能整理布局（按情绪分列）
  const handleOrganize = () => {
    if (!wsRef.current) return
    const bySentiment: Record<string, typeof comments> = { positive: [], negative: [], neutral: [] }
    
    comments.forEach((c: any) => {
      const s = c.sentiment || 'neutral'
      if (!bySentiment[s]) bySentiment[s] = []
      bySentiment[s].push(c)
    })

    let x = 100
    ;['positive', 'neutral', 'negative'].forEach((sent) => {
      const list = bySentiment[sent] || []
      let y = 100
      list.forEach((c: any) => {
        const newC = { ...c, x, y }
        updateComment(c.id, newC) // 本地更新
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // 广播给所有人
          wsRef.current.send(JSON.stringify({ type: 'MOVE_COMMENT', payload: { id: c.id, x, y } }))
        }
        y += 160
      })
      x += 300
    })
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主画布 */}
      <div
        className="flex-1 relative"
        style={{
          backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          backgroundColor: '#f9fafb',
        }}
      >
        {/* 顶部区域 */}
        <div className="absolute top-4 left-0 right-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-sm text-gray-600 font-medium">
            共反馈 <span className="text-gray-900 font-bold">{comments.length}</span> 条建议
          </div>
        </div>
        
        <div className="absolute top-4 right-6 flex items-center gap-4 text-xs text-gray-400 z-20">
          <span>☁️ {currentTime} {syncStatus}</span>
          <SentimentOverview />
        </div>

        {/* 贴纸卡片 */}
        {comments.map((comment) => (
          <StickyNoteCard key={comment.id} comment={comment} />
        ))}
      </div>

      {/* 底部工具栏 */}
      <Toolbar onCreate={() => setShowCreate(true)} onOrganize={handleOrganize} />

      {/* 登录和新建弹窗 */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
