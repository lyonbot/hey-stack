/* global console */

import { transform } from '@babel/core'
import jsxPlugin from '@babel/plugin-syntax-jsx'
import fs from 'fs/promises'

import plugin from '../src/index.ts'

const code = `
import { scope, scopeFor, scopeVar } from "hey-stack-macro";

// Note: each fragment can seamless treat as a new "scope"
// because "scope" inherits all variables from ascendent

const Page = scope(() => {
  return (
    <div>
      <div> welcome! dear {user.name} </div>
      {scope(() => {
        const items = scopeVar(xxxxx),  items2 = scopeVar(items.test);

        onMount(() => {
          /* do something */
        });

        return (
          <>
            <div> we got {items.length} items </div>

            {scopeFor(items, (item, key, items) => {
              // const hash = scopeVar.computed.private(objectHash(item));
              return (
                <section>
                  <div> {item.name} </div>
                  <div> {item.age} </div>
                  <div> {hash} </div>
                </section>
              );
            })}
          </>
        );
      })}
    </div>
  );
});
`

const out = transform(code, {
  plugins: [
    jsxPlugin,
    plugin,
  ],
})

console.log(out.code)
fs.writeFile('./tmp-out.js', out.code)
