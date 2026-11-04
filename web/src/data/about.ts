/**
 * The airline's own account of itself.
 *
 * Everything else on this site is generated from the schedule. This is the
 * part that is not: it is written, and it is what the company says about
 * where it came from and what it is for. The two pages that use it — Our
 * story and What we believe — are the only places on the site where a claim
 * is not backed by a row in the database, so each belief is paired with
 * something that is.
 */

export interface Chapter {
  /** Shown as the marker. A year or a span. */
  when: string
  title: string
  body: string
  /** A smaller supporting line: the specific fact under the paragraph. */
  detail?: string
  /** Contradictory versions of the same event, printed without a verdict. */
  accounts?: Array<{ label: string; text: string; hue: string; ink: string }>
  hue: string
  ink: string
}

/**
 * The line the whole company hangs off. It leads the About section, and the
 * beliefs below it are the three things that follow from it.
 */
export const MISSION =
  'Everywhere should be connected to everywhere else, in a way safer than the road.'

export const STORY: Chapter[] = [
  {
    when: '1988',
    title: 'Three Tupolevs, and an argument about the name',
    body:
      'Đổi Mới had opened the door two years earlier, and a group of engineers and pilots walked through it. They started an airline because nobody else was going to — not a businessman with a plan, but the people who already knew how to keep aircraft flying and could not find anyone willing to let them.',
    detail:
      'The first revenue flight was VN-A301, a Tupolev Tu-134, Sài Gòn to Hà Nội.',
    accounts: [
      {
        label: 'The first account',
        text:
          'The name is a flower. That is the whole of it, and the founder who gave this version never elaborated on which flower or why, and was reportedly irritated to be asked.',
        hue: 'var(--color-spectrum-rose)',
        ink: 'var(--color-spectrum-rose-ink)',
      },
      {
        label: 'The second account',
        text:
          'The name is a flower shop in old Sài Gòn — a specific one, on a street that no longer exists under that name. This version is the most detailed and the least verifiable, which is either the point or the problem.',
        hue: 'var(--color-spectrum-amber)',
        ink: 'var(--color-spectrum-amber-ink)',
      },
      {
        label: 'The third account',
        text:
          'The founder dreamt of a time machine, travelled forward in it, heard a song that had not been written yet, and brought back the line we have painted on the side of every aircraft since. This is the version the other two founders liked least and the one nobody has ever managed to disprove.',
        hue: 'var(--color-spectrum-violet)',
        ink: 'var(--color-spectrum-violet-ink)',
      },
    ],
    hue: 'var(--color-spectrum-teal)',
    ink: 'var(--color-spectrum-teal-ink)',
  },
  {
    when: '1989–93',
    title: 'The lean years',
    body:
      'Vietnam Airlines separated from the air force and became the national carrier. We flew what we could keep serviceable, which in those years meant Soviet aircraft and a great deal of improvisation. The engineers who founded the airline spent the first five years proving that was not a disadvantage.',
    hue: 'var(--color-spectrum-lime)',
    ink: 'var(--color-spectrum-lime-ink)',
  },
  {
    when: 'February 1994',
    title: 'The embargo lifts, and we wait',
    body:
      'When the United States lifted its trade embargo, Western aircraft became buyable overnight and everyone expected a rush. We watched instead. We bought used, and late, and paid less for better aeroplanes than the ones we had been told to want.',
    detail:
      'The decision made in that year is still the airline: do not fly where the national carrier flies. Go where nobody goes. Every strange line on our route map traces back to it, and six years later it had bought us widebodies of our own.',
    hue: 'var(--color-spectrum-amber)',
    ink: 'var(--color-spectrum-amber-ink)',
  },
  {
    when: '1997–98',
    title: 'The crisis that missed us',
    body:
      'The Asian Financial Crisis took airlines across the region, and most of what it took were the trunk routes — the dense, prestigious, heavily-financed corridors between capital cities. We had never flown them. The odd little network we had built because it was all that was left to us turned out to be the reason we survived.',
    hue: 'var(--color-spectrum-rose)',
    ink: 'var(--color-spectrum-rose-ink)',
  },
  {
    when: '2000',
    title: 'Our own widebodies',
    body:
      'Six years of buying used and late had paid for something: by the turn of the century we owned widebodies outright rather than leasing them, and we put them where we had always put everything — on the long, thin routes nobody was fighting us for. By 2003 our own 777s were flying as far as Lisbon and Madrid.',
    detail:
      'We still fly Lisbon. Madrid is FORZA’s now, which is what happens to a route when it outgrows the airline that opened it.',
    hue: 'var(--color-spectrum-lime)',
    ink: 'var(--color-spectrum-lime-ink)',
  },
  {
    when: '2003–04',
    title: 'The eighteen months we were nearly taken',
    body:
      'SARS emptied the skies. In the same period the national carrier was struggling with its first 777s while retiring the last of its leased 767s — and ours were flying to Iberia, on time, full, and paid for. A faction inside the state drew the obvious conclusion: hand the widebodies to the operator that had already worked out how to run them.',
    detail:
      'It was not a punishment. We were very nearly absorbed by being admired, which is a far harder thing to refuse than a threat. It took eighteen months to see off, and we have been deliberately, expensively independent ever since.',
    hue: 'var(--color-spectrum-magenta)',
    ink: 'var(--color-spectrum-magenta-ink)',
  },
  {
    when: '2011',
    title: 'FORZA',
    body:
      'Low-cost flying arrived in Vietnam and everyone expected us to defend the trunk routes. We had never flown those either. Instead we founded FORZA to hold the places that mattered to us — the provincial airports where the alternative to a flight is not another airline, it is a very long drive.',
    detail:
      'FORZA is based at thirteen provincial airports Karination does not use. It has its own alliance, its own allowances and its own way of doing things, which was the point.',
    hue: 'var(--color-spectrum-violet)',
    ink: 'var(--color-spectrum-violet-ink)',
  },
  {
    when: '2020–22',
    title: 'What the aeroplanes were for',
    body:
      'When the roads closed, the flying did not. Karination flew its 777-300ERs at medical equipment and supplies by the tonne, because it was the aircraft that could carry the most into the fewest airports. FORZA flew the original E190s at the opposite problem — the provincial strips, the island airports, the towns at the end of a mountain road that was no longer passable — because it was the jet that could get in anywhere. Both airlines grew through those two years, in the one role that mattered.',
    detail:
      'The 777-300ER is still our hardest-worked widebody, fifty frames across fifty-five cities. FORZA’s original E190s have since been replaced by their own successor: twenty E190-E2s now reach fifty-two cities, more of the map than anything else the group flies. It is the period we point at when anyone asks what the mission actually means. For two years, we were the connection.',
    hue: 'var(--color-spectrum-teal)',
    ink: 'var(--color-spectrum-teal-ink)',
  },
  {
    when: '2021–2030',
    title: 'The renewal',
    body:
      'We committed to 574 aircraft in 2021, while much of the world was still grounded. It was not a bet. We had just spent two years watching what happened to communities when the link went, and we ordered on the evidence.',
    detail:
      'The programme runs to 2030 and is still in progress. FORZA’s A350-1000s went from forty aircraft waiting on the register to a hundred and seventy-one in service, Karination’s from twenty-six to a hundred and sixty-one, and the longest flights in the group now belong to a type none of us flew a season ago: the A350-1000ULR. Everything this site tells you about our fleet is a snapshot of a company halfway through re-equipping itself.',
    hue: 'var(--color-spectrum-amber)',
    ink: 'var(--color-spectrum-amber-ink)',
  },
  {
    when: '2024–26',
    title: 'Sonder',
    body:
      'The pandemic ended; the reckoning after it did not. At Incheon, a Korean budget airline that had carried students, fans and weekend travellers across the region ran out of money and stopped flying. Its aircraft went back to the lessors. Its people, its licence and its slots had nowhere to go, and in 2024 we took them in.',
    detail:
      'We did not rebuild a budget airline. We rebuilt what its passengers had been travelling for: Korean food, K-drama and K-pop are the product on board, and the energy is a fan’s, not a flag carrier’s. The name is the point. Sonder is the word for realising that every stranger in the terminal is living a life as vivid and complicated as your own, which, for an airline, is the whole job. Its first schedule went on sale in September 2026: A350-1000s and 787-8s from Incheon, to a network that looks like no one else’s.',
    hue: 'var(--color-spectrum-rose)',
    ink: 'var(--color-spectrum-rose-ink)',
  },
]

