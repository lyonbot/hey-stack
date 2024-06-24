import { getExampleFromLocation } from 'hey-stack-core/examples/index.js'
import React, { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

let globalCounter = 0
const BadComp = () => {
  const uid = useRef('')
  if (!uid.current) {
    uid.current = 's' + (++globalCounter)
    console.log('BadComp First Render', uid.current, uid)
  }

  useEffect(() => {
    console.log('BadComp Mounted', uid.current, uid)
    return () => console.log('BadComp Killing', uid.current, uid)
  }, [])

  return (
    <div>
      <div>{uid.current}</div>
    </div>
  )
}

getExampleFromLocation()
  .load()
  .then((App) => {
    const app = createRoot(document.getElementById('app'))
    app.render(
      <StrictMode>
        {/* <BadComp /> */}
        <App />
      </StrictMode>,
    )
  })
