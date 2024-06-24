import { defineScopeComponent, defineScopeVariable, ScopeFor } from "hey-stack-framework";

export const App = defineScopeComponent((ctx) => {
  defineScopeVariable(ctx, "name", { value: "John" });
  defineScopeVariable(ctx, "todos", {
    value: [
      { id: 1, text: "Buy milk" },
      { id: 2, text: "Buy bread" },
    ],
  });
  defineScopeVariable(ctx, "summary", {
    get: () => {
      return ctx.todos.map((todo) => todo.text).join(", ") || "No todos";
    },
  });

  return () => (
    <div>
      <h1>
        {`TODOs for ${ctx.name}!`}
        <button
          onClick={() => {
            ctx.name = "USER_" + Math.random().toString(36).slice(-6);
          }}
        >
          Change User Name
        </button>
      </h1>

      <ul>
        <ScopeFor items={() => ctx.todos} as="todo" keyAs="index" childComponent={TodoItem} />
        <li>
          <button onClick={() => ctx.todos.push({ id: (ctx.todos.at(-1)?.id ?? -1) + 1, text: "New todo" })}>
            Add todo
          </button>
        </li>
      </ul>

      <Summary />
    </div>
  );
});
const Summary = defineScopeComponent((ctx) => {
  return () => (
    <div>
      <p>{ctx.summary}</p>
    </div>
  );
});
const TodoItem = defineScopeComponent((ctx) => {
  return () => (
    <li>
      {ctx.todo.id}
      <input value={ctx.todo.text} onChange={(e) => (ctx.todo.text = e.target.value)} />
      <button onClick={() => ctx.todos.splice(ctx.index, 1)}>Remove</button>
    </li>
  );
});
