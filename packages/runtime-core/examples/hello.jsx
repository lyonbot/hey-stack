import { defineScopeComponent, defineScopeVar, ScopeForRenderer } from "hey-stack-framework";

export const App = defineScopeComponent((ctx) => {
  const index = defineScopeVar(ctx, 'index', { value: 0 })
  const names = defineScopeVar(ctx, 'names', { value: ["John", "Jane", "Joe", "Jack", "Jill", "Jim", "Joey", "Johnny", "Jon", "Jerry"] })
  const name = defineScopeVar(ctx, 'name', { get: () => names.value[index.value] })

  return () => (
    <div>
      <h1>Hello {name.value}!</h1>
      <button onClick={() => (index.value = (index.value + 1) % names.value.length)}>Change Name</button>
    </div>
  );
});
