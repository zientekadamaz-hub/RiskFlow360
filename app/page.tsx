import Image from 'next/image'
import { SettingsBackdropTone } from '@/components/rf-ui'
import chartImage from '../main/chart.png'
import matrixImage from '../main/matrix.png'
import pfmeaImage from '../main/pfmea.png'
import pfdImage from '../main/PFD.png'
import projectListImage from '../main/ChatGPT Image 1 maj 2026, 23_38_19.png'

type ModuleCard = {
  title: string
  subtitle: string
  bullets: string[]
}

type ProductPreview = {
  title: string
  eyebrow: string
  description: string
  bullets: string[]
  visual: 'project-list' | 'pfd' | 'pfmea' | 'chart' | 'settings'
}

const modules: ModuleCard[] = [
  {
    title: 'Projects',
    subtitle: 'Process and project control',
    bullets: ['Open project monitoring', 'Site and department context', 'Current revision status'],
  },
  {
    title: 'PFD',
    subtitle: 'Process Flow Diagram',
    bullets: ['Operation map', 'Inputs and outputs', 'Process logic as the base layer'],
  },
  {
    title: 'PFMEA',
    subtitle: 'Risk analysis',
    bullets: ['Failure mode hierarchy', 'Severity, occurrence, detection', 'RPN and action planning'],
  },
  {
    title: 'PCP',
    subtitle: 'Control Plan',
    bullets: ['Controls linked to risks', 'Prevention and detection methods', 'Inspection frequency'],
  },
  {
    title: 'Actions',
    subtitle: 'Execution tracking',
    bullets: ['Owners and due dates', 'Status control', 'Effectiveness follow-up'],
  },
  {
    title: 'Reports',
    subtitle: 'Risk trend visibility',
    bullets: ['RPN Matrix', 'Progress Chart', 'Open risk summaries'],
  },
]

const previews: ProductPreview[] = [
  {
    title: 'Project List as the operating dashboard',
    eyebrow: 'Projects',
    description: 'Start every review from a controlled project list with current status, open risks, average RPN and direct module context.',
    bullets: [
      'Open projects and current risk exposure',
      'Project status and revision visibility',
      'Site, department and product context',
      'Average RPN and open-risk summaries',
      'One place to understand where work should start',
    ],
    visual: 'project-list',
  },
  {
    title: 'Process flow as the source of truth',
    eyebrow: 'PFD',
    description: 'Map operations, decisions and inputs once, then reuse the same process structure in PFMEA and PCP.',
    bullets: [
      'Visual process sequence',
      'Operation-level traceability',
      'Reusable process structure for PFMEA',
      'Clear station and operation ownership',
      'Stable foundation for risk and control data',
    ],
    visual: 'pfd',
  },
  {
    title: 'PFD, PFMEA and PCP connected in one risk-control flow',
    eyebrow: 'PFD / PFMEA / PCP',
    description: 'Start from the PFD process structure, analyze failure modes, effects and causes in PFMEA, then translate the same risk logic into prevention and detection controls in PCP.',
    bullets: [
      'PFD operations reused as the PFMEA structure',
      'Cascading failure mode structure',
      'Severity, occurrence and detection scoring',
      'Controls linked directly to PFMEA risks',
      'PCP content aligned with process steps and causes',
    ],
    visual: 'pfmea',
  },
  {
    title: 'Action Management and Reports for execution control',
    eyebrow: 'Actions / Reports',
    description: 'Turn recommended actions into owned work, then use reports to monitor open risks, RPN Matrix exposure and improvement over time.',
    bullets: [
      'Owners, due dates and action status',
      'Open-risk and action follow-up visibility',
      'RPN Matrix risk count report',
      'Average RPN trend by selected scope',
      'Evidence for management and audit reviews',
    ],
    visual: 'chart',
  },
  {
    title: 'Configurable standards and access',
    eyebrow: 'Settings',
    description: 'Keep risk thresholds, rating scales, organizations, invitations and customer access aligned with the operating model.',
    bullets: [
      'Risk Matrix as a shared standard',
      'Severity, occurrence and detection scales',
      'Organization and license control',
      'Role-based access',
      'Customer visibility per module',
    ],
    visual: 'settings',
  },
]

