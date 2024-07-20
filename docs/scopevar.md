# Comprehensive Guide to scopeVar

`scopeVar` is a powerful feature in our framework that allows you to create reactive variables within your components. This guide will introduce you to the various types of `scopeVar` and their use cases.

## Basic scopeVar

The most basic form of `scopeVar` creates a deeply reactive variable.

```javascript
let count = scopeVar(0);

// Later in your code:
count = 1; // Directly assign a new value
console.log(count); // Outputs: 1
```

**Note for React / Vue / SolidJS developers:** Unlike other frameworks' `Ref`, you don't need to use a setter function or access a `.value` property. You can **directly read and assign** values to the variable.

## Types of scopeVar

### 1. Basic (Deeply Reactive)

By default, all `scopeVar` declarations create deeply reactive variables. The entire object structure becomes reactive.

```javascript
let user = scopeVar({ name: "Alice", age: 30, addresses: [] });

// Later in your code:
user.age = 31; // This will trigger reactivity
user.addresses.push("123 Main St"); // trigger reactivity too
```

Accessing nested objects like `user.addresses` will get a Proxy! Use `toRaw(user.addresses)` to retrieve the original object (without reactivity!)

You can also use `markRaw` to mark objects as non-reactive, and they won't become a Proxy object. ([more info](https://vuejs.org/api/reactivity-advanced.html#markraw))

```js
let addresses = [{ street: "123 Main St" }]; // Original object
user.addresses = markRaw(addresses);

// Later in your code:
user.addresses.push({ street: "456 Elm St" }); // This will NOT trigger reactivity
assert(user.addresses === addresses); // Identical! won't get a Proxy object
```

### 2. Ref (Shallow Reactive)

Use `scopeVar.ref` for better performance when you only need shallow reactivity.

```javascript
let element = scopeVar.ref(null);

// Later in your code:
element = document.getElementById("myElement");
```

With `ref`, the variable itself is reactive, but its properties (if it's an object) are not. This is more performant and the value won't become a Proxy object.

### 3. Computed

Computed variables automatically update when their dependencies change.

```javascript
let firstName = scopeVar("John");
let lastName = scopeVar("Doe");
const fullName = scopeVar.computed(() => `${firstName} ${lastName}`);

// Later in your code:
firstName = "Jane";
console.log(fullName); // Outputs: "Jane Doe"
```

Optionally, you can give a setter function:

```javascript
const price = scopeVar(100);

let quantity = scopeVar(1);
let total = scopeVar.computed(
  () => price * quantity,
  (c) => (quantity = c / price) // change quantity when setting total
);
```

### 4. Inherited

Inherited variables take their value from a parent scope, making an alias.

Beware the alias is bi-direction binding! Writing value to `childVar` will change `parentVar` and vice versa.

```javascript
const App = scopeComponent("parentComponent", () => {
  let parentVar = scopeVar("parentVar");

  return (
    <div>
      {parentVar}

      {Scope("childComponent", () => {
        // childVar is inherited from parentVar (beware there's NO quote between `parentVar`)
        let childVar = scopeVar.inherited(parentVar);
        return (
          <div>
            {childVar}
            <button onClick={() => childVar++}>Increment</button>
          </div>
        );
      })}
    </div>
  );
});
```

You can also provide a default value:

```javascript
let childVar = scopeVar.inherited(parentVar, "default value if can't inherit");
```

## Best Practices

1. Use basic `scopeVar` for most cases where you need deep reactivity.
2. Use `scopeVar.ref` for DOM references or when you only need shallow reactivity for performance reasons.
3. Use `computed` for values that depend on other reactive variables.
4. Use `inherited` to rename a variable from parent scope, keeping the alias bi-direction binding.

## Performance Considerations

- Basic `scopeVar` creates a Proxy object, which may have performance implications for large or deeply nested objects.
- `scopeVar.ref` is more performant for large objects or when you only need shallow reactivity.
- Consider using `computed` for expensive calculations to avoid unnecessary recomputation.

## Gotchas for React / Vue / SolidJS Developers

1. Direct assignment, no setter: just read and write values directly to `scopeVar` variables. You don't need to use setter functions or `.value` like in React / Vue / SolidJS.

Remember, while this syntax might feel more intuitive, it's important to be mindful of when and where you're updating these variables to maintain predictable component behavior.

By understanding these different types of `scopeVar`, you can optimize your component's reactivity and performance in our framework.
