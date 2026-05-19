module.exports = grammar({
  name: 'axm',

  extras: $ => [/[ \t\r]/],

  rules: {
    source_file: $ => repeat(
      choice($.comment, $.type_declaration, $.statement, $._newline)
    ),

    _newline: $ => /\n/,

    comment: $ => token(seq('//', /.*/)),

    // type <name> "<description>"
    type_declaration: $ => seq(
      field('keyword', 'type'),
      field('name', $.identifier),
      field('description', $.string),
    ),

    // canonical:    stmt[:type] <id> "<value>"
    // value-first:  "<value>" <id> stmt[:type]
    statement: $ => choice(
      seq(
        field('stmt_kw', $.stmt_keyword),
        field('id', $.identifier),
        field('value', $.string),
      ),
      seq(
        field('value', $.string),
        field('id', $.identifier),
        field('stmt_kw', $.stmt_keyword),
      ),
    ),

    stmt_keyword: $ => seq(
      'stmt',
      optional(seq(':', field('type', $.identifier))),
    ),

    identifier: $ => /[a-zA-Z][a-zA-Z0-9_-]*/,

    string: $ => seq(
      '"',
      repeat(choice($.reference, $.escape_sequence, $.string_content)),
      '"',
    ),

    string_content: $ => token.immediate(/[^"@\\]+/),

    reference: $ => seq(
      token.immediate('@'),
      field('id', alias(/[a-zA-Z][a-zA-Z0-9_-]*/, $.identifier)),
    ),

    escape_sequence: $ => token.immediate(seq('\\', /./)),
  },
});