const proofPoints = [
  ['Traceability', 'Process step -> failure mode -> control -> action -> effectiveness.'],
  ['Consistency', 'One data model reduces disconnected Excel versions and manual synchronization.'],
  ['Governance', 'Roles, organizations, customer access and revision status live in the application.'],
  ['Visibility', 'Projects, RPN Matrix and Progress Chart show current exposure and improvement direction.'],
]

function PfdPreview() {
  return (
    <div className="relative h-full min-h-[324px] overflow-hidden bg-[rgba(40,39,47,0.72)] md:min-h-[396px]">
      <Image
        src={pfdImage}
        alt="RiskFlow 360 PFD process flow diagram preview"
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover"
      />
    </div>
  )
}

function PfmeaPreview() {
  return (
    <div className="relative h-full min-h-[324px] overflow-hidden bg-[rgba(40,39,47,0.72)] md:min-h-[396px]">
      <Image
        src={pfmeaImage}
        alt="RiskFlow 360 PFMEA cascading risk table preview"
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover"
      />
    </div>
  )
}

function ChartPreview() {
  return (
    <div className="relative h-full min-h-[324px] overflow-hidden bg-[rgba(40,39,47,0.72)] md:min-h-[396px]">
      <Image
        src={chartImage}
        alt="RiskFlow 360 Progress Chart report preview"
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover"
      />
    </div>
  )
}

function SettingsPreview() {
  return (
    <div className="relative h-full min-h-[324px] overflow-hidden bg-[rgba(40,39,47,0.72)] md:min-h-[396px]">
      <Image
        src={matrixImage}
        alt="RiskFlow 360 RPN Matrix report preview"
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover"
      />
    </div>
  )
}

function ProjectListPreview() {
  return (
    <div className="relative h-full min-h-[324px] overflow-hidden bg-[rgba(40,39,47,0.72)] md:min-h-[396px]">
      <Image
        src={projectListImage}
        alt="RiskFlow 360 Project List dashboard preview"
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        priority
        className="object-cover"
      />
    </div>
  )
}

function ProductVisual({ visual }: { visual: ProductPreview['visual'] }) {
  if (visual === 'project-list') return <ProjectListPreview />
  if (visual === 'pfd') return <PfdPreview />
  if (visual === 'pfmea') return <PfmeaPreview />
  if (visual === 'chart') return <ChartPreview />
  return <SettingsPreview />
}

