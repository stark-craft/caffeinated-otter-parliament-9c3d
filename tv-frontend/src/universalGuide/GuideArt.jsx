export default function GuideArt({ item, hero = false, className, style }) {
  return <img src={item.image || item.fallback} alt="" className={className} style={style}
    loading={hero ? 'eager' : 'lazy'} onLoad={event => event.currentTarget.parentElement.classList.add('ug-art-ready')} onError={event => {
      const image = event.currentTarget
      const fallbacks = [item.fallback, item.placeholder].filter(Boolean)
      const index = Number(image.dataset.fallbackIndex || 0)
      if (index < fallbacks.length) {
        image.dataset.fallbackIndex = String(index + 1)
        image.src = fallbacks[index]
      } else { image.style.visibility = 'hidden'; image.parentElement.classList.remove('ug-art-ready') }
    }} />
}
