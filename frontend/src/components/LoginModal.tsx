import { useState } from 'react'
import { useStore } from '../store/useStore'
import { API_BASE } from '../utils'

interface Props { onClose: () => void }

export default function LoginModal({ onClose }: Props) {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser, setToken } = useStore()

  const handleSubmit = async () => {
    if (!username || !password) return setError('请输入账号和密码')
    setError('')
    setLoading(true)

    const endpoint = isRegister ? '/api/register' : '/api/login'

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '操作失败')

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setToken(data.token)
      setUser(data.user)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-8 relative">
        <h3 className="text-2xl font-bold mb-6 text-center text-gray-800">
          {isRegister ? '注册新账号' : '账号登录'}
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">账号</label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-8 bg-black text-white py-3 rounded-xl hover:bg-gray-800 disabled:opacity-50 font-medium shadow-md transition-colors"
        >
          {loading ? '处理中...' : (isRegister ? '注册并登录' : '登录')}
        </button>

        <div className="mt-6 text-center text-sm text-gray-500">
          {isRegister ? '已有账号？' : '还没有账号？'}
          <button
            onClick={() => { setIsRegister(!isRegister); setError('') }}
            className="text-blue-600 ml-1 font-medium hover:underline"
          >
            {isRegister ? '去登录' : '去注册'}
          </button>
        </div>

        <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
