import { describe, expect, it } from 'vitest'

import { transpile } from './utils'

describe('scopeFor', () => {
  it('basic work', () => {
    expect(transpile(`
import { Scope, scopeComponent, ScopeFor, scopeVar } from "hey-stack-macro";

const Page = scopeComponent(() => {
  const items = scopeVar.computed(globalThis.getItems());
  return (
    <div>
      {ScopeFor(items, (item, index, items2) => {
        const hash = scopeVar.computed.private(objectHash(item));
        return (
          <section>
            <div> {index} of {items.length} </div>
            <div> {index} of {items2.length} </div>

            <div> {item.name} </div>
            <div> {item.age} </div>
            <div> {hash} </div>
          </section>
        );
      })}
    </div>
  );
});
    `).code).toMatchInlineSnapshot(`
      "import { ScopeForRenderer, defineScopeComponent, defineScopeVariable } from "hey-stack-runtime";
      const Page = defineScopeComponent(_ctx => {
        defineScopeVariable(_ctx, {
          items: {
            get: () => globalThis.getItems()
          }
        });
        const items = () => _ctx.items,
          itemRender = defineScopeComponent(_ctx2 => {
            defineScopeVariable(_ctx2, {
              items2: {}
            });
            defineScopeVariable(_ctx2, {
              index: {}
            });
            defineScopeVariable(_ctx2, {
              item: {}
            });
            defineScopeVariable(_ctx2, {
              hash: {
                get: () => objectHash(_ctx2.item),
                private: true
              }
            });
            return () => <section>
                  <div> {_ctx2.index} of {_ctx.items.length} </div>
                  <div> {_ctx2.index} of {_ctx2.items2.length} </div>

                  <div> {_ctx2.item.name} </div>
                  <div> {_ctx2.item.age} </div>
                  <div> {_ctx2.hash} </div>
                </section>;
          });
        return () => <div>
            <ScopeForRenderer items={items} childComponent={itemRender} as="item" keyAs="index" itemsAs="items2" />
          </div>;
      });"
    `)
  })

  it('item render with arrow function', () => {
    expect(transpile(`
import { Scope, scopeComponent, ScopeFor, scopeVar } from "hey-stack-macro";

const Page = scopeComponent(() => {
  const items = scopeVar.computed(globalThis.getItems());
  return (
    <div>
      {ScopeFor(items, (item, index, items2) => (
        <section>
          <div> {index} of {items.length} </div>
          {/* <div> {index} of {items2.length} </div> */}
          <div> {item.name} </div>
          <div> {item.age} </div>
        </section>
      ))}
    </div>
  );
});
    `).code).toMatchInlineSnapshot(`
      "import { ScopeForRenderer, defineScopeComponent, defineScopeVariable } from "hey-stack-runtime";
      const Page = defineScopeComponent(_ctx => {
        defineScopeVariable(_ctx, {
          items: {
            get: () => globalThis.getItems()
          }
        });
        const items = () => _ctx.items,
          itemRender = defineScopeComponent(_ctx2 => {
            defineScopeVariable(_ctx2, {
              index: {}
            });
            defineScopeVariable(_ctx2, {
              item: {}
            });
            return () => <section>
                <div> {_ctx2.index} of {_ctx.items.length} </div>
                {/* <div> {index} of {items2.length} </div> */}
                <div> {_ctx2.item.name} </div>
                <div> {_ctx2.item.age} </div>
              </section>;
          });
        return () => <div>
            <ScopeForRenderer items={items} childComponent={itemRender} as="item" keyAs="index" />
          </div>;
      });"
    `)
  })
})
