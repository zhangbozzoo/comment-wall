import { useState } from 'react'
import { useStore } from '../store/useStore'

export default function Sidebar() {
  const { user, onlineUsers, setShowLogin, setUser, setToken } = useStore()
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setToken(null)
    setShowLogoutMenu(false)
    window.location.reload()
  }

  const handleAvatarClick = () => {
    if (user) setShowLogoutMenu(!showLogoutMenu)
    else setShowLogin(true)
  }

  // ⚠️ 核心修复：强制用 username 动态生成独一无二的头像
  const getAvatarUrl = (u: any) => {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`
  }

  return (
    <div className="w-16 h-full bg-white border-r border-gray-200 flex flex-col items-center py-4 z-20 flex-shrink-0 relative shadow-sm">
      <div className="flex-1 w-full overflow-y-auto space-y-3 px-2">
        {onlineUsers.map((u) => (
          <div key={u.id} className="relative flex justify-center group cursor-pointer">
            <img
              src={getAvatarUrl(u)}
              className="w-10 h-10 rounded-full object-cover border border-gray-100 transition-transform group-hover:scale-110"
              title={u.username}
            />
            <span className="absolute bottom-0 right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
          </div>
        ))}
      </div>
      
      <div className="mt-auto pt-4 border-t border-gray-100 w-full flex justify-center relative">
        <button
          onClick={handleAvatarClick}
          className="relative flex justify-center cursor-pointer hover:opacity-80 transition-opacity"
        >
          {user ? (
            <>
              <img
                src={getAvatarUrl(user)}
                className="w-10 h-10 rounded-full object-cover border-2 border-black"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
            </>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 hover:bg-gray-200 transition-colors">
              登录
            </div>
          )}
        </button>

        {user && showLogoutMenu && (
          <div className="absolute bottom-16 left-14 bg-white border border-gray-200 shadow-xl rounded-xl py-2 w-32 z-50">
            <div className="px-4 py-1 text-xs text-gray-500 border-b border-gray-100 mb-1 truncate">
              {user.username}
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
            >
              退出登录
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
