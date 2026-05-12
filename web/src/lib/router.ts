export type Route =
  | { name: "tailor" }
  | { name: "projects" }
  | { name: "project"; id: string | null }
  | { name: "profile" };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
  if (h === "" || h === "tailor") return { name: "tailor" };
  if (h === "projects") return { name: "projects" };
  if (h === "profile") return { name: "profile" };
  if (h === "projects/new") return { name: "project", id: null };
  const m = /^projects\/([a-z0-9][a-z0-9-]*)$/.exec(h);
  if (m) return { name: "project", id: m[1]! };
  return { name: "tailor" };
}

export function routeToHash(r: Route): string {
  switch (r.name) {
    case "tailor":
      return "#/tailor";
    case "projects":
      return "#/projects";
    case "project":
      return r.id === null ? "#/projects/new" : `#/projects/${r.id}`;
    case "profile":
      return "#/profile";
  }
}
