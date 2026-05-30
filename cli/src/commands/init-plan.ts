import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve, relative } from 'node:path'

const TYPES_TEMPLATE = `\
type task        "a concrete implementation step — small enough to complete in one sitting"
type spike       "a time-boxed investigation to reduce uncertainty before committing to an approach"
type discussion  "a topic that requires a synchronous conversation before work can proceed"
type risk        "something that could derail or delay the plan — distinct from a constraint (fixed limit) or unknown (open question)"
type milestone   "a notable checkpoint or deliverable that marks meaningful progress"
`

function planTemplate(name: string): string {
  return `// Plan: ${name}\n// Add statements below. Global KB types and statements are available via @reference.\n\n`
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function randomChars(n: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  return Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

export async function initPlanCommand(
  name: string,
  dir = '.',
  opts: { import?: string; json?: boolean } = {},
): Promise<void> {
  const parentRoot = resolve(dir)
  const today = new Date().toISOString().slice(0, 10)
  const planDirName = `${today}${randomChars(3)}-${slugify(name)}`
  const planRoot = join(parentRoot, planDirName)

  await mkdir(planRoot, { recursive: true })

  const config: Record<string, unknown> = { include: ['*.axm'] }
  if (opts.import) {
    config.import = relative(planRoot, resolve(opts.import))
  }

  const configPath = join(planRoot, 'axmconfig.json')
  const typesPath = join(planRoot, 'types.axm')
  const planPath = join(planRoot, 'plan.axm')

  await Promise.all([
    writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8'),
    writeFile(typesPath, TYPES_TEMPLATE, 'utf-8'),
    writeFile(planPath, planTemplate(name), 'utf-8'),
  ])

  if (opts.json) {
    console.log(JSON.stringify({ dir: planRoot, files: [configPath, typesPath, planPath] }, null, 2))
  } else {
    console.log(`created: ${planRoot}`)
    console.log(`  ${configPath}`)
    console.log(`  ${typesPath}`)
    console.log(`  ${planPath}`)
  }
}
