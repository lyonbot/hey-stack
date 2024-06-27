import { getExampleFromLocation, insertExampleLinksBefore } from 'hey-stack-core/examples/index.js'
import { createApp, h } from 'vue'

import { mixinHighlightChanges } from './utils.js'

getExampleFromLocation()
  .load()
  .then((App) => {
    const el = document.getElementById('app')!
    insertExampleLinksBefore(el)

    const app = createApp(() => h(App))
    app.mixin(mixinHighlightChanges())
    app.mount(el)
  })
