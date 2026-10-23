import { useStore } from '../store/useStore'

export default function Sidebar() {
  const { user, onlineUsers, setShowLogin } = useStore()

  return (
    <div className="w-16 h-full bg-white border-r border-gray-200 flex flex-col items-center py-4 z-20 flex-shrink-0">
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
      <div className="mt-auto pt-4 border-t border-gray-100 w-full flex justify-center">
        <button
          onClick={() => setShowLogin(true)}
          className="relative flex justify-center"
        >
          {user ? (
            <>
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                className="w-10 h-10 rounded-full object-cover border border-gray-100"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
            </>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
              登录
            </div>
          )}
        </button>
      </div>
    </div>
  )
}