import { describe, expect, it } from "vitest";
import { formatVtlTemplate } from "@/lib/format-vtl";

describe("formatVtlTemplate", () => {
  it("formats the provided HTML + foreach sample without breaking tags", () => {
    const input = `<ul>
#foreach( $product in $allProducts )
  <li>$product.Name</li>
#end
</ul>`;

    const output = formatVtlTemplate(input);

    expect(output).toBe(`<ul>
#foreach($product in $allProducts)
  <li>$product.Name</li>
#end
</ul>`);
  });

  it("keeps inline mixed text and HTML stable", () => {
    const output = formatVtlTemplate("Hello <b>$name</b>");
    expect(output).toBe("Hello <b>$name</b>");
  });

  it("keeps XML-like tags intact around directives", () => {
    const input = `<root>
#if($ok)<item id="1">$name</item>#end
</root>`;

    const output = formatVtlTemplate(input);

    expect(output).toBe(`<root>
#if($ok)
  <item id="1">$name</item>
#end
</root>`);
  });

  it("preserves JSON-VTL variable mapping behavior", () => {
    const input = `{"name":$name,"meta":{"id":$id}}`;
    const output = formatVtlTemplate(input);

    expect(output).toBe(`{
  "name": $name,
  "meta":
  {
    "id": $id
  }
}`);
  });

  it("applies hybrid-safe cleanup for SQL/plain text with variables", () => {
    const output = formatVtlTemplate("SELECT * FROM users WHERE id=$id");
    expect(output).toBe("SELECT * FROM users WHERE id = $id");
  });

  it("preserves blank lines between plain-text blocks", () => {
    expect(formatVtlTemplate("a\n\nb")).toBe("a\n\nb");
  });

  it("preserves blank lines in email-style templates", () => {
    const input = `Dear $name,

#if($premium)
Thanks for being premium.
#else
Please upgrade.
#end

Bye`;

    expect(formatVtlTemplate(input)).toBe(`Dear $name,

#if($premium)
  Thanks for being premium.
#else
  Please upgrade.
#end

Bye`);
  });

  it("keeps custom macro call args on the same line", () => {
    expect(formatVtlTemplate('#say("World")')).toBe('#say("World")');
  });

  it("formats #return and labeled #break with args attached", () => {
    expect(formatVtlTemplate("#return( $x )")).toBe("#return($x)");
    expect(
      formatVtlTemplate(`#foreach($i in $xs)
#break($foreach)
#end`),
    ).toBe(`#foreach($i in $xs)
  #break($foreach)
#end`);
  });

  it("preserves spaces between #macro parameters", () => {
    expect(
      formatVtlTemplate(`#macro( say $name $age )
Hi $name
#end`),
    ).toBe(`#macro(say $name $age)
Hi $name
#end`);
  });

  it("keeps #set maps and lists compact", () => {
    expect(formatVtlTemplate('#set($map={"a":1,"b":2})')).toBe(
      '#set($map = {"a": 1, "b": 2})',
    );
    expect(formatVtlTemplate("#set($list = [1, 2, 3])")).toBe(
      "#set($list = [1, 2, 3])",
    );
    expect(formatVtlTemplate('#set($x = {"a":{"b":1}})')).toBe(
      '#set($x = {"a": {"b": 1}})',
    );
  });

  it("indents JSON arrays and keeps commas with closing braces", () => {
    expect(formatVtlTemplate('{"items":[$a,$b],"ok":true}')).toBe(`{
  "items": [
    $a,
    $b
  ],
  "ok": true
}`);

    expect(formatVtlTemplate('{"a":[{"x":$x},{"y":$y}]}')).toBe(`{
  "a": [
    {
      "x": $x
    },
    {
      "y": $y
    }
  ]
}`);
  });

  it("formats #@ body macros with indented content", () => {
    expect(
      formatVtlTemplate(`#@foo( $x )
body
#end`),
    ).toBe(`#@foo($x)
  body
#end`);
  });

  it("formats nested if/elseif/else without crashing on extra #end", () => {
    expect(
      formatVtlTemplate(`#if($a)
a
#elseif($b)
b
#else
c
#end`),
    ).toBe(`#if($a)
  a
#elseif($b)
  b
#else
  c
#end`);

    expect(formatVtlTemplate("#end\n#end\nx")).toBe("#end\n#end\nx");
  });

  it("is idempotent for common templates", () => {
    const samples = [
      `#if($a)\nx\n#end`,
      `{"name":$name,"meta":{"id":$id}}`,
      `<ul>\n#foreach($p in $list)\n<li>$p</li>\n#end\n</ul>`,
      `#set($map={"a":1,"b":2})`,
      `#macro(say $name)\nHi $name\n#end\n#say("World")`,
    ];

    for (const sample of samples) {
      const once = formatVtlTemplate(sample);
      expect(formatVtlTemplate(once)).toBe(once);
    }
  });

  it("preserves pure HTML indentation", () => {
    expect(formatVtlTemplate(`<ul>\n  <li>a</li>\n</ul>`)).toBe(
      `<ul>\n  <li>a</li>\n</ul>`,
    );
  });

  it("keeps space before ternary colon in #set", () => {
    expect(formatVtlTemplate("#set($x = $a ? $b : $c)")).toBe(
      "#set($x = $a ? $b : $c)",
    );
  });

  it("formats directive argument commas as ', '", () => {
    expect(formatVtlTemplate('#say( "a" , "b" )')).toBe('#say("a", "b")');
  });
});
