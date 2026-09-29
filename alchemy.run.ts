import * as Alchemy from "alchemy";
import * as GitHub from "alchemy/GitHub";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

const owner = "darkmatter";

export default Alchemy.Stack(
  "standards",
  { providers: GitHub.providers(), state: Alchemy.localState() },
  Effect.gen(function* () {
    const repository = yield* GitHub.Repository("rules", {
      owner,
      name: "standards",
      description: "Shared adhere rules",
      visibility: "private",
    });
    // CI's adhere validate asks Jev whether any two rules contradict. Naming
    // the repository by its output makes alchemy create it before the secret.
    yield* GitHub.Secret("typesafe-api-key", {
      owner,
      repository: Output.map(repository.fullName, (fullName) => fullName.split("/")[1] ?? ""),
      name: "TYPESAFE_API_KEY",
      value: yield* Config.Redacted("TYPESAFE_API_KEY"),
    });
    return { url: repository.htmlUrl };
  }).pipe(Effect.orDie),
);
