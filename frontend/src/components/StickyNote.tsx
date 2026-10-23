import { useState, useEffect } from 'react'
import { Rnd } from 'react-rnd'
import { useStore, Comment } from '../store/useStore'

export default function StickyNoteCard({ comment }: { comment: Comment }) {
  const { user, ws, updateComment } = useStore()
  const isOwner = user?.username === comment.author_name
  
  // 使用本地状态控制位置，确保排列时能更新，拖拽时不卡顿
  const [localPos, setLocalPos] = useState({ x: comment.x, y: comment.y })

  // 当外部数据（比如智能整理）更新时，同步本地位置
  useEffect(() => {
    setLocalPos({ x: comment.x, y: comment.y })
  }, [comment.x, comment.y])

  const handleDrag = (_e: any, d: { x: number; y: number }) => {
    setLocalPos({ x: d.x, y: d.y })
  }

  const handleDragStop = (_e: any, d: { x: number; y: number }) => {
    if (!isOwner || !ws) return
    ws.send(
      JSON.stringify({
        type: 'MOVE_COMMENT',
        payload: { id: comment.id, x: d.x, y: d.y },
      })
    )
    updateComment(comment.id, { x: d.x, y: d.y })
  }

  const handleLike = () => {
    if (!ws) return
    ws.send(
      JSON.stringify({
        type: 'LIKE_COMMENT',
        payload: { id: comment.id },
      })
    )
  }

  return (
    <Rnd
      bounds="parent" // ⚠️ 限制拖出画布
      position={localPos} // ⚠️ 受控模式，让智能整理生效
      size={{ width: 260, height: 'auto' }}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      enableResizing={false}
      disableDragging={!isOwner}
      style={{ zIndex: 10 }}
    >
      <div
        className="relative p-4 shadow-md hover:shadow-lg transition-shadow"
        style={{
          width: 260,
          minHeight: 120,
          backgroundColor: comment.color || '#fef3c7',
          transform: `rotate(${comment.rotate || 0}deg)`,
          borderRadius: 2,
        }}
      >
        <div
          className="absolute -top-2 left-3 w-12 h-6 bg-white/80 rotate-[-12deg] shadow-sm"
          style={{ borderRadius: 1 }}
        />
        
        <p className="text-sm text-gray-800 whitespace-pre-wrap mb-3 leading-relaxed">
          {comment.content}
        </p>
        
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <img
              src={
                comment.author_avatar ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.author_name}`
              }
              className="w-6 h-6 rounded-full"
              alt="avatar"
            />
            <span className="text-xs text-gray-500">{comment.author_name}</span>
            <span className="text-xs text-gray-400">
              {new Date(comment.created_at).toLocaleDateString()}
            </span>
          </div>
          
          <button
            onClick={handleLike}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors"
          >
            <svg
              className="w-4 h-4 transition-colors"
              fill={comment.liked_by_me ? '#ef4444' : 'none'}
              stroke={comment.liked_by_me ? '#ef4444' : 'currentColor'}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            {comment.likes || 0}
          </button>
        </div>
      </div>
    </Rnd>
  )
}
