/**
 * Destination guide copy.
 *
 * Real-world, factual notes about each city — climate, what it is known for,
 * getting in from the airport. Nothing here claims anything about Karination
 * that the schedule does not already say; the flight facts on each guide page
 * come from the database.
 */
export interface Guide {
  iata: string
  city: string
  localName?: string
  country: string
  blurb: string
  bestTime: string
  gettingIn: string
  highlights: string[]
  currency: string
  language: string
}

export const GUIDES: Guide[] = [
  {
    iata: 'SGN', city: 'Ho Chi Minh City', localName: 'Sài Gòn', country: 'Vietnam',
    blurb:
      'Karination’s home and Vietnam’s largest city — a dense, fast, endlessly hungry place where French colonial boulevards run into motorbike-thick side streets and rooftop bars look down on all of it.',
    bestTime: 'December to April is the dry season, warm and clear. May to November brings short, heavy afternoon downpours.',
    gettingIn: 'Tân Sơn Nhất (SGN) sits about 7 km north of District 1 — roughly 30 minutes by taxi in normal traffic, longer at rush hour.',
    highlights: ['Bến Thành Market', 'War Remnants Museum', 'Củ Chi tunnels', 'Bình Tây in Chợ Lớn'],
    currency: 'Vietnamese đồng (₫)', language: 'Vietnamese',
  },
  {
    iata: 'HAN', city: 'Hanoi', localName: 'Hà Nội', country: 'Vietnam',
    blurb:
      'The capital, and the older soul of the country. The Old Quarter’s thirty-six streets still carry the trades they were named for, and the lakes give the city its pace.',
    bestTime: 'October to April is cooler and drier. Summer is hot and humid with heavy rain.',
    gettingIn: 'Nội Bài (HAN) is 35 km north of the centre, about 45 minutes by road.',
    highlights: ['Hoàn Kiếm Lake', 'The Old Quarter', 'Temple of Literature', 'Train Street'],
    currency: 'Vietnamese đồng (₫)', language: 'Vietnamese',
  },
  {
    iata: 'DAD', city: 'Da Nang', localName: 'Đà Nẵng', country: 'Vietnam',
    blurb:
      'Vietnam’s third city and the one with the beach. Between the Marble Mountains and My Khe’s long sand, it is the base for Hội An and Huế both.',
    bestTime: 'February to May — warm, dry and before the summer crowds. Typhoon season runs September to November.',
    gettingIn: 'Đà Nẵng International (DAD) is unusually central, about 3 km from the riverfront.',
    highlights: ['My Khe Beach', 'Marble Mountains', 'Dragon Bridge', 'Hội An, 45 minutes south'],
    currency: 'Vietnamese đồng (₫)', language: 'Vietnamese',
  },
  {
    iata: 'PQC', city: 'Phú Quốc', country: 'Vietnam',
    blurb:
      'An island in the Gulf of Thailand, most of it national park. Fish sauce, pepper farms, and a west coast that faces the sunset.',
    bestTime: 'November to March is dry and calm. The southwest monsoon runs May to October.',
    gettingIn: 'Phú Quốc International (PQC) is in the south of the island, 15 minutes from Dương Đông.',
    highlights: ['Sao Beach', 'Phú Quốc National Park', 'Dương Đông night market', 'Pepper plantations'],
    currency: 'Vietnamese đồng (₫)', language: 'Vietnamese',
  },
  {
    iata: 'CXR', city: 'Nha Trang', country: 'Vietnam',
    blurb:
      'A long crescent bay on the south-central coast, with Cham towers above the river mouth and diving offshore.',
    bestTime: 'January to August is dry. October and November are the wettest months.',
    gettingIn: 'Cam Ranh (CXR) is 35 km south of Nha Trang, about 45 minutes along the coast road.',
    highlights: ['Po Nagar Cham Towers', 'Hòn Mun diving', 'Nha Trang Beach', 'Ba Hồ waterfalls'],
    currency: 'Vietnamese đồng (₫)', language: 'Vietnamese',
  },
  {
    iata: 'SIN', city: 'Singapore', country: 'Singapore',
    blurb:
      'A city-state that runs like a machine and eats like nowhere else. Hawker centres, shophouses, and a skyline built on reclaimed ground.',
    bestTime: 'Hot and humid year round. February to April is marginally drier.',
    gettingIn: 'Changi (SIN) is 20 km east of the centre, 25 minutes by road or 45 by MRT.',
    highlights: ['Gardens by the Bay', 'Maxwell Food Centre', 'Kampong Glam', 'Southern Ridges walk'],
    currency: 'Singapore dollar (S$)', language: 'English, Malay, Mandarin, Tamil',
  },
  {
    iata: 'BKK', city: 'Bangkok', localName: 'กรุงเทพฯ', country: 'Thailand',
    blurb:
      'Loud, layered and enormous. Gilded temples, canal neighbourhoods and one of the best street food cultures on earth.',
    bestTime: 'November to February is cooler and dry. April is punishingly hot.',
    gettingIn: 'Suvarnabhumi (BKK) is 30 km east; the Airport Rail Link reaches the centre in about 30 minutes.',
    highlights: ['Grand Palace', 'Wat Pho', 'Chatuchak Market', 'Chinatown at night'],
    currency: 'Thai baht (฿)', language: 'Thai',
  },
  {
    iata: 'TPE', city: 'Taipei', country: 'Taiwan',
    blurb:
      'Mountains on every side, hot springs within the city limits, and night markets that are the real reason to come.',
    bestTime: 'October to December is mild and dry. Typhoons are possible July to September.',
    gettingIn: 'Taoyuan (TPE) is 40 km west; the airport MRT runs to Taipei Main in 35 minutes.',
    highlights: ['Taipei 101', 'Shilin Night Market', 'Beitou hot springs', 'Elephant Mountain at dusk'],
    currency: 'New Taiwan dollar (NT$)', language: 'Mandarin',
  },
  {
    iata: 'HND', city: 'Tokyo', localName: '東京', country: 'Japan',
    blurb:
      'Less a single city than a collection of them. Quiet residential lanes sit minutes from the busiest crossings in the world.',
    bestTime: 'Late March to April for blossom, and October to November for clear skies and autumn colour.',
    gettingIn: 'Haneda (HND) is the close-in airport, 30 minutes to central Tokyo by monorail or train.',
    highlights: ['Sensō-ji', 'Shibuya Crossing', 'Tsukiji outer market', 'Yanaka’s old streets'],
    currency: 'Japanese yen (¥)', language: 'Japanese',
  },
  {
    iata: 'HKG', city: 'Hong Kong', country: 'Hong Kong SAR',
    blurb:
      'Vertical, fast and green at the edges. Ferries, trams and escalators do the work of streets, and the hiking starts where the towers stop.',
    bestTime: 'October to December is dry and clear — the best of the year.',
    gettingIn: 'Hong Kong International (HKG) is on Lantau; the Airport Express reaches Central in 24 minutes.',
    highlights: ['Star Ferry', 'Victoria Peak', 'Dragon’s Back hike', 'Temple Street night market'],
    currency: 'Hong Kong dollar (HK$)', language: 'Cantonese, English',
  },
  {
    iata: 'MNL', city: 'Manila', country: 'Philippines',
    blurb:
      'A capital of many centres — Spanish walls at Intramuros, art deco in Escolta, and the country’s best jumping-off point for the islands.',
    bestTime: 'December to February is coolest and driest. Typhoon season peaks July to October.',
    gettingIn: 'Ninoy Aquino (MNL) is close to the city but traffic is heavy; allow well over an hour at peak.',
    highlights: ['Intramuros', 'San Agustin Church', 'Binondo food walk', 'Manila Bay sunset'],
    currency: 'Philippine peso (₱)', language: 'Filipino, English',
  },
  {
    iata: 'KUL', city: 'Kuala Lumpur', country: 'Malaysia',
    blurb:
      'Where Malay, Chinese and Indian Malaysia meet over breakfast. Limestone caves at the edge of town and towers in the middle of it.',
    bestTime: 'Warm year round. May to July is relatively drier.',
    gettingIn: 'KLIA is 55 km south; KLIA Ekspres runs to KL Sentral in 28 minutes.',
    highlights: ['Petronas Towers', 'Batu Caves', 'Jalan Alor food street', 'Merdeka Square'],
    currency: 'Malaysian ringgit (RM)', language: 'Malay, English',
  },
]

export const guideByIata = new Map(GUIDES.map((g) => [g.iata, g]))
export const hasGuide = (iata: string) => guideByIata.has(iata.toUpperCase())
