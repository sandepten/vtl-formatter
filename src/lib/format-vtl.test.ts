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
});
