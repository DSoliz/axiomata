#!/usr/bin/env node
import { program } from 'commander'
import { checkCommand } from './commands/check.js'
import { indexCommand } from './commands/index-cmd.js'
import { queryCommand } from './commands/query.js'
import { searchCommand } from './commands/search.js'
import { addCommand } from './commands/add.js'

program
  .name('axm')
  .description('Axiomate knowledge base CLI')
  .version('0.1.0')

program
  .command('check [dir]')
  .description('Validate all .axm files in a knowledge base (default: current directory)')
  .option('--json', 'output as JSON')
  .action((dir = '.', opts) => checkCommand(dir, opts))

program
  .command('index [dir]')
  .description('List all indexed types and statements (default: current directory)')
  .option('--json', 'output as JSON')
  .option('--type <name>', 'filter statements by type')
  .action((dir = '.', opts) => indexCommand(dir, opts))

program
  .command('query <id> [dir]')
  .description('Look up a statement by ID (default: current directory)')
  .option('--json', 'output as JSON')
  .action((id, dir = '.', opts) => queryCommand(id, dir, opts))

program
  .command('search <query> [dir]')
  .description('Search statements by ID and value text (default: current directory)')
  .option('--json', 'output as JSON')
  .option('--type <name>', 'filter results by type')
  .action((query, dir = '.', opts) => searchCommand(query, dir, opts))

program
  .command('add <value> [dir]')
  .description('Add a new statement (auto-generates a unique ID by default)')
  .option('--id <id>', 'use a specific ID instead of auto-generating')
  .option('--type <name>', 'statement type (e.g. decision, unknown)')
  .option('--file <path>', 'target .axm file (required when multiple files exist)')
  .option('--json', 'output as JSON')
  .action((value, dir = '.', opts) => addCommand(value, dir, opts))

program.parse()
