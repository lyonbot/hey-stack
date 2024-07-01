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
      defineScopeVariable(__scopeCtx, "hash", {
        private: true,
        get: () => objectHash(__scopeCtx.item),
      });

      return () => (
        <div>
          <div>item hash is {__scopeCtx.hash}</div>

          {/* ChildComponent1 cannot access __scopeCtx.hash, 
              because it is private and limited to this scope */}
          <ChildComponent1 />
        </div>
      );
    });
    ```

- `defineScopeVariable(scopeCtx, name, options)`

  define a variable inside scope

  - `scopeCtx` - The scope context.

  - `name` - The name of the variable.

  - `options` is an object that can contain:

    - `value`: initial value. can't be used in junction with `get` or `set`

    - `get`: getter function

    - `set`: setter function

    - `private`: if true, variable cannot be inherited

    - `exposeAs`: string or symbol, change the name for sub-scopes. can't be used in junction with `private`

- `defineScopeVariable(scopeCtx, optionsMap)`

  define multiple variables at once. the `optionsMap` is something like `{ name1: options1, name2: options2, ... }`

### Components

- `ScopeFor(props)`

  a framework-related component to render a list of items

  - `props`

    - `items`: a getter function (can be _async_) that returns an array

    - `as`: optional string, expose item as given variable name

    - `keyAs`: optional string, expose key / index as given variable name

    - `itemsAs`: optional string, exposed variable name

    - `childComponent`: a component made by `defineScopeComponent()`

## CodeGen: SWC plugin to convert pseudo code

- separate `scope()` and `scopeFor()` into components
- Detect "global" variable and add prefix
