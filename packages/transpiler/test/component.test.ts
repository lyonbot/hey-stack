import { describe, expect, it } from 'vitest'

import { transpile } from './utils'

describe('component', () => {
  it('basic work', () => {
    expect(transpile(`

import { Scope, scopeComponent, ScopeFor, scopeVar } from "hey-stack-macro";

const Page = scopeComponent(() => {
  const user = scopeVar(fetchUser());
  return (
    <div>
      <div> welcome! dear {user.name} </div>
      {Scope("local stuff", () => {
        const gifts = scopeVar(user.gifts);
        const totalPrice = scopeVar.computed(gifts.reduce((acc, item) => acc + item.price, 0));
        return (
          <>
            <div> we got {gifts.length} gifts </div>
            <div> total price is {totalPrice} </div>
          </>
        );
      })}
    </div>
  );
});

    `).code).toMatchInlineSnapshot(`
      "import { defineScopeComponent, defineScopeVar } from "hey-stack-runtime";
      const Page = defineScopeComponent(_ctx => {
        const user = defineScopeVar(_ctx, "user", {
          value: fetchUser()
        });
        const LocalStuff = defineScopeComponent("local stuff", _ctx2 => {
          const user = defineScopeVar(_ctx2, "user", {
            inherited: "user"
          });
          const gifts = defineScopeVar(_ctx2, "gifts", {
            value: user.value.gifts
          });
          const totalPrice = defineScopeVar(_ctx2, "totalPrice", {
            get: () => gifts.value.reduce((acc, item) => acc + item.price, 0)
          });
          return () => <>
                  <div> we got {gifts.value.length} gifts </div>
                  <div> total price is {totalPrice.value} </div>
                </>;
        });
        return () => <div>
            <div> welcome! dear {user.value.name} </div>
            <LocalStuff />
          </div>;
      });"
    `)
  })
})
