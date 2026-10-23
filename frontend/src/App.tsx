import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from './store/useStore'
import Sidebar from './components/Sidebar'
import Toolbar from './components/Toolbar'
import LoginModal from './components/LoginModal'
import CreateModal from './components/CreateModal'
import SentimentOverview from './components/SentimentOverview'
import StickyNoteCard from './components/StickyNote'
import { getWsUrl, API_BASE } from './utils'

export default function App() {
  const {
    comments, showLogin, showCreate, setShowCreate, setUser, setToken, token,
    addComment, updateComment, setShowLogin, setWs, setSyncStatus, setOnlineUsers,
    syncStatus, setComments,
  } = useStore()

  const wsRef = useRef<WebSocket | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString('zh-CN'))

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleString('zh-CN')), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/comments`)
        if (res.ok) {
          const data = await res.json()
          setComments(data.comments || data || [])
        }
      } catch (e) {
        console.error('获取历史评论失败', e)
      }
    }
    fetchHistory()
  }, [setComments])

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const wsUrl = getWsUrl()
    const socket = new WebSocket(wsUrl)
    wsRef.current = socket
    setWs(socket)

    socket.onopen = () => {
      setSyncStatus('已连接')
      const storedToken = localStorage.getItem('token')
      if (storedToken) {
        socket.send(JSON.stringify({ type: 'AUTH', payload: { token: storedToken } }))
      }
    }

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'NEW_COMMENT': addComment(msg.payload); break
        case 'COMMENT_MOVED': updateComment(msg.payload.id, { x: msg.payload.x, y: msg.payload.y }); break
        case 'COMMENT_LIKED': updateComment(msg.payload.id, { likes: msg.payload.likes, liked_by_me: msg.payload.liked_by_me }); break
        case 'presence:update': setOnlineUsers(msg.payload.users || []); break
      }
    }

    socket.onclose = () => {
      setSyncStatus('断开，重连中...')
      setTimeout(() => connectWs(), 3000)
    }

    socket.onerror = () => setSyncStatus('连接错误')
  }, [setWs, setSyncStatus, addComment, updateComment, setOnlineUsers])

  useEffect(() => {
    connectWs()
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
    }
    return () => wsRef.current?.close()
  }, [connectWs, setToken, setUser])

  useEffect(() => {
    if (token && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'AUTH', payload: { token } }))
    }
  }, [token])

  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING', payload: {} }))
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleOrganize = () => {
    // ⚠️ 去掉了 if (!wsRef.current) return，即使没连上也能本地整理
    const bySentiment: Record<string, typeof comments> = { positive: [], negative: [], neutral: [] }
    
    comments.forEach((c: any) => {
      const s = c.sentiment || 'neutral'
      if (!bySentiment[s]) bySentiment[s] = []
      bySentiment[s].push(c)
    })

    let startX = 80
    ;['positive', 'neutral', 'negative'].forEach((sent) => {
      const list = bySentiment[sent] || []
      let startY = 80
      list.forEach((c: any) => {
        const newX = startX
        const newY = startY
        updateComment(c.id, { x: newX, y: newY })
        
        // 如果连着 WS，就广播给别人
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'MOVE_COMMENT', payload: { id: c.id, x: newX, y: newY } }))
        }
        startY += 180 // 每张卡片向下的间距
      })
      startX += 300 // 每列的横向间距
    })
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      <Sidebar />
      
      <div
        className="flex-1 relative overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          backgroundColor: '#f9fafb',
        }}
      >
        <div className="absolute top-4 left-0 right-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-sm text-gray-600 font-medium">
            共反馈 <span className="text-gray-900 font-bold">{comments.length}</span> 条建议
          </div>
        </div>
        
        <div className="absolute top-4 right-6 flex items-center gap-4 text-xs text-gray-400 z-20">
          <span>☁️ {currentTime} {syncStatus}</span>
          <SentimentOverview />
        </div>

        {comments.map((comment) => (
          <StickyNoteCard key={comment.id} comment={comment} />
        ))}
      </div>

      <Toolbar onCreate={() => setShowCreate(true)} onOrganize={handleOrganize} />

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
