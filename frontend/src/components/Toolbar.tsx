// No store usage in this component
interface Props {
  onCreate: () => void
  onOrganize: () => void
}

export default function Toolbar({ onCreate, onOrganize }: Props) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
      <div className="flex items-center gap-4 bg-white rounded-full shadow-lg px-6 py-3">
        <button
          onClick={onCreate}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-900 text-white hover:bg-gray-700 transition-colors"
          title="新增"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={onOrganize}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          title="整理"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
        <button
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-grab"
          title="拖动"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1 1 0 011-1h10a1 1 0 011 1v6a1 1 0 01-1 1h-10a1 1 0 01-1-1zM9 11.5V14m0-2.5v-6a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1z" />
          </svg>
        </button>
      </div>
    </div>
  )
}