export interface EditorConfigRule {
  key: string;
  value: string | number | boolean;
  description?: string;
}

export interface EditorConfigSection {
  pattern: string;
  rules: EditorConfigRule[];
  description?: string;
}

export const RULE_OPTIONS = {
  charset: [
    { value: "utf-8", label: "UTF-8", hint: "Recommended for most projects" },
    { value: "latin1", label: "Latin-1", hint: "Legacy encoding" },
  ],

  end_of_line: [
    {
      value: "lf",
      label: "LF (Unix)",
      hint: "Recommended for Git compatibility",
    },
    { value: "crlf", label: "CRLF (Windows)", hint: "Windows native" },
    { value: "cr", label: "CR (Classic Mac)", hint: "Rarely used" },
  ],

  indent_style: [
    { value: "space", label: "Spaces", hint: "More consistent across editors" },
    { value: "tab", label: "Tabs", hint: "Allows personal width preference" },
  ],

  indent_size: [
    { value: "2", label: "2", hint: "Common in JS/TS projects" },
    { value: "4", label: "4", hint: "Common in Python/Java" },
    { value: "8", label: "8", hint: "Traditional tab width" },
    { value: "custom", label: "Custom", hint: "Enter your own value" },
  ],

  max_line_length: [
    { value: "80", label: "80", hint: "Traditional terminal width" },
    { value: "100", label: "100", hint: "Common in modern projects" },
    { value: "120", label: "120", hint: "Comfortable for wide screens" },
    { value: "off", label: "No limit", hint: "Let formatter decide" },
    { value: "custom", label: "Custom", hint: "Enter your own value" },
  ],
};

export const RULE_PRESETS = {
  charset: {
    utf8: { key: "charset", value: "utf-8", description: "UTF-8 encoding" },
    latin1: {
      key: "charset",
      value: "latin1",
      description: "Latin-1 encoding",
    },
  },

  endOfLine: {
    lf: { key: "end_of_line", value: "lf", description: "Unix-style (LF)" },
    crlf: {
      key: "end_of_line",
      value: "crlf",
      description: "Windows-style (CRLF)",
    },
    cr: { key: "end_of_line", value: "cr", description: "Old Mac-style (CR)" },
  },

  indentStyle: {
    space: { key: "indent_style", value: "space", description: "Use spaces" },
    tab: { key: "indent_style", value: "tab", description: "Use tabs" },
  },

  indentSize: {
    two: { key: "indent_size", value: 2, description: "2 spaces" },
    four: { key: "indent_size", value: 4, description: "4 spaces" },
    eight: { key: "indent_size", value: 8, description: "8 spaces" },
  },

  trimTrailingWhitespace: {
    yes: {
      key: "trim_trailing_whitespace",
      value: true,
      description: "Remove trailing spaces",
    },
    no: {
      key: "trim_trailing_whitespace",
      value: false,
      description: "Keep trailing spaces",
    },
  },

  insertFinalNewline: {
    yes: {
      key: "insert_final_newline",
      value: true,
      description: "Add newline at EOF",
    },
    no: {
      key: "insert_final_newline",
      value: false,
      description: "No newline at EOF",
    },
  },
};

export const FILE_TYPE_RECOMMENDATIONS = {
  javascript: {
    pattern: "*.{js,jsx,mjs,cjs}",
    description: "JavaScript files",
    recommendedRules: [
      RULE_PRESETS.indentStyle.space,
      RULE_PRESETS.indentSize.two,
    ],
    optionalRules: [
      { key: "max_line_length", value: 100, description: "Line length limit" },
    ],
  },

  typescript: {
    pattern: "*.{ts,tsx}",
    description: "TypeScript files",
    recommendedRules: [
      RULE_PRESETS.indentStyle.space,
      RULE_PRESETS.indentSize.two,
    ],
    optionalRules: [
      { key: "max_line_length", value: 100, description: "Line length limit" },
    ],
  },

  python: {
    pattern: "*.py",
    description: "Python files",
    recommendedRules: [
      RULE_PRESETS.indentStyle.space,
      RULE_PRESETS.indentSize.four,
      {
        key: "max_line_length",
        value: 88,
        description: "Black formatter default",
      },
    ],
    optionalRules: [],
  },

  markdown: {
    pattern: "*.md",
    description: "Markdown files",
    recommendedRules: [RULE_PRESETS.trimTrailingWhitespace.no],
    optionalRules: [
      {
        key: "max_line_length",
        value: 80,
        description: "Readable line length",
      },
    ],
  },

  makefile: {
    pattern: "Makefile",
    description: "Makefiles",
    recommendedRules: [RULE_PRESETS.indentStyle.tab],
    optionalRules: [],
  },

  yaml: {
    pattern: "*.{yml,yaml}",
    description: "YAML files",
    recommendedRules: [
      RULE_PRESETS.indentStyle.space,
      RULE_PRESETS.indentSize.two,
    ],
    optionalRules: [],
  },

  json: {
    pattern: "*.json",
    description: "JSON files",
    recommendedRules: [
      RULE_PRESETS.indentStyle.space,
      RULE_PRESETS.indentSize.two,
    ],
    optionalRules: [],
  },

  css: {
    pattern: "*.{css,scss,sass,less}",
    description: "Style files",
    recommendedRules: [
      RULE_PRESETS.indentStyle.space,
      RULE_PRESETS.indentSize.two,
    ],
    optionalRules: [
      { key: "max_line_length", value: 80, description: "Line length limit" },
    ],
  },
};

export const PROJECT_TYPE_DETECTIONS = {
  react: {
    detect: (deps: Record<string, string>) => deps["react"] || deps["next"],
    fileTypes: ["javascript", "typescript", "css", "json", "yaml", "markdown"],
  },
  node: {
    detect: (deps: Record<string, string>) =>
      deps["express"] || deps["fastify"] || deps["koa"],
    fileTypes: ["javascript", "typescript", "json", "yaml", "markdown"],
  },
  python: {
    detect: (deps: Record<string, string>) =>
      deps["django"] || deps["flask"] || deps["fastapi"],
    fileTypes: ["python", "yaml", "json", "markdown"],
  },
};
