import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { buildSequence, generateRecords, parseCatalogWorkbook, parseInputWorkbook } from './engine.js';

test('new vehicle catalog supplies limits for every vehicle in the existing input', () => {
  const catalog = parseCatalogWorkbook(readFileSync(new URL('../public/vehicle-catalog.xlsx', import.meta.url)));
  const input = parseInputWorkbook(readFileSync(new URL('../input.xls', import.meta.url)), 'input.xls');
  const byPlate = new Map(catalog.map((item) => [item.plate, item]));
  assert.equal(catalog.length, 79);
  assert.equal(catalog.warnings.length, 1);
  assert.deepEqual(byPlate.get('74H-02199'), { plate: '74H-02199', minCarRaw: 7905, maxCarRaw: 8005, minCargoRaw: 6532, maxCargoRaw: 7054.56 });
  for (const plate of ['74H-02179', '74H-02168', '74H-02236', '74H-02189', '74H-02241']) assert.ok(byPlate.has(plate), plate);
  assert.deepEqual(byPlate.get('74H-02224'), { plate: '74H-02224', minCarRaw: 6420, maxCarRaw: 6520, minCargoRaw: 8300, maxCargoRaw: 8964 });
  assert.match(catalog.warnings[0], /Dòng 76: biển số 74H-02224 bị trùng; giữ giới hạn ở dòng xuất hiện sau cùng\./);
  assert.deepEqual(byPlate.get('73H-04440'), { plate: '73H-04440', minCarRaw: 7905, maxCarRaw: 8005, minCargoRaw: 6775, maxCargoRaw: 7317 });
  for (const vehicle of input.vehicles) assert.ok(byPlate.has(vehicle.plate), vehicle.plate);
});

test('legacy catalog can still be supplied as a custom data source', () => {
  const catalog = parseCatalogWorkbook(readFileSync(new URL('../genarate-data.xlsm', import.meta.url)));
  assert.ok(catalog.length > 0);
  assert.deepEqual(catalog.find((item) => item.plate === '73H-04446'), { plate: '73H-04446', minCarRaw: 6745, maxCarRaw: 6850, minCargoRaw: 9060, maxCargoRaw: 9780 });
});

test('input plate without a hyphen matches the full catalog plate', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Biển số xe', 'Số chuyến', 'Tổng cộng (M3)'],
    ['74H02244', 1, 5],
  ]), 'Input');
  const input = parseInputWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), 'input.xlsx');
  const catalog = parseCatalogWorkbook(readFileSync(new URL('../public/vehicle-catalog.xlsx', import.meta.url)));
  assert.equal(input.vehicles[0].plate, '74H-02244');
  assert.ok(catalog.some((item) => item.plate === input.vehicles[0].plate));
});

test('existing input generates records within the new catalog limits', () => {
  const catalog = parseCatalogWorkbook(readFileSync(new URL('../public/vehicle-catalog.xlsx', import.meta.url)));
  const input = parseInputWorkbook(readFileSync(new URL('../input.xls', import.meta.url)), 'input.xls');
  const result = generateRecords({ ...input, date: '2026-10-04' }, catalog);
  assert.equal(result.records.length, input.totalTrips);
  const byPlate = new Map(catalog.map((item) => [item.plate, item]));
  for (const record of result.records) {
    const limits = byPlate.get(record.plate);
    assert.ok(record.carWeight >= limits.minCarRaw && record.carWeight <= limits.maxCarRaw);
    assert.ok(record.cargoWeight >= limits.minCargoRaw * 0.93 && record.cargoWeight <= limits.maxCargoRaw);
  }
});

test('only shuffles the first round and reuses that order for later rounds', () => {
  const vehicles = [
    { plate: 'A', tripCount: 4 },
    { plate: 'B', tripCount: 4 },
    { plate: 'C', tripCount: 4 },
    { plate: 'D', tripCount: 4 },
  ];

  const sequence = buildSequence(vehicles, 'fixed-order-test');
  const firstRound = sequence.slice(0, vehicles.length);

  for (let round = 1; round < 4; round += 1) {
    assert.deepEqual(
      sequence.slice(round * vehicles.length, (round + 1) * vehicles.length),
      firstRound,
    );
  }
});

test('keeps every vehicle in round 1 while randomizing omissions in later rounds', () => {
  const vehicles = [
    { plate: 'A', tripCount: 5 },
    { plate: 'B', tripCount: 3 },
    { plate: 'C', tripCount: 2 },
    { plate: 'D', tripCount: 1 },
  ];

  const sequence = buildSequence(vehicles, 'random-omission-test');
  const firstRound = sequence.slice(0, vehicles.length);
  assert.deepEqual(new Set(firstRound), new Set(vehicles.map((vehicle) => vehicle.plate)));

  for (const vehicle of vehicles) {
    assert.equal(sequence.filter((plate) => plate === vehicle.plate).length, vehicle.tripCount);
  }

  const orderIndex = new Map(firstRound.map((plate, index) => [plate, index]));
  let previousIndex = -1;
  for (const plate of sequence.slice(vehicles.length)) {
    const currentIndex = orderIndex.get(plate);
    if (currentIndex <= previousIndex) previousIndex = -1;
    assert.ok(currentIndex > previousIndex);
    previousIndex = currentIndex;
  }
});
