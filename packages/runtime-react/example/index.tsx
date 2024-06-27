import { getExampleFromLocation, insertExampleLinksBefore } from 'hey-stack-core/examples/index.js'
import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

getExampleFromLocation()
  .load()
  .then((App) => {
    const el = document.getElementById('app')
    insertExampleLinksBefore(el)

    const app = createRoot(el)
    app.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
