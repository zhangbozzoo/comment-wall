import { useState } from 'react'
import { useStore } from '../store/useStore'
import { API_BASE } from '../utils'

interface Props { onClose: () => void }

export default function CreateModal({ onClose }: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useStore() 

  const handleSubmit = async () => {
    if (!content.trim()) return
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        alert('请先登录')
        return
      }

      const res = await fetch(`${API_BASE}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          content: content,
          author_name: user?.username || '匿名',
          author_avatar: user?.avatar,
          x: (window.innerWidth / 2) - 130 + (Math.random() * 100 - 50),
          y: (window.innerHeight / 2) - 100 + (Math.random() * 100 - 50)
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || '发表失败')
      }
      onClose()
    } catch (error: any) {
      alert(error.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[500px] p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-800">发表新想法</h3>
        <textarea
          className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          placeholder="说出你的建议..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-5 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-md"
          >
            {loading ? '发表中...' : '马上发表'}
          </button>
        </div>
      </div>
    </div>
  )
}
