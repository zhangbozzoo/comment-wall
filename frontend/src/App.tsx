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
  // 动态计算画布高度，确保向下滚动能看到所有卡片
  const [canvasHeight, setCanvasHeight] = useState(2000)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleString('zh-CN')), 1000)
    return () => clearInterval(timer)
  }, [])

  // 当评论位置更新时，动态调整底部高度，支持向下无限滚动
  useEffect(() => {
    if (comments.length === 0) return
    const maxY = Math.max(...comments.map(c => c.y))
    setCanvasHeight(Math.max(1000, maxY + 400)) // 底部预留空间
  }, [comments])

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

  // ⚠️ 功能 1：打乱分布（聚拢在中心区域，允许重叠）
  const handleShuffle = () => {
    const centerX = window.innerWidth / 2 - 300
    const centerY = window.innerHeight / 2 - 200
    
    comments.forEach((c, index) => {
      // 基于中心点小范围随机，让卡片聚拢且产生自然重叠
      const offsetX = (Math.random() - 0.5) * 400
      const offsetY = (Math.random() - 0.5) * 300
      const newX = Math.max(50, centerX + offsetX)
      const newY = Math.max(50, centerY + offsetY)

      updateComment(c.id, { x: newX, y: newY })
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'MOVE_COMMENT', payload: { id: c.id, x: newX, y: newY } }))
      }
    })
  }

  // ⚠️ 功能 2：智能整理（按情绪分列，自动向下方延伸支持滚动）
  const handleOrganize = () => {
    const bySentiment: Record<string, typeof comments> = { positive: [], negative: [], neutral: [] }
    comments.forEach((c: any) => {
      const s = c.sentiment || 'neutral'
      if (!bySentiment[s]) bySentiment[s] = []
      bySentiment[s].push(c)
    })

    let startX = 100
    ;['positive', 'neutral', 'negative'].forEach((sent) => {
      const list = bySentiment[sent] || []
      let startY = 100
      list.forEach((c: any) => {
        const newX = startX
        const newY = startY
        updateComment(c.id, { x: newX, y: newY })
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'MOVE_COMMENT', payload: { id: c.id, x: newX, y: newY } }))
        }
        startY += 180 // 不断向下排，配合外层的 overflow-y-auto 自动出现滚动条
      })
      startX += 300 
    })
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      <Sidebar />
      
      {/* ⚠️ 核心改动：改为 overflow-y-auto 允许垂直滚动，overflow-x-hidden 防止横向滚动破坏布局 */}
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden bg-[#f9fafb]">
        
        {/* 内部巨大画布容器 */}
        <div 
          className="relative w-full"
          style={{
            height: canvasHeight,
            backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          <div className="fixed top-4 left-0 right-0 flex items-center justify-center pointer-events-none z-20">
            <div className="text-sm text-gray-600 font-medium bg-white/80 backdrop-blur px-4 py-1 rounded-full shadow-sm">
              共反馈 <span className="text-gray-900 font-bold">{comments.length}</span> 条建议
            </div>
          </div>
          
          <div className="fixed top-4 right-6 flex items-center gap-4 text-xs text-gray-400 z-20 bg-white/80 backdrop-blur px-3 py-1 rounded-full shadow-sm">
            <span>☁️ {currentTime} {syncStatus}</span>
            <SentimentOverview />
          </div>

          {comments.map((comment) => (
            <StickyNoteCard key={comment.id} comment={comment} />
          ))}
        </div>
      </div>

      {/* 传入打乱功能 */}
      <Toolbar onCreate={() => setShowCreate(true)} onOrganize={handleOrganize} onShuffle={handleShuffle} />

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
