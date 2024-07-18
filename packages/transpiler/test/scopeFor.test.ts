import { describe, expect, it } from 'vitest'

import { transpile } from './utils'

describe('scopeFor', () => {
  it('basic work', () => {
    expect(transpile(`
import { Scope, scopeComponent, ScopeFor, scopeVar } from "hey-stack-macro";

const Page = scopeComponent(() => {
  const items = scopeVar.computed(() => globalThis.getItems());
  return (
    <div>
      {ScopeFor(items, (item, index, items2) => {
        const hash = scopeVar.computed(() => objectHash(item));
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
      "import { ScopeForRenderer, defineScopeComponent, defineScopeVar } from "hey-stack-runtime";
      const Page = defineScopeComponent(_ctx => {
        const items = defineScopeVar(_ctx, "items", {
          get: () => globalThis.getItems()
        });
        const itemRender = defineScopeComponent(_ctx2 => {
          const items = defineScopeVar(_ctx2, "items", {
            inherited: "items"
          });
          let items2 = defineScopeVar(_ctx2, "items2", {
            inherited: "items2"
          });
          let index = defineScopeVar(_ctx2, "index", {
            inherited: "index"
          });
          let item = defineScopeVar(_ctx2, "item", {
            inherited: "item"
          });
          const hash = defineScopeVar(_ctx2, "hash", {
            get: () => objectHash(item.value)
          });
          return () => <section>
                  <div> {index.value} of {items.value.length} </div>
                  <div> {index.value} of {items2.value.length} </div>

                  <div> {item.value.name} </div>
                  <div> {item.value.age} </div>
                  <div> {hash.value} </div>
                </section>;
        });
        return () => <div>
            <ScopeForRenderer items={/*@hey-stack/core:rawScopeVarPointer*/items} childComponent={itemRender} as="item" keyAs="index" itemsAs="items2" />
          </div>;
      });"
    `)
  })

  it('item render with arrow function', () => {
    expect(transpile(`
import { Scope, scopeComponent, ScopeFor, scopeVar } from "hey-stack-macro";

const Page = scopeComponent(() => {
  const items = scopeVar.computed(() => globalThis.getItems());
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
      "import { ScopeForRenderer, defineScopeComponent, defineScopeVar } from "hey-stack-runtime";
      const Page = defineScopeComponent(_ctx => {
        const items = defineScopeVar(_ctx, "items", {
          get: () => globalThis.getItems()
        });
        const itemRender = defineScopeComponent(_ctx2 => {
          const items = defineScopeVar(_ctx2, "items", {
            inherited: "items"
          });
          let index = defineScopeVar(_ctx2, "index", {
            inherited: "index"
          });
          let item = defineScopeVar(_ctx2, "item", {
            inherited: "item"
          });
          return () => <section>
                <div> {index.value} of {items.value.length} </div>
                {/* <div> {index} of {items2.length} </div> */}
                <div> {item.value.name} </div>
                <div> {item.value.age} </div>
              </section>;
        });
        return () => <div>
            <ScopeForRenderer items={/*@hey-stack/core:rawScopeVarPointer*/items} childComponent={itemRender} as="item" keyAs="index" />
          </div>;
      });"
    `)
  })

  it('items getter', () => {
    expect(transpile(`
import { Scope, scopeComponent, ScopeFor, scopeVar } from "hey-stack-macro";

const Page = scopeComponent(async () => {
  const sys = scopeVar(await fetchSystemInfo());
  return (
    ScopeFor(sys.items, (item, index, items) => (<div>{item.name}</div>))
  )
})
`)).toMatchInlineSnapshot(`
  {
    "code": "import { ScopeForRenderer, defineScopeComponent, defineScopeVar } from "hey-stack-runtime";
  const Page = defineScopeComponent(async _ctx => {
    const sys = defineScopeVar(_ctx, "sys", {
      value: await fetchSystemInfo()
    });
    const items = () => sys.value.items,
      itemRender = defineScopeComponent(_ctx2 => {
        let item = defineScopeVar(_ctx2, "item", {
          inherited: "item"
        });
        return () => <div>{item.value.name}</div>;
      });
    return () => <ScopeForRenderer items={items} childComponent={itemRender} as="item" />;
  });",
  }
`)
  })
})
