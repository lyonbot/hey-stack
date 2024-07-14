import { defineScopeComponent, defineScopeVariable, ScopeForRenderer } from "hey-stack-framework";

export const App = defineScopeComponent((ctx) => {
  defineScopeVariable(ctx, {
    index: { value: 0 },
    names: { value: ["John", "Jane", "Joe", "Jack", "Jill", "Jim", "Joey", "Johnny", "Jon", "Jerry"] },
    name: { get: () => ctx.names[ctx.index] },
  });

  return () => (
    <div>
      <h1>Hello {ctx.name}!</h1>
      <button onClick={() => (ctx.index = (ctx.index + 1) % ctx.names.length)}>Change Name</button>
    </div>
  );
});
