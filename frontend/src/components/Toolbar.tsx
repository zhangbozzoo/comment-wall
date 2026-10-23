import { Plus, Sparkles, Hand } from 'lucide-react'

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
        <Plus size={24} className="text-gray-700" />
      </button>

      {/* 智能整理（原点赞位置） */}
      <button 
        onClick={onOrganize}
        className="group relative flex items-center justify-center w-10 h-10 hover:bg-purple-50 rounded-full transition-colors"
        title="按情绪智能整理"
      >
        <Sparkles size={20} className="text-purple-500" />
      </button>

      {/* 拖动模式提示（目前全局已支持拖动，此按钮作为视觉占位） */}
      <button 
        className="group relative flex items-center justify-center w-10 h-10 hover:bg-gray-100 rounded-full transition-colors cursor-default"
        title="拖拽卡片调整位置"
      >
        <Hand size={20} className="text-gray-400" />
      </button>

    </div>
  )
}
