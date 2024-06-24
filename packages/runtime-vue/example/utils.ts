export const mixinHighlightChanges = () => {
  return {
    updated() {
      highlightElement(this.$el, '#ff990066')
    },
    mounted() {
      highlightElement(this.$el, '#00cc0066')
    },
    beforeUnmount() {
      highlightElement(this.$el, '#ff000066')
    },
  }
}

function highlightElement(el: any, color: string) {
  const rect = el?.getBoundingClientRect?.()
  if (!rect) return

  const highlightRect = document.createElement('div')
  highlightRect.style.position = 'fixed'
  highlightRect.style.top = `${rect.top}px`
  highlightRect.style.left = `${rect.left}px`
  highlightRect.style.width = `${rect.width}px`
  highlightRect.style.height = `${rect.height}px`
  highlightRect.style.backgroundColor = color
  highlightRect.style.borderRadius = '5px'
  highlightRect.style.pointerEvents = 'none'
  highlightRect.style.outline = '1px solid #000'
  document.body.appendChild(highlightRect)

  setTimeout(() => {
    document.body.removeChild(highlightRect)
  }, 200)
}
