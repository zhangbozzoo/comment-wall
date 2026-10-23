import { useState } from 'react'
import { useStore } from '../store/useStore'

export default function Sidebar() {
  // 完整解构需要的状态，加入 setUser 和 setToken 用于退出
  const { user, onlineUsers, setShowLogin, setUser, setToken } = useStore()
  const [showLogoutMenu, setShowLogoutMenu] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setToken(null)
    setShowLogoutMenu(false)
    // 强制刷新页面，清空所有内存状态
    window.location.reload()
  }

  const handleAvatarClick = () => {
    if (user) {
      setShowLogoutMenu(!showLogoutMenu) // 已登录则切换退出菜单
    } else {
      setShowLogin(true) // 未登录则弹出登录框
    }
  }

  return (
    <div className="w-16 h-full bg-white border-r border-gray-200 flex flex-col items-center py-4 z-20 flex-shrink-0 relative">
      <div className="flex-1 w-full overflow-y-auto space-y-3 px-2">
        {onlineUsers.map((u) => (
          <div key={u.id} className="relative flex justify-center">
            <img
              src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`}
              className="w-10 h-10 rounded-full object-cover border border-gray-100"
              title={u.username}
            />
            <span className="absolute bottom-0 right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
          </div>
        ))}
      </div>
      
      {/* 底部当前用户区域 */}
      <div className="mt-auto pt-4 border-t border-gray-100 w-full flex justify-center relative">
        <button
          onClick={handleAvatarClick}
          className="relative flex justify-center cursor-pointer hover:opacity-80 transition-opacity"
        >
          {user ? (
            <>
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                className="w-10 h-10 rounded-full object-cover border-2 border-black"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
            </>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
              登录
            </div>
          )}
        </button>

        {/* 退出登录弹窗菜单 */}
        {user && showLogoutMenu && (
          <div className="absolute bottom-16 left-14 bg-white border border-gray-200 shadow-lg rounded-lg py-2 w-32 z-50">
            <div className="px-4 py-1 text-xs text-gray-500 border-b border-gray-100 mb-1 truncate">
              {user.username}
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              退出登录
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
