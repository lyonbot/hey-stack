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
      "import { defineScopeComponent, defineScopeVariable } from "hey-stack-runtime";
      const Page = defineScopeComponent(_ctx => {
        defineScopeVariable(_ctx, {
          user: {
            value: fetchUser()
          }
        });
        const Clocalstuff = defineScopeComponent("local stuff", _ctx2 => {
          defineScopeVariable(_ctx2, {
            gifts: {
              value: _ctx.user.gifts
            }
          });
          defineScopeVariable(_ctx2, {
            totalPrice: {
              get: () => _ctx2.gifts.reduce((acc, item) => acc + item.price, 0)
            }
          });
          return () => <>
                  <div> we got {_ctx2.gifts.length} gifts </div>
                  <div> total price is {_ctx2.totalPrice} </div>
                </>;
        });
        return () => <div>
            <div> welcome! dear {_ctx.user.name} </div>
            <Clocalstuff />
          </div>;
      });"
    `)
  })
})
