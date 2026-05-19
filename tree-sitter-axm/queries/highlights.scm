; Comments
(comment) @comment

; Keywords
"type" @keyword
"stmt" @keyword
":" @punctuation.delimiter

; Type declarations — name and description
(type_declaration name: (identifier) @type.definition)
(type_declaration description: (string) @string)

; stmt type annotation (e.g. the `decision` in `stmt:decision`)
(stmt_keyword type: (identifier) @type)

; Statement id
(statement id: (identifier) @variable.definition)

; Statement string value
(statement value: (string) @string)

; @references inside strings
(reference "@" @label)
(reference id: (identifier) @label)

; Escape sequences inside strings
(escape_sequence) @string.escape
