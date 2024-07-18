# Roadmap

## Editor

## Runtime

it provides `ScopeCtx` related api for generated code, including:

- context
- reactivity
- render-suspending for async data,
- lifecycle hooks
- error boundary (TBD?)

hey-stack' development can be based on other framework:

1. The first version of runtime is based on `Vue3`, which already provide lots of goods about reactivity and effective rendering.
2. Then we can introduce to `React / Preact` thanks to the `@vue/reactivity` and `reactivue`
3. Other framework like `SolidJS` can be considered too, which will not take too much effort.
4. Like `Svelte`, the _CodeGen_ can find all variable reading and writing, which make hey-stack possible to be framework-independent. But this is not a high priority task.

### APIs

- `defineScopeComponent(setupFn)`

  define a component, returns a framework-related component

  - example

    ```jsx
    const Page = defineScopeComponent((__scopeCtx) => {
      const hash = defineScopeVar(__scopeCtx, "hash", {
        get: () => objectHash(__scopeCtx.item),
      });

      return () => (
        <div>
          <div>item hash is {hash.value}</div>

          {/* ChildComponent1 cannot access __scopeCtx.hash, 
              because it is private and limited to this scope */}
          <ChildComponent1 />
        </div>
      );
    });
    ```

- `defineScopeVar(scopeCtx, name, options)`

  define a variable inside scope

  - `scopeCtx` - The scope context.

  - `name` - The name of the variable.

  - `options` is an object that can contain:

    - `value`: [1] initial value. can't be used in junction with `get` or `set`

    - `get`: [2] getter function

    - `set`: [2] setter function

    - `inherited`: [3] name of the variable to inherit from outer scope

    - `private`: if true, variable cannot be inherited

    - `exposeAs`: string or symbol, change the name for sub-scopes. can't be used in junction with `private`

### Components

- `ScopeFor(props)`

  a framework-related component to render a list of items

  - `props`

    - `items`: a getter function (can be _async_) that returns an array

    - `as`: optional string, expose item as given variable name

    - `keyAs`: optional string, expose key / index as given variable name

    - `itemsAs`: optional string, exposed variable name

    - `childComponent`: a component made by `defineScopeComponent()`

##  Transpiler

- find all setupFn declared in `scopeComponent()`, `Scope()` and `ScopeFor()`
- find all `scopeVar` declarations and gather infos into the setupFn
- add suffix `.value` to all scopeVar references
- hoist sub-components' declaration, including regular scopeComponent and item-renderer of ScopeFor
