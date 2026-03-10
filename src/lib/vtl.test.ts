import { describe, expect, it } from "vitest";
import { tokenize } from "@/lib/vtl";

describe("tokenize", () => {
  it("keeps HTML tags as markup tokens", () => {
    const tokens = tokenize('<li class="x">$name</li>');
    expect(tokens).toEqual([
      { type: "markup", value: '<li class="x">' },
      { type: "variable", value: "$name" },
      { type: "markup", value: "</li>" },
    ]);
  });

  it("does not treat comparison operators as markup", () => {
    const tokens = tokenize("#if($a < $b)#end");
    const operatorToken = tokens.find(
      (token) => token.type === "operator" && token.value === "<",
    );
    expect(operatorToken).toBeDefined();
  });

  it("groups unknown literal sequences as raw_text", () => {
    const tokens = tokenize("@@@");
    expect(tokens).toEqual([{ type: "raw_text", value: "@@@" }]);
  });
});
