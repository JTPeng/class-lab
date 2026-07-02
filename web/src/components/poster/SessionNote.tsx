// 单次训练建议：高亮提示条
function SessionNote({ text }: { text: string }) {
  return (
    <section className="flex items-start gap-4 rounded-2xl border-l-8 border-brand-500 bg-brand-100 p-6 shadow-card">
      <span className="text-3xl">💡</span>
      <div>
        <p className="text-sm font-black uppercase tracking-wide text-brand-700">单次训练建议</p>
        <p className="mt-1 text-lg font-medium text-stone-800">{text}</p>
      </div>
    </section>
  )
}

export default SessionNote
