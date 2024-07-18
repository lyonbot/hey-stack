# Beginner's Guide to Writing Pseudo JSX

Welcome to our new web frontend framework!

This guide will introduce you to writing "pseudo JSX" - a powerful way to create reactive components with ease. We'll cover the four main macros that make this possible: scopeComponent, Scope, ScopeFor, and scopeVar.

## What is Pseudo JSX?

Pseudo JSX is a way to write components that looks like regular JSX (used in React), but with some special features that make managing state and creating nested components easier. It's called "pseudo" because it's not real JSX – our framework will transform it into real components later.

## The Four Key Macros

### 1. scopeComponent

`scopeComponent` is used to create a new component. It's similar to creating a function component in React, but with some extra powers.

How to use it:

```jsx
import { scopeComponent } from "hey-stack-macro";

const MyComponent = scopeComponent(() => {
  // add logic and state here
  return (
    <div>
      <h1>Hello, World!</h1>
    </div>
  );
});
```

### 2. scopeVar

`scopeVar` is used to create reactive variables within your component. These variables will automatically update your component when they change.

How to use it:

```jsx
import { scopeComponent, scopeVar } from "hey-stack-macro";

const Counter = scopeComponent(() => {
  let count = scopeVar(0); // "count" is exactly a number, but with "scopeVar" it's reactive

  const increment = () => {
    count += 1; // directly modify the variable
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
});
```

### 3. Scope

`Scope` allows you to create a new scope within your component. They can easily be extracted into components. This is useful for organizing your code and creating local variables.

How to use it:

```jsx
import { scopeComponent, Scope, scopeVar } from "hey-stack-macro";

const App = scopeComponent(() => {
  const user = scopeVar(fetchUser());

  return (
    <div>
      <h1>My App</h1>

      {Scope("header", () => {
        const systemTitle = scopeVar("MyApp");
        return (
          <header>
            Dear {user.name}, welcome to {systemTitle}
          </header>
        );
      })}

      {Scope("content", () => {
        return (
          <main>
            <img src={user.avatar} alt={user.name} />
            Your user id is {user.id}!
          </main>
        );
      })}
    </div>
  );
});
```

### 4. ScopeFor

`ScopeFor` is used for rendering lists of items. It's similar to using `map` in React, but with some added benefits.

How to use it:

```jsx
import { scopeComponent, ScopeFor, scopeVar } from "hey-stack-macro";

const TodoList = scopeComponent(() => {
  const todos = scopeVar(["Learn pseudo JSX", "Build an app", "Enjoy!"]);

  return (
    <ul>
      {ScopeFor(todos, (todo, index) => (
        // already keyed, no more key={...}
        <li>
          {index + 1}. {todo}
        </li>
      ))}
    </ul>
  );
});
```

## Putting It All Together

Here's an example that uses all four macros together:

```jsx
import { scopeComponent, Scope, ScopeFor, scopeVar } from "hey-stack-macro";

const TodoApp = scopeComponent(() => {
  const todos = scopeVar(["Learn pseudo JSX", "Build an app", "Enjoy!"]);
  let newTodo = scopeVar("");

  return (
    <div>
      {Scope("header", () => {
        const title = scopeVar("My Todo App");
        return <h1>{title}</h1>;
      })}

      <p>
        Add a new todo:
        <input
          value={newTodo}
          onChange={(e) => {
            newTodo = e.target.value;
          }}
        />
        <button
          onClick={() => {
            if (newTodo.trim() !== "") {
              todos.push(newTodo);
              newTodo = "";
            }
          }}
        >
          Add Todo
        </button>
      </p>

      <ul>
        {ScopeFor(todos, (todo, index) => (
          <li>
            {index + 1}. {todo}
          </li>
        ))}
      </ul>
    </div>
  );
});
```

This example shows how to create a simple todo app using our pseudo JSX approach. It demonstrates using `scopeComponent` to create the main component, `scopeVar` for reactive state, `Scope` for organizing code, and `ScopeFor` for rendering the list of todos.

Remember, this is pseudo JSX – our framework will transform this code into real components that can run in the browser. Happy coding!

## What's Next?

- Learn more about `scopeVar` - it has different kinds: `ref`, `computed`, `inherited`, etc.
