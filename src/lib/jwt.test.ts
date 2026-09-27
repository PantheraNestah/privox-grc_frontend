import { decodeJwtPayload, getJwtModules } from "./jwt";

/** Builds an unsigned JWT with the given payload (signature is irrelevant). */
function makeJwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

describe("decodeJwtPayload", () => {
  it("reads the modules and org claims", () => {
    const token = makeJwt({ sub: "u1", org: "org-1", modules: ["CORE", "GOVERNANCE"] });
    expect(decodeJwtPayload(token)).toMatchObject({ sub: "u1", org: "org-1" });
    expect(getJwtModules(token)).toEqual(["CORE", "GOVERNANCE"]);
  });

  it("returns null/empty for missing, malformed or non-JWT input", () => {
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    expect(decodeJwtPayload("a.!!!.c")).toBeNull();
    expect(getJwtModules("access-2")).toEqual([]);
    expect(getJwtModules(undefined)).toEqual([]);
  });

  it("ignores non-string entries in the modules claim", () => {
    const token = makeJwt({ modules: ["CORE", 42, null, "GOVERNANCE"] });
    expect(getJwtModules(token)).toEqual(["CORE", "GOVERNANCE"]);
  });
});
