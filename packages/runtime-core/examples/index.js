/* global location */

const examples = [
  { id: 'hello', load: () => import('./hello.jsx').then(m => m.App) },
  { id: 'todo', load: () => import('./todo.jsx').then(m => m.App) },
]

export default examples
export function getExampleFromLocation() {
  if (typeof location === 'undefined') return examples[0]

  const eId = location.hash.slice(1)
  const example = examples.find(e => e.id === eId) || examples[0]
  if (example.id !== eId) location.hash = example.id
  return example
}
