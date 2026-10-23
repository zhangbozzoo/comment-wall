import React, { useState } from 'react'
import { useStore } from '../store/useStore'

interface Props {
  onClose: () => void
}

export default function CreateModal({ onClose }: Props) {
  const [content, setContent] = useState('')
  const { ws, user } = useStore()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !ws) return

    ws.send(
      JSON.stringify({
        type: 'CREATE_COMMENT',
        payload: {
          content: content.trim(),
          author_name: user?.username || '匿名用户',
          author_avatar: user?.avatar || null,
        },
      })
    )

    setContent('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-lg relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
        <h2 className="text-xl font-bold mb-6 text-center">发表建议</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-40 px-4 py-3 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="写下你的建议..."
          />
          <button
            type="submit"
            className="w-full py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            马上发表
          </button>
        </form>
      </div>
    </div>
  )
}