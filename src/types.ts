export type TokenType =
  | "directive"
  | "variable"
  | "string"
  | "comment"
  | "multiline_comment"
  | "unparsed"
  | "punctuation"
  | "operator"
  | "keyword"
  | "identifier"
  | "number"
  | "whitespace"
  | "newline"
  | "text"
  | "unknown";

export interface Token {
  type: TokenType;
  value: string;
}
