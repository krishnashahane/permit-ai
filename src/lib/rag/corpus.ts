import type { CodeChunk } from '@/lib/types';

// Embedded code corpus for the sample jurisdiction: local Zoning Code + IBC/IRC
// + fire-code excerpts. In production these live in Postgres/pgvector with real
// embeddings; here retrieval is lexical (see retrieve.ts) over the same chunks.
// Text is paraphrased/mocked but realistic — NOT the verbatim model codes.

export const CORPUS: CodeChunk[] = [
  {
    id: 'zc-12-4',
    title: 'Yard and Setback Requirements (R-1)',
    citation: 'Zoning Code §12.4',
    category: 'setbacks',
    text: 'In the R-1 district, every lot shall provide a front yard of not less than 20 feet, a rear yard of not less than 20 feet, and side yards of not less than 6 feet each. Setbacks are measured as the horizontal distance from the property line to the nearest point of the building foundation. Eaves and uncovered steps may project no more than 2 feet into a required yard.',
  },
  {
    id: 'zc-13-4',
    title: 'Yard and Setback Requirements (R-2)',
    citation: 'Zoning Code §13.4',
    category: 'setbacks',
    text: 'In the R-2 district, the minimum front yard is 15 feet, the minimum rear yard is 15 feet, and each side yard shall be not less than 5 feet. Corner lots shall provide a street-side yard equal to the front yard requirement.',
  },
  {
    id: 'zc-12-3',
    title: 'Height Limits (Residential)',
    citation: 'Zoning Code §12.3',
    category: 'height',
    text: 'Building height in the R-1 district shall not exceed 35 feet, and shall not exceed 2 stories above grade plane. Height is measured from the average finished grade to the midpoint of the highest roof. Chimneys and vents are exempt.',
  },
  {
    id: 'zc-12-5',
    title: 'Floor Area Ratio',
    citation: 'Zoning Code §12.5',
    category: 'far',
    text: 'The floor area ratio (FAR) is the gross floor area of all buildings on a lot divided by the lot area. The maximum FAR in the R-1 district is 0.5 and in the R-2 district is 0.75. Unfinished basements and detached accessory structures under 200 sq ft are excluded from gross floor area.',
  },
  {
    id: 'zc-12-8',
    title: 'Off-Street Parking',
    citation: 'Zoning Code §12.8',
    category: 'parking',
    text: 'Each dwelling unit in a residential district shall provide off-street parking: 2 spaces per unit in R-1, and 1.5 spaces per unit in R-2 (fractions rounded up). Required spaces shall be a minimum of 9 by 18 feet and shall not obstruct a required egress path. A parking reduction may be granted where transit access is demonstrated.',
  },
  {
    id: 'ibc-1005',
    title: 'Egress Width — Means of Egress Sizing',
    citation: 'IBC §1005.1 / §1010.1.1',
    category: 'egress',
    text: 'The required capacity of means of egress shall not be less than required by this section. The minimum clear width of a door opening in a means of egress shall be 32 inches, measured between the face of the door and the stop with the door open 90 degrees. Corridors serving an occupant load of 50 or more shall be not less than 44 inches wide.',
  },
  {
    id: 'irc-r311',
    title: 'Egress — One- and Two-Family Dwellings',
    citation: 'IRC §R311.2',
    category: 'egress',
    text: 'Not less than one egress door shall be provided for each dwelling unit. The egress door shall provide a clear width of not less than 32 inches. The floor or landing at the egress door shall not be more than 1.5 inches lower than the top of the threshold.',
  },
  {
    id: 'ibc-705',
    title: 'Fire Separation Distance and Exterior Walls',
    citation: 'IBC §705.8 / Table 602',
    category: 'fire',
    text: 'Exterior walls with a fire separation distance of less than 5 feet shall have a fire-resistance rating and openings shall be limited. Where the fire separation distance is 5 feet or greater, unprotected openings are permitted subject to area limits. Fire separation distance is measured at right angles from the exterior wall to the closest lot line or assumed imaginary line between buildings.',
  },
  {
    id: 'irc-r302',
    title: 'Fire-Resistant Construction (Dwellings)',
    citation: 'IRC §R302.1',
    category: 'fire',
    text: 'Exterior walls of dwellings with a fire separation distance less than 5 feet shall be not less than 1-hour fire-resistance rated with exposure from both sides. Projections shall not extend to within 2 feet of the lot line. Openings are not permitted where the fire separation distance is less than 3 feet.',
  },
  {
    id: 'ibc-1104',
    title: 'Accessible Route',
    citation: 'IBC §1104 / ADA 206',
    category: 'accessibility',
    text: 'At least one accessible route shall connect accessible building or facility entrances with all accessible spaces and elements. The accessible route shall not pass through kitchens, storage rooms, or similar spaces. Running slope shall not exceed 1:20 except at ramps, where the maximum slope is 1:12 with landings. Where parking is provided, an accessible route shall connect accessible parking to the accessible entrance.',
  },
  {
    id: 'zc-18-2',
    title: 'Design Review Standards',
    citation: 'Zoning Code §18.2',
    category: 'design',
    text: 'Projects in a design-review overlay shall demonstrate compatibility with the surrounding streetscape in massing, roof form, fenestration rhythm, and materials. Exterior materials shall be durable and of a quality consistent with the district character; large blank facades exceeding 20 feet without articulation are discouraged. The review body may condition approval on material samples.',
  },
  {
    id: 'zc-11-1',
    title: 'Zoning Districts and Variances',
    citation: 'Zoning Code §11.1',
    category: 'zoning',
    text: 'No building shall be erected except in conformance with the regulations of the district in which it is located. Where strict application creates a practical difficulty or unnecessary hardship, the applicant may petition the Board of Adjustment for a variance. A variance requires a public hearing and findings that it does not alter the essential character of the neighborhood.',
  },
];

export function corpusByCategory(category: string): CodeChunk[] {
  return CORPUS.filter((c) => c.category === category);
}
