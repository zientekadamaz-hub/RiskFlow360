import Link from 'next/link'

type ModuleCard = {
  href: string
  title: string
  subtitle: string
  bullets: string[]
}

type Section = {
  title: string
  subtitle?: string
  text: string
  imageUrl: string
  bullets: { ok?: boolean; text: string }[]
}

type FooterGroup = {
  title: string
  links: { label: string; href: string }[]
}

const modules: ModuleCard[] = [
  {
    href: '/projects',
    title: 'Projects',
    subtitle: 'Start working with data and process structure',
    bullets: [
      'Project management and status tracking',
      'Quick project selection for PFD / PFMEA / PCP',
      'Consistent IDs and data alignment across modules',
    ],
  },
  {
    href: '/pfd',
    title: 'PFD',
    subtitle: 'Process Flow Diagram',
    bullets: [
      'Model the process flow (operations, decisions, inputs/outputs)',
      'Single source of truth for process steps',
      'Foundation for linking PFMEA and PCP to the same process flow',
    ],
  },
  {
    href: '/pfmea',
    title: 'PFMEA',
    subtitle: 'Process Failure Mode & Effects Analysis',
    bullets: [
      'Risk analysis: FM / Effect / Cause + S-O-D, RPN, OxD',
      'Update risks as the process and data evolve',
      'Generate corrective / preventive action lists',
    ],
  },
  {
    href: '/pcp',
    title: 'PCP',
    subtitle: 'Process Control Plan',
    bullets: [
      'Control plan aligned with PFD steps and PFMEA risks',
      'Prevention and detection controls + frequency / method',
      'Easy to maintain "what we control" vs "why we control"',
    ],
  },
  {
    href: '/actions',
    title: 'Actions Management',
    subtitle: 'Action and effectiveness management',
    bullets: [
      'One action list across all PFMEAs (Owner, Due dates, Status)',
      'Prioritize by RPN/OxD and dates, filter and track progress',
      'Effectiveness evidence and action closure (traceability)',
    ],
  },
  {
    href: '/reports',
    title: 'Reporting',
    subtitle: 'Dashboards and export-ready insights',
    bullets: [
      'Cross-module KPIs and risk trends',
      'Export to PDF/Excel and shareable summaries',
      'Audit-ready reporting for reviews and customers',
    ],
  },
]

const sections: Section[] = [
  {
    title: 'RiskFlow 360',
    subtitle: 'One logic • consistent data • full traceability',
    text:
      'RiskFlow 360 connects the process diagram (PFD), risk analysis (PFMEA), control plan (PCP), and actions management into a single, consistent data path. As a result, risks, controls, and actions are linked to the same process and the same project.',
    imageUrl:
      'https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&w=1800&q=60',
    bullets: [
      { ok: true, text: 'Consistent process steps across PFD -> PFMEA -> PCP.' },
      { ok: true, text: 'Traceability: risk -> control -> action -> effectiveness.' },
      { ok: true, text: 'One database and one "language" for quality and production teams.' },
      { ok: false, text: 'Most common failure without a system: inconsistent Excel versions and missing links.' },
    ],
  },
  {
    title: 'How to work in the system',
    subtitle: 'Recommended flow',
    text:
      'First build the process in PFD, then analyze risks in PFMEA, then set controls in PCP, and manage and close actions in Actions Management.',
    imageUrl:
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1800&q=60',
    bullets: [
      { ok: true, text: '1) Projects -> choose/create a project.' },
      { ok: true, text: '2) PFD -> define steps, decisions, inputs/outputs.' },
      { ok: true, text: '3) PFMEA -> link risks to steps and set S-O-D.' },
      { ok: true, text: '4) PCP -> plan controls for risks (prevention/detection).' },
      { ok: true, text: '5) Actions -> manage actions and their effectiveness.' },
    ],
  },
]