export interface Belief {
  title: string
  body: string
  /** The thing on this site that shows it, rather than asserts it. */
  evidence: string
  evidenceHref: string
  evidenceLabel: string
  hue: string
  ink: string
}

export const BELIEFS: Belief[] = [
  {
    title: 'Go where others do not',
    body:
      'The decision we made in 1994 and have never revisited. We do not compete for the corridor between two capitals; we fly to the places that have one flight a day and would otherwise have none. It costs more to run a network shaped like ours, and it is the only reason we are worth having.',
    evidence:
      'Five hundred and seven destinations, most of them served by nobody else from Vietnam.',
    evidenceHref: '/network',
    evidenceLabel: 'See the route map',
    hue: 'var(--color-spectrum-amber)',
    ink: 'var(--color-spectrum-amber-ink)',
  },
  {
    title: 'Independent, and we intend to stay that way',
    body:
      'We were nearly taken into the state in 2003, not because we had failed but because we had not. We have made expensive decisions since then to keep that from being possible again, and we would make them again. An airline that answers to one owner flies where that owner wants. Ours does not.',
    evidence:
      'Still privately held, thirty-eight years after four people and a Tupolev.',
    evidenceHref: '/about',
    evidenceLabel: 'The group today',
    hue: 'var(--color-spectrum-violet)',
    ink: 'var(--color-spectrum-violet-ink)',
  },
]
