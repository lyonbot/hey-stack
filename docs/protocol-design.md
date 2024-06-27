# Protocol

## For Runtime

Given such fragment:

```xml
<div>
  <!-- `user` is defined in outer scope -->
  <div> welcome! dear {user.name} </div>

  <scope>
    <scope:variable name="items" value="xxxxx" />
    <scope:onMount handler="do something" />

    <!-- `items` is defined in current scope -->
    <div> we got {items.length} items </div>

    <scope:for each="items" as="item" keyAs="index" itemsAs="array">
      <scope:computed private name="hash" getter="objectHash(item)" />
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
// Note: each fragment can seamless treat as a new "scope"
// because "scope" inherits all variables from ascendent

const Page = scope(() => {
  return (
    <div>
      <div> welcome! dear {user.name} </div>
      {scope(() => {
        const items = xxxxx;
        onMount(() => {
          /* do something */
        });

        return (
          <>
            <div> we got {items.length} items </div>

            {scopeFor(
              () => items, // is a getter function. but maybe not useless in SolidJS because "props" is a reactive object and `props.items` already reactive
              ({ item: item, index: index, items: array }) => {
                // ^^ arguments must be a deconstructing expression, to make TypeScript works and CodeGen analyze
                $computed_private: const hash = objectHash(item);
                return (
                  <section>
                    <div> {item.name} </div>
                    <div> {item.age} </div>
                    <div> {hash} </div>
                  </section>
                );
              }
            )}
          </>
        );
      })}
    </div>
  );
});
```

### Compile to Real JSX Components

Then to make it real, we separate `scope()` blocks into components.

1. extract the fragment of `scope(...)` and `scopeFor(...)` to components.
2. in the component, find all variables that NOT declared in the component function, then add prefix `_scopeCtx.` to them.
3. prepend `_scopeCtx = ...` into scope component code.

```jsx
import { defineScopeComponent, defineScopeVariable, ScopeFor } from "hay-stack/runtime";

// based on "scope", generate lots of components

const Page = defineScopeComponent((__scopeCtx) => {
  // no variable introduced in this scope

  return () => (
    <div>
      {/* `user` got prefixed with `__scopeCtx.` */}
      <div> welcome! dear {__scopeCtx.user.name} </div>
      <ChildComponent1 />
    </div>
  );
});

const ChildComponent1 = defineScopeComponent((__scopeCtx) => {
  defineScopeVariable(__scopeCtx, "items", { value: xxxxx });
  onMount(() => {
    /* do something */
  });

  // TODO: maybe `items` is async, and can block this component's first rendering

  const __hoisted_items = () => __scopeCtx.items; // improve performance. not required. just for React
  return () => (
    <>
      <div> we got {__scopeCtx.items.length} items </div>
      <ScopeFor
        items={__hoisted_items}
        as="item"
        keyAs="index"
        itemsAs="array"
        childComponent={ChildComponent2}
      />
    </>
  );
});

const ChildComponent2 = defineScopeComponent((__scopeCtx) => {
  defineScopeVariable(__scopeCtx, "hash", {
    private: true,
    get: () => objectHash(__scopeCtx.item),
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

### Variable Typing

To make refactoring and modularizing easier, we need to organize variables and make type annotations.

Luckily it is easy to attach typescript annotations to the XML and the pseudo code.

Especially, because the pseudo code is already nested, we can leverage TypeScript's intelligent inferring, auto-completion directly -- it just works!

### Refactor: Extracting & Cross-Component variable Typing

When extracting a part of JSX into a new "Scope Component", we can still find what variables are referenced in the extracted JSX part, and make a type copy into the new `scope(...)` like this:

```tsx
const OriginalPage = scope(() => {
  const items = await fetchItems();
  const user = xxxxxx;

  return () => (
    <div>
      <p>Hello dear {user.name}</p>
      <ExtractedComponent1 />
    </div>
  );
});

const ExtractedComponent1 = scope(() => {
  // the label tells CodeGen this variable is inherited from outer scope
  $inherited: var items!: Awaited<ReturnType<typeof fetchItems>>;
  $computed_private: var itemsHash = objectHash(items);

  return (
    <div>
      <p>we got {items.length} items!</p>
      <p>itemsHash: {itemsHash}</p>
    </div>
  );
});
```

the `$inherited:` label tells CodeGen this variable is inherited from outer scope. The labelled code line will be removed by CodeGen.

With labels, code is still valid TypeScript. Beware the `!` mark after variable name, it is introduced to suppress TypeScript's 2454 Error (variable used before initializing)

As for the IDE tools, when user try to extract a JSX part:

- if some variables are only used in the JSX-to-be-extracted, we ask user determine which variables are moved to new component, which are merely `$inherited:`

- **private variables** cannot be inherited. if user refused (or unable to) move it to new component, we ask user to choose (1) make it public and renamed (2)

### Visualize and Trace variable source Scope

How can developers ensure that they're using the correct scope when defining variables or accessing existing ones?

In runtime DevTool, aside the component tree, we shall provide a tool to locate the source scopes of variables, and which sub-scopes are using the variables.
