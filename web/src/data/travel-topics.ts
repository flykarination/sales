/**
 * Travel information topics.
 *
 * One structured record per topic, rendered by a single page component so the
 * whole section stays consistent. Content is real-world accurate for an
 * international carrier: where a rule genuinely varies by country, it says so
 * rather than inventing a number.
 */
export interface TopicSection {
  heading: string
  body?: string
  /** Plain list items. */
  points?: string[]
  /** A small comparison table: header row first. */
  table?: { columns: string[]; rows: string[][] }
  /** Set apart in a tinted panel — the thing people miss. */
  callout?: { title: string; body: string }
}

export interface Topic {
  slug: string
  title: string
  standfirst: string
  /** Design token for the accent, drawn from the spectrum. */
  hue: string
  sections: TopicSection[]
}

export const TOPICS: Topic[] = [
  {
    slug: 'travel-documents',
    title: 'Travel documents and visas',
    standfirst:
      'What you need to carry, and who is responsible for checking it. Entry rules belong to the country you are entering, not to us — but we are the ones who will have to turn you away at the gate if they are not met.',
    hue: '--color-spectrum-violet',
    sections: [
      {
        heading: 'Your passport',
        body:
          'Carry the passport you booked under. The name on your ticket must match it — given name and family name, in that order, exactly as printed on the photo page.',
        points: [
          'Most countries we serve require at least six months validity remaining on arrival. Some accept three. Check before you travel, not at the airport.',
          'You need blank pages for entry and exit stamps; two is a safe minimum.',
          'A damaged passport can be refused at the border even if it is in date.',
        ],
        callout: {
          title: 'Names must match, and we cannot change them after ticketing',
          body:
            'If the name on your booking is wrong, cancel and rebook before you travel. A mismatch is the single most common reason a passenger is denied boarding.',
        },
      },
      {
        heading: 'Visas and entry permits',
        body:
          'Karination flies to 112 countries and every one of them sets its own rules. Whether you need a visa depends on your nationality, your purpose of travel, and how long you are staying — not on which airline you fly.',
        points: [
          'Check the requirements for your own nationality with the destination country’s embassy or immigration service.',
          'An electronic authorisation such as an eTA or ESTA is not a visa but is still required before boarding where it applies.',
          'Transit can need its own visa even when you never leave the airport. This catches people out most often in Europe and North America.',
          'Vietnam operates an e-visa for many nationalities, applied for online before travel.',
        ],
      },
      {
        heading: 'Onward and return tickets',
        body:
          'Many countries require proof that you intend to leave. Immigration officers, and sometimes our own check-in staff acting on their behalf, may ask to see a booked onward or return flight before letting you board.',
      },
      {
        heading: 'Children',
        body:
          'Every passenger needs their own passport, including infants travelling on a lap. Some countries additionally require a letter of consent when a child travels with only one parent or with neither.',
      },
      {
        heading: 'If you are refused entry',
        body:
          'Where a country refuses you entry, we are obliged to carry you back to where you boarded, and the cost of that falls to you. This is why we check documents at the gate — it is not obstruction, it is the rule we fly under.',
      },
    ],
  },
  {
    slug: 'children-and-infants',
    title: 'Children and infants',
    standfirst:
      'Infants under two, children up to eleven, and young people travelling on their own. What each needs, and what we provide.',
    hue: '--color-spectrum-amber',
    sections: [
      {
        heading: 'Who counts as what',
        table: {
          columns: ['Age at travel', 'Category', 'Seat', 'Baggage'],
          rows: [
            ['Under 2', 'Infant', 'On an adult’s lap, or a paid seat with an approved car seat', 'One cabin bag, plus a pushchair carried free'],
            ['2 to 11', 'Child', 'Own seat, always', 'Full adult allowance for the cabin booked'],
            ['12 and over', 'Adult fare', 'Own seat', 'Full adult allowance'],
          ],
        },
        body:
          'Age is taken at the date of travel, not the date of booking. A child who turns two between the outbound and the return needs their own seat for the return.',
      },
      {
        heading: 'Infants',
        points: [
          'One infant per adult. A second infant needs a second accompanying adult aged 16 or over.',
          'Bassinets are available on every widebody in our fleet — the A330, A350, 777-300ER and 777-9 — at the bulkhead. They are limited and assigned in booking order, so ask early.',
          'A pushchair and a car seat travel free and do not count against your checked allowance. Bring the pushchair to the aircraft door and it will be returned to you there.',
          'Infants may not occupy an emergency exit row or the seat beside one.',
        ],
        callout: {
          title: 'Newborns',
          body:
            'We carry infants from seven days old. Between seven and fourteen days we ask for a note from a doctor confirming the baby is fit to fly.',
        },
      },
      {
        heading: 'Children travelling alone',
        body:
          'We accept unaccompanied minors from 5 to 11 years old on direct flights only. The service is free and must be arranged when booking, not at the airport.',
        points: [
          'An adult must stay at the airport until the aircraft has departed, and a named adult must collect the child at the destination with photo identification.',
          'We do not accept unaccompanied minors on itineraries involving a stopover or a connection onto a partner airline.',
          'Children aged 12 to 15 may travel alone as ordinary passengers. The unaccompanied minor service is available to them on request.',
        ],
      },
      {
        heading: 'On board',
        body:
          'Crew will warm a bottle for you and can supply extra blankets. Child meals must be ordered at least 24 hours before departure — see special meals under travel information.',
      },
    ],
  },
  {
    slug: 'restricted-items',
    title: 'What you cannot pack',
    standfirst:
      'Some things cannot fly at all, and others can only travel in one part of the aircraft. Getting this wrong costs you the item at security, and occasionally costs everyone the departure slot.',
    hue: '--color-spectrum-rose',
    sections: [
      {
        heading: 'Never, in either cabin or hold',
        points: [
          'Explosives, fireworks and flares.',
          'Compressed gases, including camping canisters and self-inflating equipment.',
          'Flammable liquids and solids, including lighter fuel, paint and thinners.',
          'Corrosives such as mercury, acids and wet-cell batteries not fitted to a mobility aid.',
          'Oxidisers and organic peroxides, including some pool chemicals.',
          'Any device recalled by its manufacturer for a battery fault.',
        ],
      },
      {
        heading: 'Cabin only, never in the hold',
        body:
          'These must travel with you where a fire can be seen and dealt with. A hold fire cannot.',
        points: [
          'Spare lithium batteries and power banks, terminals taped or in their own pouch.',
          'Electronic cigarettes and vaping devices, which may not be used or charged on board.',
          'Laptops, cameras and phones — pack them in your cabin bag.',
        ],
        callout: {
          title: 'Lithium battery limits',
          body:
            'Up to 100 Wh needs no approval. Between 100 and 160 Wh you may carry two spares with our agreement. Above 160 Wh is refused, except for a mobility aid arranged in advance.',
        },
      },
      {
        heading: 'Hold only, never in the cabin',
        points: [
          'Sharp articles: knives, scissors over 6 cm, tools, razor blades.',
          'Sporting equipment that could be used as a weapon — bats, clubs, cues, poles.',
          'Firearms and ammunition, declared in advance, unloaded and in a locked case.',
        ],
      },
      {
        heading: 'Liquids in the cabin',
        body:
          'Containers of up to 100 ml, together in one transparent resealable bag of about a litre, one bag per passenger. Medicines and baby food needed during the flight are exempt but should be declared at security.',
      },
      {
        heading: 'Duty free bought in transit',
        body:
          'Liquids bought airside may exceed 100 ml if they stay in the sealed tamper-evident bag with the receipt visible. Some countries reopen this at a connection — carry the receipt.',
      },
    ],
  },
  {
    slug: 'pets',
    title: 'Travelling with animals',
    standfirst:
      'Assistance dogs, small pets in the cabin, and animals in the hold. Every country sets its own import rules, and those matter more than ours.',
    hue: '--color-spectrum-teal',
    sections: [
      {
        heading: 'Assistance dogs',
        body:
          'Recognised assistance dogs travel in the cabin free of charge, without a carrier, on any Karination flight. They sit at your feet and must be harnessed. Tell us when you book so the adjacent seat is managed.',
      },
      {
        heading: 'Pets in the cabin',
        points: [
          'Cats and dogs only, at least 16 weeks old.',
          'Combined weight of animal and carrier up to 8 kg.',
          'The carrier must be leak-proof, ventilated, and fit under the seat in front — roughly 45 × 30 × 25 cm.',
          'The animal stays in the carrier for the whole flight.',
          'Two animals per flight in Economy, one in the forward cabins. Booked in order.',
        ],
        callout: {
          title: 'Not on every route',
          body:
            'Some countries prohibit cabin carriage entirely and require animals to travel as manifest cargo, including the United Kingdom. Check the destination rule before booking.',
        },
      },
      {
        heading: 'Pets in the hold',
        body:
          'Larger animals travel in a heated, pressurised hold in an IATA-compliant container. This is arranged as cargo rather than as part of your booking.',
        points: [
          'We do not carry snub-nosed breeds in the hold — bulldogs, pugs, Persian cats and similar — because the risk to them in flight is materially higher.',
          'Animals are not carried in the hold when the forecast temperature at either airport is above 29°C or below 0°C.',
        ],
      },
      {
        heading: 'Paperwork',
        body:
          'You will need a health certificate issued close to travel, proof of rabies vaccination, and often a microchip and an import permit. Requirements differ per country and some impose quarantine on arrival. Start this weeks ahead, not days.',
      },
    ],
  },
  {
    slug: 'health',
    title: 'Health and fitness to fly',
    standfirst:
      'Flying is safe for almost everyone. These are the few situations where we need to know in advance, and what you can do to arrive feeling better.',
    hue: '--color-spectrum-lime',
    sections: [
      {
        heading: 'When we need medical clearance',
        body:
          'Tell us at least 48 hours before departure if any of the following apply. Clearance is free and usually straightforward.',
        points: [
          'You have had surgery in the last ten days, or any surgery involving air being introduced to the body.',
          'You have had a heart attack in the last three weeks or a stroke in the last ten days.',
          'You need oxygen in flight, or use a device we have not already approved.',
          'You have an infectious condition that is still transmissible.',
          'You are travelling on a stretcher or with a medical escort.',
        ],
      },
      {
        heading: 'Pregnancy',
        table: {
          columns: ['Stage', 'What we need'],
          rows: [
            ['Up to 27 weeks', 'Nothing. Travel as normal.'],
            ['28 to 35 weeks', 'A letter from a doctor or midwife dated within ten days of travel, confirming the due date and that you are fit to fly.'],
            ['36 weeks and beyond', 'We cannot carry you. For a multiple pregnancy the limit is 32 weeks.'],
          ],
        },
        body: 'The limits apply to each flight separately, including the return.',
      },
      {
        heading: 'Medication',
        points: [
          'Keep medicines in your cabin bag, in their original labelled packaging, with enough for the journey plus a few days.',
          'Carry a copy of the prescription for anything injectable or controlled.',
          'Needles and syringes are permitted in the cabin when accompanied by the medication they are for.',
        ],
      },
      {
        heading: 'On a long flight',
        body:
          'Our longest sector is over fifteen hours. Move around the cabin every couple of hours, drink water rather than alcohol, and if you are at raised risk of deep vein thrombosis speak to a doctor about compression stockings before you fly.',
      },
      {
        heading: 'If you feel unwell on board',
        body:
          'Tell the crew. Every aircraft carries a medical kit and the crew are trained to use it, and we can reach a doctor on the ground from the flight deck at any point in the flight.',
      },
    ],
  },
  {
    slug: 'disruption',
    title: 'Delays and cancellations',
    standfirst:
      'What we do when a flight does not go as planned, what you are entitled to ask for, and where EU261 and UK261 give you more.',
    hue: '--color-spectrum-magenta',
    sections: [
      {
        heading: 'If your flight is delayed',
        points: [
          'We tell you as soon as we know, on the flight status board and by email to the address on the booking.',
          'Beyond two hours you will be offered refreshments.',
          'Beyond five hours you may choose not to travel and take a full refund instead.',
          'Where an overnight becomes unavoidable, we arrange a hotel and transport to it.',
        ],
      },
      {
        heading: 'If your flight is cancelled',
        body:
          'You choose: the next Karination flight to the same destination at no extra cost, or a full refund. We will not put you on a later flight and treat the matter as closed — the choice is yours to make.',
      },
      {
        heading: 'If you miss a connection because of us',
        body:
          'Where both flights are on one Karination booking and the first runs late, we rebook you onto the next available service at no charge. Where you booked them separately, we cannot — which is the single strongest argument for booking a connection as one itinerary.',
        callout: {
          title: 'Stopover services are one booking',
          body:
            'Our one-stop flights carry a single flight number end to end. If the first leg is late, the connection is our responsibility, not yours.',
        },
      },
      {
        heading: 'Flights to and from Europe and the United Kingdom',
        body:
          'Flights departing an airport in the European Union, Iceland, Norway or Switzerland are covered by EU Regulation 261/2004, and flights departing a United Kingdom airport are covered by its retained UK equivalent, UK261. These give you rights over and above the ones described above, and we apply them as written.',
        points: [
          'They apply to every departure from those airports, whichever airline is flying — including ours.',
          'They do not apply in the other direction. Karination is a Vietnamese carrier, so a flight into Europe or the United Kingdom from outside it falls under our own conditions of carriage instead, which is what the rest of this page sets out.',
          'Care — meals, refreshments and a hotel where a night is unavoidable — is owed whatever the cause of the delay, including weather.',
          'Cash compensation is separate from care, and is not owed where the cause was outside our control: weather, air traffic control, security or a strike we are not party to.',
        ],
      },
      {
        heading: 'What EU261 and UK261 pay',
        body:
          'Payable when you arrive three hours or more late, when a flight is cancelled with less than fourteen days’ notice, or when you are denied boarding on an overbooked flight. The amount depends on the distance of the flight, not on what you paid for it. Halved where we get you there on a re-route within a short window of your original arrival.',
        table: {
          columns: ['Flight distance', 'EU261', 'UK261'],
          rows: [
            ['Up to 1,500 km', '€250', '£220'],
            ['1,500–3,500 km, and any flight within the EU over 1,500 km', '€400', '£350'],
            ['Over 3,500 km', '€600', '£520'],
          ],
        },
        callout: {
          title: 'How to claim',
          body:
            'Nothing to fill in. Where a departure from Europe or the United Kingdom qualifies, we pay it to the original payment method with the refund, and the amount appears against the flight in your booking history.',
        },
      },
      {
        heading: 'Refunds',
        body:
          'A refund goes back to the original payment method. In this world that is instant — cancel from the manage booking page and the money returns immediately, along with the seats.',
      },
    ],
  },
  {
    slug: 'connecting-in-vietnam',
    title: 'Connecting through Vietnam',
    standfirst:
      'What a connection at one of our hubs actually asks of you on the ground — and why a domestic-to-international change needs more time than the clock suggests.',
    hue: '--color-spectrum-amber',
    sections: [
      {
        heading: 'Which kind of connection you have',
        body:
          'Only an international-to-international connection keeps you inside the secure area the whole way. Every other combination takes you back out and in again — through security, and across the border as well when the connection changes between domestic and international.',
        table: {
          columns: ['Your connection', 'What it involves'],
          rows: [
            ['International to international', 'Follow the "Connecting flights" signs. You stay airside.'],
            ['Domestic to domestic', 'Exit through baggage claim and re-enter security.'],
            ['Domestic to international', 'Leave the secure area, clear immigration, and at TP Hồ Chí Minh, Hà Nội and Đà Nẵng, change terminals.'],
            ['International to domestic', 'The same in reverse.'],
          ],
        },
      },
      {
        heading: 'Domestic to international at TP Hồ Chí Minh, Hà Nội or Đà Nẵng',
        body:
          'These three airports keep domestic and international in separate buildings, so this connection is a walk between terminals as well as a border crossing. Allow the full connection time we sell you — we do not sell one that cannot be made, but none of it is spare.',
        points: [
          'Leave the domestic terminal through arrivals and collect any checked bag if it was not tagged through.',
          'Walk or take the shuttle to the international terminal. At all three airports they are within a few minutes of each other.',
          'Check in for the onward flight if you were not given its boarding pass when you started.',
          'Clear immigration and security.',
          'Go to your gate.',
        ],
        callout: {
          title: 'Ask for both boarding passes at the start',
          body:
            'When your whole journey is on one booking, ask at first check-in for the onward boarding pass too. It removes an entire step from the middle of the connection.',
        },
      },
      {
        heading: 'Domestic to international at our other Vietnamese airports',
        body:
          'Everywhere else in Vietnam, domestic and international share one building, so there is no terminal to change — but you still cross the border, which means leaving and re-entering the secure area.',
        points: [
          'Leave through domestic arrivals.',
          'Re-enter the terminal at international departures.',
          'Check in if you do not already hold the onward boarding pass.',
          'Clear immigration and security, then go to your gate.',
        ],
      },
      {
        heading: 'International to domestic',
        body:
          'The same steps in the other order. Clear immigration on arrival, collect your bag if it was not checked through, then move to the domestic terminal — a separate building at TP Hồ Chí Minh, Hà Nội and Đà Nẵng, and the same one everywhere else — and check in there if you need to.',
      },
      {
        heading: 'Domestic to domestic',
        body:
          'Exit through baggage claim and re-enter security. There is no immigration to clear and no terminal to change, but the connection is not made airside, so leave time for the security queue.',
        points: [
          'Leave through domestic arrivals, past baggage claim. Collect your bag if it was not tagged through to your final destination.',
          'Re-enter at domestic departures.',
          'Check in if you do not already hold the onward boarding pass.',
          'Go through security, then to your gate.',
        ],
      },
      {
        heading: 'International to international',
        body:
          'Nothing to do but follow the "Connecting flights" signs from the moment you leave the aircraft. You do not clear immigration, you do not collect your bag, and you do not need to check in again. This is true at every hub we fly from.',
      },
      {
        heading: 'If the first flight is late',
        body:
          'Where both flights are on one Karination booking, the connection is our responsibility and we rebook you onto the next available service at no charge — including when the two flights are on different airlines in the group. Where you booked them separately, we cannot.',
        callout: {
          title: 'Connections we sell are connections we stand behind',
          body:
            'Every itinerary shown as one journey on this site is sold as one booking, whichever of our airlines operates each leg.',
        },
      },
    ],
  },
  {
    slug: 'baggage-claim',
    title: 'Delayed and damaged baggage',
    standfirst:
      'Most bags that do not arrive are simply on the next flight. Here is what to do, and the deadlines that matter.',
    hue: '--color-spectrum-amber',
    sections: [
      {
        heading: 'If your bag does not arrive',
        body:
          'Report it before you leave the airport. Once you are through customs it becomes much harder to trace, and some of the deadlines below start from the moment you leave.',
        points: [
          'Go to the Karination baggage desk in the arrivals hall with your boarding pass and bag receipt.',
          'You will be given a reference. Keep it — everything afterwards runs on that number.',
          'Most delayed bags are located within 24 hours and delivered to your address at our cost.',
        ],
      },
      {
        heading: 'Deadlines',
        table: {
          columns: ['Situation', 'Report within'],
          rows: [
            ['Bag delayed or missing', 'Before leaving the airport'],
            ['Bag damaged', '7 days of receiving it'],
            ['Contents missing', '7 days of receiving it'],
            ['Bag never found', '21 days from the date it should have arrived'],
          ],
        },
      },
      {
        heading: 'What we cover',
        body:
          'Liability for checked baggage follows the Montreal Convention. Fragile, valuable and perishable items are excluded, which is the reason for the rule below.',
        callout: {
          title: 'Do not check anything you cannot replace',
          body:
            'Money, jewellery, electronics, keys, medicine, travel documents and anything irreplaceable belong in your cabin bag. If it is in the hold and it goes missing, we cannot make it right.',
        },
      },
      {
        heading: 'Damaged bags',
        body:
          'Bring the bag and its receipt to the baggage desk. We repair where a bag can be repaired and replace where it cannot. Ordinary wear — scuffs, scratches, a lost pull tab — is not covered.',
      },
    ],
  },
]

export const topicBySlug = new Map(TOPICS.map((t) => [t.slug, t]))
