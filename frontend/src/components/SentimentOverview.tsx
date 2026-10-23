import { useStore } from '../store/useStore'

export default function SentimentOverview() {
  const { comments } = useStore()

  const total = comments.length
  const positive = comments.filter((c) => c.sentiment === 'positive').length
  const negative = comments.filter((c) => c.sentiment === 'negative').length
  const neutral = total - positive - negative

  const pPct = total ? (positive / total) * 100 : 0
  const nPct = total ? (negative / total) * 100 : 0
  const neuPct = total ? (neutral / total) * 100 : 0

  return (
    <div className="flex flex-col gap-1 w-48">
      <div className="flex h-2 rounded-full overflow-hidden">
        <div className="bg-green-400" style={{ width: `${pPct}%` }} />
        <div className="bg-yellow-400" style={{ width: `${neuPct}%` }} />
        <div className="bg-red-400" style={{ width: `${nPct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>正面 {Math.round(pPct)}%</span>
        <span>中性 {Math.round(neuPct)}%</span>
        <span>负面 {Math.round(nPct)}%</span>
      </div>
    </div>
  )
}