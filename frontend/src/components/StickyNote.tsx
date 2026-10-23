import { useState, useEffect } from 'react'
import { Rnd } from 'react-rnd'
import { useStore, Comment } from '../store/useStore'

export default function StickyNoteCard({ comment }: { comment: Comment }) {
  const { user, ws, updateComment } = useStore()
  const isOwner = user?.username === comment.author_name
  
  const [localPos, setLocalPos] = useState({ x: comment.x, y: comment.y })

  useEffect(() => {
    setLocalPos({ x: comment.x, y: comment.y })
  }, [comment.x, comment.y])

  const handleDrag = (_e: any, d: { x: number; y: number }) => setLocalPos({ x: d.x, y: d.y })
  const handleDragStop = (_e: any, d: { x: number; y: number }) => {
    if (!isOwner || !ws) return
    ws.send(JSON.stringify({ type: 'MOVE_COMMENT', payload: { id: comment.id, x: d.x, y: d.y } }))
    updateComment(comment.id, { x: d.x, y: d.y })
  }
  const handleLike = () => {
    if (!ws) return
    ws.send(JSON.stringify({ type: 'LIKE_COMMENT', payload: { id: comment.id } }))
  }

  return (
    <Rnd
      bounds="parent"
      position={localPos}
      size={{ width: 260, height: 'auto' }}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      enableResizing={false}
      disableDragging={!isOwner}
      style={{ zIndex: 10 }}
    >
      <div
        className="relative p-5 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 group"
        style={{
          width: 260,
          minHeight: 130,
          backgroundColor: comment.color || '#fef3c7',
          transform: `rotate(${comment.rotate || 0}deg)`,
        }}
      >
        {/* 精美胶带 */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-white/60 backdrop-blur-sm rotate-[-3deg] shadow-sm border border-white/40 z-0" />
        
        {/* 内容 */}
        <p className="relative text-sm text-gray-800 whitespace-pre-wrap mb-4 leading-relaxed font-medium z-10">
          {comment.content}
        </p>
        
        {/* 底部信息 */}
        <div className="flex items-center justify-between mt-auto relative z-10">
          <div className="flex items-center gap-2">
            <img
              src={comment.author_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.author_name}`}
              className="w-7 h-7 rounded-full bg-white/50 shadow-sm"
              alt="avatar"
            />
            <div className="flex flex-col">
              <span className="text-xs text-gray-700 font-bold">{comment.author_name}</span>
              <span className="text-[10px] text-gray-500">
                {new Date(comment.created_at).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleLike}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-pink-500 transition-colors bg-white/40 px-2 py-1 rounded-full"
          >
            <svg
              className="w-4 h-4 transition-colors"
              fill={comment.liked_by_me ? '#ec4899' : 'none'}
              stroke={comment.liked_by_me ? '#ec4899' : 'currentColor'}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {comment.likes || 0}
          </button>
        </div>
      </div>
    </Rnd>
  )
}
