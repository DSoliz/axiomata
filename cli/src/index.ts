#!/usr/bin/env node
import { program } from 'commander'
import { checkCommand } from './commands/check.js'
import { indexCommand } from './commands/index-cmd.js'
import { queryCommand } from './commands/query.js'

program
  .name('axm')
  .description('Axiomate knowledge base CLI')
  .version('0.1.0')

program
  .command('check [dir]')
  .description('Validate all .axm files in a knowledge base (default: current directory)')
  .action(checkCommand)

program
  .command('index [dir]')
  .description('List all indexed types and statements (default: current directory)')
  .action(indexCommand)

program
  .command('query <id> [dir]')
  .description('Look up a statement by ID (default: current directory)')
  .action(queryCommand)

program.parse()
