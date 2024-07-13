# Protocol

## For Runtime

Given such fragment:

```xml
<div>
  <!-- `user` is defined in outer scope -->
  <div> welcome! dear {user.name} </div>

  <scope name="pageContent">
    <scope:var name="items" value="xxxxx" />
    <scope:onMount handler="do something" />

    <!-- `items` is defined in current scope -->
    <div> we got {items.length} items </div>

    <scope:for items="items" as="item" keyAs="index" itemsAs="array">
      <scope:var private name="hash" get="objectHash(item)" />
      <section>
        <div> {item.name} </div>
        <div> {item.age} </div>
        <div> {hash} </div>
      </section>
    </scope:for>

  </scope>
</div>
```

### Pseudo JSX Code

The "xml fragment" example can be easily rewritten as a pseudo JSX code:

**Unimportant fun fact**: pseudo code can not actually works in React, but might works in SolidJS thanks to "dom-expression"

```jsx
import { scopeComponent, Scope, ScopeFor, scopeVar } from "hey-stack-macro";

// Note: each fragment can seamless treat as a new "scope"
// because "scope" inherits all variables from ascendent

const Page = scopeComponent(() => {
  return (
    <div>
      <div> welcome! dear {user.name} </div>
      {Scope("pageContent", () => {
        const items = scopeVar(xxxxx);
        onMount(() => {
          /* do something */
        });

        return (
          <>
            <div> we got {items.length} items </div>

            {ScopeFor(items, (item, key, items) => {
              const hash = scopeVar.computed.private(objectHash(item));
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
```

#### Note of "computed"

The `foo = scopeVar.computed(expression)` marks the variable as computed, it will auto re-evaluate and re-render related components. You can directly use `foo` to get the value.

You can still use Vue's original `computed` like `foo = computed(() => expression)`, but to take the value, you need to use `foo.value` instead of `foo`, which may be inconvenient.

#### Note of list rendering

The `ScopeFor(items, itemRenderFn)` renders a list of items.

- in compiled code, the `items` will become a getter function like `() => items`, and behave like a computed value.

### Compile to Real JSX Components

Then to make it real, we separate `Scope()` blocks into components.

1. extract the fragment of `Scope(...)` and `ScopeFor(...)` to components.
2. in the component, find all variables that NOT declared in the component function, then add prefix `_scopeCtx.` to them.
3. prepend `_scopeCtx = ...` into scope component code.

```jsx
import { defineScopeComponent, defineScopeVariable, ScopeFor } from "hay-stack/runtime";

// based on "scope", generate lots of components

const Page = defineScopeComponent((__scopeCtx) => {
  // no variable introduced in this scope

  return () => (
    <div>
      {/* `user` not prefixed, because it's not from a `scopeVar` */}
      <div> welcome! dear {user.name} </div>
      <PageContent />
    </div>
  );
});

const PageContent = defineScopeComponent((__scopeCtx) => {
  defineScopeVariable(__scopeCtx, {
    items: { value: xxxxx },
  });
  onMount(() => {
    /* do something */
  });

  // TODO: maybe `items` is async, and can block this component's first rendering

  const __hoisted_items = () => __scopeCtx.items; // improve performance. not required. just for React from unnecessary re-renders, not required.
  return () => (
    <>
      <div> we got {__scopeCtx.items.length} items </div>
      <ScopeFor
        items={__hoisted_items /* note: is a getter function */}
        as="item"
        keyAs="index"
        itemsAs="array"
        childComponent={ChildComponent2}
      />
    </>
  );
});

const ChildComponent2 = defineScopeComponent((__scopeCtx) => {
  defineScopeVariable(__scopeCtx, {
    hash: {
      private: true,
      get: () => objectHash(__scopeCtx.item),
    },
  });

  return () => (
    <section>
      <div> {__scopeCtx.item.name} </div>
      <div> {__scopeCtx.item.age} </div>
      <div> {__scopeCtx.hash} </div>
    </section>
  );
});
```

Then `hey-stack/runtime` will generate component for web frameworks.

For example, in React, it will add something like `<ScopeContext.Provider>` and `useContext(ScopeContext)` to make scope variables inheritable. It also shall make variable reactive, collecting dependencies and re-render components when value updated.

## For Designer and Developer

Designer and Developer may write (1) the XML DSL file, or (2) the pseudo code. Then use compiler to generate the real JSX components.

```
         transpiler            compiler     +runtime & framework
[ XML DSL ] ---> [ Pseudo Code ] ---> [ Code ] -------> [ 🎉 Run in Browser ]
```

### Works with XML DSL

The structured XML DSL is easy to read and write, and managed by a visual editor.

### Works with Pseudo Code

The pseudo code is totally valid JSX/TSX, and can be used in any IDE tools. All you need is import some functions from "hey-stack-macro" package.

- `scopeComponent` - define a new scope component
- `scopeVar` - optional, mark variable as computed, private, etc.
- `Scope` - instantly define and render a new scope component (use it in JSX)
- `ScopeFor` - render a list of items (use it in JSX)

With the typed macro package, these features are out-of-box supported by your favorite IDE:

- IntelliSense
- type checking

To make refactoring and modularizing easier, we need an editor extension to:

#### Refactor: Extract to new "Scope Component"

You can extract a part of JSX into a new component. See example of `ExtractedComponent1` below:

```tsx
const OriginalPage = scopeComponent(() => {
  const items = await fetchItems();
  const user = xxxxxx;

  return (
    <div>
      <p>Hello dear {user.name}</p>
      <ExtractedComponent1 />
    </div>
  );
});

const ExtractedComponent1 = scopeComponent(() => {
  // the scopeVar.inherited() tells CodeGen this variable is inherited from outer scope
  const items: Awaited<ReturnType<typeof fetchItems>> = scopeVar.inherited();
  const itemsHash = scopeVar.computed.private(objectHash(items));

  return (
    <div>
      <p>we got {items.length} items!</p>
      <p>itemsHash: {itemsHash}</p>
    </div>
  );
});
```

Beware that `items` in `ExtractedComponent1` is extracted from outer scope! When page run in browser, it will inherit from outer scope (which is `OriginalPage`). -- this works like a implicit context. In later version, we'll also provide something like `props` to make the passed values explicit.

There is a strategy to handle inherited variables, when extracting:

- If `your_var` is only used by the extracted JSX, we'll **suggest** to move it to new component, or you can still keep it in the original component.

- If `your_var` is **private** and can't be moved, we ask user to choose (1) make it public and optionally `exposeAs` a new name (2) _TBD: pass it as a prop_

### Runtime DevTool

In runtime DevTool, you can :

- view the scope tree.
- find the source scope of variables.
