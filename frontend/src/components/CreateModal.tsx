import { useState } from 'react'
import { useStore } from '../store/useStore'
import { API_BASE } from '../utils'

interface Props {
  onClose: () => void
}

export default function CreateModal({ onClose }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const { addComment } = useStore()

  const handleSubmit = async () => {
    if (!content.trim()) return
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        alert('请先登录')
        return
      }

      // ⚠️ 关键：在 Header 中带上 Bearer Token
      const res = await fetch(`${API_BASE}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          content: content,
          author_name: useStore.getState().user?.username || '匿名',
          author_avatar: useStore.getState().user?.avatar,
          // 随机生成位置，让卡片散开
          x: Math.random() * 400 + 200,
          y: Math.random() * 300 + 100
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || '发表失败')
      }

      // 成功后，通过 WebSocket 广播或刷新列表更新页面
      // 这里不需要 addComment，因为 WebSocket 会收到 NEW_COMMENT 广播自动更新
      onClose()
    } catch (error: any) {
      console.error(error)
      alert(error.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[500px] p-6">
        <h3 className="text-lg font-bold mb-4">发表新想法</h3>
        <textarea
          className="w-full h-32 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="说出你的建议..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? '发表中...' : '马上发表'}
          </button>
        </div>
      </div>
    </div>
  )
}