const footerGroups: FooterGroup[] = [
  {
    title: 'Platform',
    links: [
      { label: 'Projects', href: '/projects' },
      { label: 'PFD', href: '/pfd' },
      { label: 'PFMEA', href: '/pfmea' },
      { label: 'PCP', href: '/pcp' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/' },
      { label: 'Contact', href: '/' },
      { label: 'Support', href: '/' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/' },
      { label: 'Terms of Service', href: '/' },
      { label: 'Cookie Notice', href: '/' },
    ],
  },
]

function CheckIcon({ ok }: { ok?: boolean }) {
  const color = ok ? 'text-emerald-600' : 'text-rose-600'
  const label = ok ? '✓' : '✕'
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${color} border-current text-xs font-semibold`}
      aria-hidden
    >
      {label}
    </span>
  )
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="h-full w-full bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(239,68,68,0.28),transparent_55%),radial-gradient(1000px_circle_at_80%_20%,rgba(59,130,246,0.25),transparent_55%),linear-gradient(to_right,rgba(8,10,20,0.9),rgba(8,10,20,0.35))]" />
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&w=1800&q=60')] bg-cover bg-center opacity-15" />
        </div>

        <div className="relative mx-auto w-full px-6 py-14">
          <div className="grid grid-cols-[0.5fr_repeat(6,1fr)_0.5fr] gap-x-0 gap-y-8">
            <div className="col-start-2 col-end-8">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm tracking-wide text-amber-300/90">RiskFlow 360</p>
                  <span className="h-1 w-1 rounded-full bg-white/30" />
                  <p className="text-sm text-white/70">PFD • PFMEA • PCP • Actions</p>
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
              <div className="grid grid-cols-6 gap-3">
                {modules.map((m) => (
                  <div key={m.href} className="min-w-0 rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-base font-semibold text-white">{m.title}</div>
                        </div>
                        <div className="mt-1 text-sm text-white/75">{m.subtitle}</div>
                      </div>
                    </div>

                    <ul className="mt-3 space-y-1 text-sm text-white/75">
                      {m.bullets.map((b, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-white/55">•</span>
                          <span>{b}</span>
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

      <section className="mx-auto w-full px-6 py-10">
        <div className="grid grid-cols-[0.5fr_repeat(6,1fr)_0.5fr]">
          <div className="col-start-2 col-end-8">
            <div className="space-y-8">
              {sections.map((s, idx) => (
                <div key={s.title} className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  <div className="grid grid-cols-1 gap-0 md:grid-cols-5">
                    <div className={`md:col-span-2 ${idx % 2 === 1 ? 'md:order-2' : ''}`}>
                      <div className="h-60 w-full overflow-hidden rounded-t-2xl md:h-full md:rounded-l-2xl md:rounded-tr-none">
                        <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    </div>

                    <div className={`md:col-span-3 ${idx % 2 === 1 ? 'md:order-1' : ''}`}>
                      <div className="p-6 md:p-8">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-semibold">{s.title}</h2>
                          {s.subtitle ? (
                            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                              {s.subtitle}
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-3 text-sm leading-6 text-neutral-700">{s.text}</p>

                        <ul className="mt-5 space-y-2">
                          {s.bullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-neutral-800">
                              <CheckIcon ok={b.ok} />
                              <span className="leading-6">{b.text}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-6 flex flex-wrap gap-2">
                          <Link
                            href="/projects"
                            className="rounded-full border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50"
                          >
                            Projects
                          </Link>
                          <Link href="/pfd" className="rounded-full border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50">
                            PFD
                          </Link>
                          <Link
                            href="/pfmea"
                            className="rounded-full border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50"
                          >
                            PFMEA
                          </Link>
                          <Link href="/pcp" className="rounded-full border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50">
                            PCP
                          </Link>
                          <Link
                            href="/actions"
                            className="rounded-full border border-neutral-200 px-4 py-2 text-sm hover:bg-neutral-50"
                          >
                            Actions
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-neutral-100">
        <div className="mx-auto w-full px-6 py-6">
          <div className="grid grid-cols-[0.5fr_repeat(6,1fr)_0.5fr]">
            <div className="col-start-2 col-end-8">
              <div className="border-b border-neutral-300 pb-4 text-sm leading-6 text-neutral-500">
                RiskFlow 360 connects process flow, risk analysis, control planning, and action management into one consistent system for customer-facing SaaS teams.
              </div>

              <div className="grid gap-8 py-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-sm font-semibold text-neutral-800">RiskFlow 360</div>
                  <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                    <li>Integrated quality planning</li>
                    <li>Traceable change history</li>
                    <li>One data model across modules</li>
                  </ul>
                </div>

                {footerGroups.map((group) => (
                  <div key={group.title}>
                    <div className="text-sm font-semibold text-neutral-800">{group.title}</div>
                    <ul className="mt-3 space-y-2">
                      {group.links.map((link) => (
                        <li key={`${group.title}-${link.label}`}>
                          <Link href={link.href} className="text-sm text-neutral-600 transition hover:text-neutral-900">
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-300 py-4">
                <div className="flex flex-col gap-3 text-sm text-neutral-500 md:flex-row md:items-center md:justify-between">
                  <div>Copyright {new Date().getFullYear()} RiskFlow 360. All rights reserved.</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <Link href="/" className="hover:text-neutral-900">
                      Privacy Policy
                    </Link>
                    <Link href="/" className="hover:text-neutral-900">
                      Terms of Service
                    </Link>
                    <Link href="/" className="hover:text-neutral-900">
                      Cookie Notice
                    </Link>
                    <Link href="/" className="hover:text-neutral-900">
                      Support
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
