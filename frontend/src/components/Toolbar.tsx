interface Props {
  onCreate: () => void
  onToggleLayout: () => void
  isOrganized: boolean
}

export default function Toolbar({ onCreate, onToggleLayout, isOrganized }: Props) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-full shadow-xl border border-gray-100 p-2 flex items-center gap-4 px-6 z-40 transition-all">
      
      <button 
        onClick={onCreate}
        className="group relative flex items-center justify-center w-10 h-10 hover:bg-gray-100 rounded-full transition-colors"
        title="发表新想法"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-700">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1"></div>

      <button 
        onClick={onToggleLayout}
        className={`group relative flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
          isOrganized ? 'hover:bg-blue-50 text-blue-600' : 'hover:bg-purple-50 text-purple-600'
        }`}
        title={isOrganized ? '打乱卡片' : '智能整理'}
      >
        {isOrganized ? (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        )}
      </button>
    </div>
  )
}
