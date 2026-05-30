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

    // <type> <id> "<value>"
    statement: $ => seq(
      field('type', $.identifier),
      field('id', $.identifier),
      field('value', $.string),
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
