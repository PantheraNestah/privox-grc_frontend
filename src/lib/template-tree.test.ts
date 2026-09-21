import {
  addChild,
  countNodes,
  duplicateNode,
  emptyNameIds,
  fromRawNode,
  makeNode,
  moveNode,
  parentIds,
  removeNode,
  toRawNode,
  treeDepth,
  validateTree,
  type TreeNode,
} from "./template-tree";

const tree = (): TreeNode =>
  makeNode({
    id: "root",
    name: "Group",
    type: "GROUP",
    children: [
      makeNode({ id: "a", name: "A", children: [makeNode({ id: "a1", name: "A1" })] }),
      makeNode({ id: "b", name: "B" }),
      makeNode({ id: "c", name: "C" }),
    ],
  });

describe("template-tree", () => {
  it("round-trips through the raw API shape", () => {
    const raw = toRawNode(tree());
    expect(raw.children?.map((c) => c.name)).toEqual(["A", "B", "C"]);
    expect(raw.children?.[1].children).toBeUndefined();
    expect(fromRawNode(raw).children[0].children[0].name).toBe("A1");
  });

  it("falls back to DEPARTMENT for unknown types when importing JSON", () => {
    expect(fromRawNode({ name: "X", type: "NOPE" }).type).toBe("DEPARTMENT");
  });

  it("adds and removes nodes anywhere in the tree", () => {
    const withChild = addChild(tree(), "a1", makeNode({ id: "deep", name: "Deep" }));
    expect(treeDepth(withChild)).toBe(4);
    expect(countNodes(removeNode(withChild, "a"))).toBe(3);
  });

  it("duplicates a subtree next to the original with fresh ids", () => {
    const next = duplicateNode(tree(), "a");
    expect(next.children.map((c) => c.name)).toEqual(["A", "A (copy)", "B", "C"]);
    const [original, copy] = next.children;
    expect(copy.id).not.toBe(original.id);
    expect(copy.children[0].id).not.toBe(original.children[0].id);
    expect(copy.children[0].name).toBe("A1");
  });

  it("moves a node among its siblings and ignores moves past the ends", () => {
    expect(moveNode(tree(), "b", -1).children.map((c) => c.id)).toEqual(["b", "a", "c"]);
    expect(moveNode(tree(), "b", 1).children.map((c) => c.id)).toEqual(["a", "c", "b"]);
    const t = tree();
    expect(moveNode(t, "a", -1)).toBe(t);
    expect(moveNode(t, "c", 1)).toBe(t);
  });

  it("reports node counts, depth and collapsible parents", () => {
    expect(countNodes(tree())).toBe(5);
    expect(treeDepth(tree())).toBe(3);
    expect(parentIds(tree())).toEqual(["root", "a"]);
  });

  it("finds nodes with blank names and describes the first one", () => {
    const t = updateName(tree(), "a1", "  ");
    expect([...emptyNameIds(t)]).toEqual(["a1"]);
    expect(validateTree(t)).toBe("root › child 1 › child 1 needs a name");
    expect(validateTree(tree())).toBeNull();
  });
});

function updateName(t: TreeNode, id: string, name: string): TreeNode {
  if (t.id === id) return { ...t, name };
  return { ...t, children: t.children.map((c) => updateName(c, id, name)) };
}
