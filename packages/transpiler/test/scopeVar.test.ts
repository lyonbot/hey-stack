import { describe, expect, it } from 'vitest'

import { transpile } from './utils'

describe('scopeVar', () => {
  it('basic works: read and write', () => {
    expect(transpile(`
import { Scope, scopeComponent, ScopeFor, scopeVar } from "hey-stack-macro";
const Page = scopeComponent(() => {
  let user = scopeVar.computed(foo);
  const setUser = () => { user = bar };
  return <button onClick={setUser}>update user {user}</button>;
});
    `).code).toMatchInlineSnapshot(`
      "import { defineScopeComponent, defineScopeVar } from "hey-stack-runtime";
      const Page = defineScopeComponent(_ctx => {
        let user = defineScopeVar(_ctx, "user", {
          get: foo
        });
        const setUser = () => {
          user.value = bar;
        };
        return () => <button onClick={setUser}>update user {user.value}</button>;
      });"
    `)
  })
})