function CheckMark() {
  return (
    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d9a86c]" aria-hidden />
  )
}

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#171f33] text-white">
      <SettingsBackdropTone imageStyle={{ position: 'fixed' }} overlayStyle={{ position: 'fixed' }} />

      <div className="relative z-10">
        <section className="relative overflow-hidden">
          <div className="mx-auto w-full px-6 py-14">
            <div className="grid grid-cols-[0.5fr_repeat(6,1fr)_0.5fr] gap-x-0 gap-y-8">
              <div className="col-start-2 col-end-8">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm tracking-wide text-amber-300/90">RiskFlow 360</p>
                    <span className="h-1 w-1 rounded-full bg-white/30" />
                    <p className="text-sm text-white/70">PFD - PFMEA - PCP - Actions</p>
                  </div>

                  <h1 className="mt-2 text-4xl font-semibold leading-tight text-white md:text-5xl">
                    Integrated process risk management
                  </h1>

                  <p className="mt-6 max-w-2xl text-sm leading-6 text-white/80">
                    One application, one data flow: from process (PFD), through risks (PFMEA), to control (PCP) and action execution
                    (Actions Management). Everything is consistent, easy to maintain, and audit-ready.
                  </p>
                </div>
              </div>

              <div className="col-start-2 col-end-8">
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {modules.map((module) => (
                    <div key={module.title} className="min-w-0 rounded-lg border border-white/15 bg-white/5 p-4 text-white">
                      <div>
                        <div className="text-base font-semibold text-white">{module.title}</div>
                        <div className="mt-1 text-sm text-white/75">{module.subtitle}</div>
                      </div>

                      <ul className="mt-3 space-y-1 text-sm text-white/75">
                        {module.bullets.map((bullet) => (
                          <li key={`${module.title}-${bullet}`} className="flex gap-2">
                            <span className="text-[#d9a86c]">-</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full px-6 py-8">
          <div className="grid grid-cols-[0.5fr_repeat(6,1fr)_0.5fr]">
            <div className="col-start-2 col-end-8">
              <div className="mb-6">
                <p className="text-sm font-semibold text-[#d9a86c]">Product capabilities</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Built around the way PFMEA work actually flows</h2>
              </div>

              <div className="grid gap-5">
                {previews.map((preview, index) => (
                  <div key={preview.title} className="grid overflow-hidden rounded-lg border border-white/14 bg-[rgba(40,39,47,0.58)] md:grid-cols-2">
                    <div className={`${index % 2 === 1 ? 'md:order-2' : ''}`}>
                      <ProductVisual visual={preview.visual} />
                    </div>
                    <div className={`flex flex-col justify-center p-6 md:p-8 ${index % 2 === 1 ? 'md:order-1' : ''}`}>
                      <div className="text-base font-semibold text-[#d9a86c]">{preview.eyebrow}</div>
                      <h3 className="mt-2 text-2xl font-semibold text-white">{preview.title}</h3>
                      <p className="mt-3 text-base leading-7 text-white/72">{preview.description}</p>
                      <ul className="mt-5 grid gap-2 text-base text-white/78">
                        {preview.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-2">
                            <CheckMark />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full px-6 py-8">
          <div className="grid grid-cols-[0.5fr_repeat(6,1fr)_0.5fr]">
            <div className="col-start-2 col-end-8">
              <div className="grid gap-5 border-y border-white/14 py-8 md:grid-cols-[1.1fr_1.9fr]">
                <div>
                  <p className="text-sm font-semibold text-[#d9a86c]">Why it matters</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">Less document drift, more controlled risk work</h2>
                  <p className="mt-4 text-sm leading-6 text-white/70">
                    The application is designed to replace disconnected spreadsheets with a single operating layer for process risk,
                    controls, actions and reporting.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {proofPoints.map(([title, text]) => (
                    <div key={title} className="rounded-lg border border-white/12 bg-white/5 p-4">
                      <div className="text-sm font-semibold text-white">{title}</div>
                      <p className="mt-2 text-sm leading-6 text-white/68">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full px-6 py-8">
          <div className="grid grid-cols-[0.5fr_repeat(6,1fr)_0.5fr]">
            <div className="col-start-2 col-end-8">
              <div className="rounded-lg border border-white/14 bg-[rgba(40,39,47,0.58)] p-6">
                <p className="text-sm font-semibold text-[#d9a86c]">Purpose of the platform</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">A controlled environment for process risk reviews.</h2>
                <p className="mt-4 max-w-4xl text-sm leading-6 text-white/70">
                  The home page introduces the operating model: define the process, analyze risk, set controls, assign actions and
                  monitor improvement over time. Day-to-day work continues in the secured application after login.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/14 bg-[rgba(40,39,47,0.38)]">
          <div className="mx-auto w-full px-6 py-5">
            <div className="grid grid-cols-[0.5fr_repeat(6,1fr)_0.5fr]">
              <div className="col-start-2 col-end-8">
                  <div className="flex flex-col gap-3 text-sm text-white/58 md:flex-row md:items-center md:justify-between">
                    <div>Copyright {new Date().getFullYear()} RiskFlow 360. All rights reserved.</div>
                    <div className="text-white/54">PFD - PFMEA - PCP - Actions - Reports</div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
