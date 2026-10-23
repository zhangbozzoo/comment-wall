interface Props {
  onCreate: () => void
  onOrganize: () => void
}

export default function Toolbar({ onCreate, onOrganize }: Props) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg border border-gray-100 p-2 flex items-center gap-4 px-6 z-30">
      
      {/* 新增评论 */}
      <button 
        onClick={onCreate}
        className="group relative flex items-center justify-center w-10 h-10 hover:bg-gray-100 rounded-full transition-colors"
        title="发表新想法"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-700">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* 智能整理（原点赞位置） */}
      <button 
        onClick={onOrganize}
        className="group relative flex items-center justify-center w-10 h-10 hover:bg-purple-50 rounded-full transition-colors"
        title="按情绪智能整理"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-purple-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      </button>

      {/* 拖动模式提示 */}
      <button 
        className="group relative flex items-center justify-center w-10 h-10 hover:bg-gray-100 rounded-full transition-colors cursor-default"
        title="拖拽卡片调整位置"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-gray-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
        </svg>
      </button>

    </div>
  )
}
