import { defineScopeComponent, defineScopeVar, ScopeForRenderer } from "hey-stack-framework";

export const App = defineScopeComponent((ctx) => {
  const name = defineScopeVar(ctx, "name", { value: "John" });
  const todos = defineScopeVar(ctx, "todos", {
    value: [
      { id: 1, text: "Buy milk" },
      { id: 2, text: "Buy bread" },
    ],
  });
  const summary = defineScopeVar(ctx, "summary", {
    get: () => {
      return todos.value.map((todo) => todo.text).join(", ") || "No todos";
    },
  });

  const __hoisted_todos = () => todos.value; // this prevents React from unnecessary re-renders
  const __hoisted_add_todo = () => todos.value.push({ id: (todos.value.at(-1)?.id ?? -1) + 1, text: "New todo" });

  return () => (
    <div>
      <h1>
        {`TODOs for ${name.value}!`}
        <button
          onClick={() => {
            name.value = "USER_" + Math.random().toString(36).slice(-6);
          }}
        >
          Change User Name
        </button>
      </h1>

      <ul>
        <ScopeForRenderer items={__hoisted_todos} as="todo" keyAs="index" childComponent={TodoItem} />
        <li>
          <button onClick={__hoisted_add_todo}>Add todo</button>
        </li>
      </ul>

      <Summary />
    </div>
  );
});
const Summary = defineScopeComponent((ctx) => {
  const summary = defineScopeVar(ctx, "summary", { inherited: "summary" });
  return () => (
    <div>
      <p>{summary.value}</p>
    </div>
  );
});
const TodoItem = defineScopeComponent((ctx) => {
  const todo = defineScopeVar(ctx, "todo", { inherited: "todo" });
  const index = defineScopeVar(ctx, "index", { inherited: "index" });
  const todos = defineScopeVar(ctx, "todos", { inherited: "todos" });
  return () => (
    <li>
      {todo.value.id}
      <input value={todo.value.text} onChange={(e) => (todo.value.text = e.target.value)} />
      <button onClick={() => todos.value.splice(index.value, 1)}>Remove</button>
    </li>
  );
});
