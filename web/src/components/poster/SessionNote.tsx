// 单次训练建议：高亮提示条
function SessionNote({ text }: { text: string }) {
  return (
    <section className="rounded-2xl bg-brand-50 p-5 ring-1 ring-brand-200">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-600">单次训练建议</p>
      <p className="mt-1 text-stone-800">{text}</p>
    </section>
  )
}

export default SessionNote
