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
  const [canvasHeight, setCanvasHeight] = useState(2000)
  const [isOrganized, setIsOrganized] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleString('zh-CN')), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (comments.length === 0) return
    const maxY = Math.max(...comments.map(c => c.y))
    setCanvasHeight(Math.max(1000, maxY + 400))
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
      if (storedToken) socket.send(JSON.stringify({ type: 'AUTH', payload: { token: storedToken } }))
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
    
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    }
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

  // ⚠️ 核心修复：布局切换只在本地视图生效，不保存到数据库
  const handleToggleLayout = () => {
    if (isOrganized) {
      // -- 错落有致的打乱 --
      const cols = 3 
      const colWidth = 320 
      const startX = 80 
      const startY = 80 
      
      comments.forEach((c, index) => {
        const col = index % cols 
        const row = Math.floor(index / cols) 
        
        const baseX = startX + col * colWidth
        const baseY = startY + row * 200 + (col % 2 === 0 ? 0 : 60) 
        
        const offsetX = (Math.random() - 0.5) * 40
        const offsetY = (Math.random() - 0.5) * 40
        
        const newX = Math.max(20, baseX + offsetX)
        const newY = Math.max(20, baseY + offsetY)

        // ⚠️ 只更新 Zustand 内存数据，不调用 ws.send
        updateComment(c.id, { x: newX, y: newY })
      })
    } else {
      // -- 智能整理 --
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
          
          // ⚠️ 只更新 Zustand 内存数据，不调用 ws.send
          updateComment(c.id, { x: newX, y: newY })
          
          startY += 180
        })
        startX += 300 
      })
    }
    setIsOrganized(!isOrganized)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden relative bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 relative overflow-y-auto overflow-x-hidden">
        <div 
          className="relative w-full transition-all duration-700 ease-in-out"
          style={{
            height: canvasHeight,
            backgroundImage: 'radial-gradient(#d1d5db 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div className="fixed top-6 left-0 right-0 flex items-center justify-center pointer-events-none z-20">
            <div className="text-sm text-gray-500 font-medium bg-white/90 backdrop-blur px-6 py-2 rounded-full shadow-sm">
              共反馈 <span className="text-gray-900 font-bold text-lg mx-1">{comments.length}</span> 条建议
            </div>
          </div>
          
          <div className="fixed top-6 right-8 flex items-center gap-4 text-xs text-gray-400 z-20 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-sm">
            <span>☁️ {currentTime} {syncStatus}</span>
            <SentimentOverview />
          </div>

          {comments.map((comment) => (
            <StickyNoteCard key={comment.id} comment={comment} />
          ))}
        </div>
      </div>

      <Toolbar 
        onCreate={() => setShowCreate(true)} 
        onToggleLayout={handleToggleLayout} 
        isOrganized={isOrganized} 
      />

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
