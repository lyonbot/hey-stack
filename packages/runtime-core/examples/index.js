/* global window, document, URLSearchParams */

const examples = [
  { id: 'hello', load: () => import('./hello.jsx').then(m => m.App) },
  { id: 'todo', load: () => import('./todo.jsx').then(m => m.App) },
]

export default examples
export function getExampleFromLocation() {
  if (typeof window === 'undefined') return examples[0]

  const q = new URLSearchParams(window.location.search)
  const eId = q.get('app')
  const example = examples.find(e => e.id === eId) || examples[0]
  if (example.id !== eId) {
    q.set('app', example.id)
    window.history.replaceState({}, '', `${window.location.pathname}?${q}`)
  }
  return example
}

export function insertExampleLinksBefore(el) {
  const container = document.createElement('div')
  container.textContent = 'Examples: '
  el.parentNode?.insertBefore(container, el)

  const currentId = getExampleFromLocation().id
  examples.forEach((e) => {
    const link = document.createElement('a')
    link.textContent = e.id
    link.href = `?app=${e.id}`
    link.style.cssText = 'margin: 0 5px'
    container.appendChild(link)
    if (e.id === currentId) {
      link.style.fontWeight = 'bold'
    }
  })
}
