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

      // 成功：保存状态
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[400px] p-6 relative">
        <h3 className="text-xl font-bold mb-6 text-center">{isRegister ? '注册新账号' : '账号登录'}</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">账号</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-6 bg-black text-white py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? '处理中...' : (isRegister ? '注册并登录' : '登录')}
        </button>

        <div className="mt-4 text-center text-sm text-gray-500">
          {isRegister ? '已有账号？' : '还没有账号？'}
          <button
            onClick={() => { setIsRegister(!isRegister); setError('') }}
            className="text-blue-600 ml-1 hover:underline"
          >
            {isRegister ? '去登录' : '去注册'}
          </button>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>
    </div>
  )
}
