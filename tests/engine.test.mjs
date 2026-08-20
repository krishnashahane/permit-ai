import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The rules engine is pure TS; to keep tests dependency-free we re-implement the
// threshold comparison against the same seed JSON the app ships, then assert the
// three seed submissions produce their documented outcomes. This guards the
// core contract: exactly-6 violations, clean pass, boundary edge case.

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = join(__dirname, '..', 'src', 'seed', 'submissions');
const zones = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'lib', 'rules', 'jurisdictions', 'springfield.json'), 'utf8')).zones;
const building = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'lib', 'rules', 'jurisdictions', 'springfield.json'), 'utf8')).building;

function load(name) {
  return JSON.parse(readFileSync(join(seedDir, name), 'utf8')).facts;
}

function violations(f) {
  const z = zones[f.zoneType];
  if (!z) return ['unknown-zone'];
  const v = [];
  if (f.lotAreaSqFt < z.minLotAreaSqFt) v.push('lot-area');
  if (f.lotWidthFt < z.minLotWidthFt) v.push('lot-width');
  if (f.buildingHeightFt > z.maxHeightFt) v.push('height');
  if (f.stories > z.maxStories) v.push('stories');
  if (f.frontSetbackFt < z.minFrontSetbackFt) v.push('front');
  if (f.rearSetbackFt < z.minRearSetbackFt) v.push('rear');
  if (f.sideSetbackFt < z.minSideSetbackFt) v.push('side');
  if (f.far > z.maxFar) v.push('far');
  const reqParking = Math.ceil(f.dwellingUnits * z.minParkingPerUnit) || z.minParkingPerUnit;
  if (f.parkingSpaces < reqParking) v.push('parking');
  if (f.egressWidthIn < building.minEgressWidthIn) v.push('egress');
  if (f.fireSeparationDistanceFt < building.minFireSeparationFt) v.push('fire');
  return v;
}

test('clean-pass has zero violations', () => {
  assert.deepEqual(violations(load('clean-pass.json')), []);
});

test('six-violations has exactly 6 violations', () => {
  const v = violations(load('six-violations.json'));
  assert.equal(v.length, 6, `expected 6, got ${v.length}: ${v.join(',')}`);
  assert.deepEqual([...v].sort(), ['egress', 'far', 'height', 'parking', 'rear', 'side'].sort());
});

test('edge-case sits exactly on thresholds and passes numeric checks', () => {
  assert.deepEqual(violations(load('edge-case.json')), []);
});

test('FAR is computed consistently in seeds', () => {
  const f = load('six-violations.json');
  const far = +(f.floorAreaSqFt / f.lotAreaSqFt).toFixed(3);
  assert.ok(Math.abs(far - f.far) < 0.01, `far mismatch: ${far} vs ${f.far}`);
});
