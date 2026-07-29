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

  it("preserves consecutive newline counts for blank lines", () => {
    const tokens = tokenize("a\n\nb");
    expect(tokens).toEqual([
      { type: "identifier", value: "a" },
      { type: "newline", value: "\n\n" },
      { type: "identifier", value: "b" },
    ]);
  });

  it("preserves indentation spaces after newlines", () => {
    const tokens = tokenize("<ul>\n  <li>a</li>\n</ul>");
    expect(tokens).toEqual([
      { type: "markup", value: "<ul>" },
      { type: "newline", value: "\n" },
      { type: "whitespace", value: "  " },
      { type: "markup", value: "<li>" },
      { type: "identifier", value: "a" },
      { type: "markup", value: "</li>" },
      { type: "newline", value: "\n" },
      { type: "markup", value: "</ul>" },
    ]);
  });

  it("tokenizes #@ body macros as directives", () => {
    const tokens = tokenize("#@foo($x)");
    expect(tokens[0]).toEqual({ type: "directive", value: "#@foo" });
  });

  it("tokenizes formal directives", () => {
    const tokens = tokenize("#{if}($x)#{end}");
    expect(tokens.filter((t) => t.type === "directive")).toEqual([
      { type: "directive", value: "#if" },
      { type: "directive", value: "#end" },
    ]);
  });
});
