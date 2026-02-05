# VTL Formatter

A web-based formatter for Apache Velocity Template Language (VTL) code.

**Live Demo:** [vtl-formatter.vercel.app](https://vtl-formatter.vercel.app/)

## Features

- Format and beautify VTL code with proper indentation
- Support for all VTL directives (`#if`, `#foreach`, `#set`, `#macro`, `#parse`, `#include`, etc.)
- Handles variables, method calls, and complex expressions
- Multi-line and single-line comment support
- Silent references (`$!variable`)
- Range operators and alternate value syntax
- All processing done locally in your browser

## Tech Stack

- [Next.js](https://nextjs.org) - React framework
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [TypeScript](https://www.typescriptlang.org) - Type safety

## Development

```bash
# Install dependencies
bun install

# Run development server
bun dev

# Build for production
bun run build
```

## License

MIT

## Author

[Sandeep Kumar](https://github.com/sandepten)
