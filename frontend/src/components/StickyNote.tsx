import { useState, useEffect, useRef } from 'react'
import { Rnd } from 'react-rnd'
import { useStore, Comment } from '../store/useStore'

export default function StickyNoteCard({ comment }: { comment: Comment }) {
  const { user, ws, updateComment } = useStore()
  const isOwner = user?.username === comment.author_name
  
  const [localPos, setLocalPos] = useState({ x: comment.x, y: comment.y })
  
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setLocalPos({ x: comment.x, y: comment.y })
  }, [comment.x, comment.y])

  useEffect(() => {
    if (!isEditing) {
      setEditContent(comment.content)
    }
  }, [comment.content, isEditing])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  const handleDrag = (_e: any, d: { x: number; y: number }) => setLocalPos({ x: d.x, y: d.y })
  
  const handleDragStop = (_e: any, d: { x: number; y: number }) => {
    if (!isOwner) return
    // ⚠️ 修复：拖拽只更新本地内存，不广播给别人
    updateComment(comment.id, { x: d.x, y: d.y })
  }

  const handleLike = () => {
    if (!ws) return
    const currentLikes = Number(comment.likes) || 0
    const newIsLiked = !comment.liked_by_me
    updateComment(comment.id, {
      likes: newIsLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1),
      liked_by_me: newIsLiked
    })
    ws.send(JSON.stringify({ type: 'LIKE_COMMENT', payload: { id: comment.id } }))
  }

  const saveEdit = () => {
    if (!editContent.trim() || editContent === comment.content) {
      setIsEditing(false)
      setEditContent(comment.content)
      return
    }

    setIsEditing(false)
    
    // ⚠️ 修复：当点击保存时，先在本地进行“保底预览”（这里可以根据简单的字符串包含稍微猜一下颜色，或者直接设为黄色等待后端）
    // 这里为了平滑，我们乐观地更新文字，并等待后端的 COMMENTS_UPDATED 广播来更新颜色
    updateComment(comment.id, { content: editContent })

    if (ws) {
      ws.send(JSON.stringify({ type: 'UPDATE_COMMENT', payload: { id: comment.id, content: editContent } }))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditContent(comment.content)
    }
  }

  const displayLikes = Number(comment.likes) || 0

  return (
    <Rnd
      bounds="parent"
      position={localPos}
      size={{ width: 260, height: 'auto' }}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      enableResizing={false}
      disableDragging={!isOwner || isEditing}
      style={{ zIndex: isEditing ? 50 : 10 }}
    >
      <div
        className="relative p-5 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 group"
        style={{
          width: 260,
          minHeight: 130,
          // ⚠️ 修复颜色更新：背景色随 comment.color 变化，并加上平滑过渡
          backgroundColor: comment.color || '#fef3c7',
          transform: `rotate(${isEditing ? 0 : (comment.rotate || 0)}deg)`,
          transition: 'background-color 0.8s ease, transform 0.2s ease', 
        }}
      >
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-white/60 backdrop-blur-sm rotate-[-3deg] shadow-sm border border-white/40 z-0" />
        
        <div 
          className="relative text-sm text-gray-800 mb-4 z-10 cursor-text min-h-[40px]"
          onDoubleClick={() => {
            if (isOwner && !isEditing) {
              setIsEditing(true)
              setEditContent(comment.content)
            }
          }}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="w-full bg-white/50 rounded p-1 outline-none border-2 border-black/20 focus:border-black/50 resize-none transition-colors"
              rows={3}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed font-medium">
              {comment.content}
            </p>
          )}
          {isOwner && !isEditing && (
            <div className="absolute -top-6 right-0 text-[10px] text-black/40 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              双击编辑
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-auto relative z-10">
          <div className="flex items-center gap-2">
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.author_name}`}
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
            <span>{displayLikes}</span>
          </button>
        </div>
      </div>
    </Rnd>
  )
}
