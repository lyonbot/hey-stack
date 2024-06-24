import { getExampleFromLocation } from 'hey-stack-core/examples/index.js'
import { createApp, h } from 'vue'

import { mixinHighlightChanges } from './utils.js'

getExampleFromLocation()
  .load()
  .then((App) => {
    const app = createApp(() => h(App))
    app.mixin(mixinHighlightChanges())
    app.mount('#app')
  })
