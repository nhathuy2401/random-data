import * as XLSX from 'xlsx';

export const STEP = 10;
export const DENSITY_KG_PER_M3 = 1280;
const HISTORY_KEY = 'random-data-generation-history-v1';

const aliases = {
  plate: ['biển số xe', 'biển số', 'bien so xe', 'plate'],
  trips: ['đvt', 'dvt', 'số chuyến', 'so chuyen', 'chuyến', 'trips'],
  volumePerTrip: ['số lượng', 'so luong', 'm3/chuyến', 'm3 chuyen', 'volume per trip'],
  totalVolume: ['tổng cộng', 'tong cong', 'tổng m3', 'tong m3', 'total volume'],
};

function cleanText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\n\r()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePlate(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export function roundToNearest10(value) {
  if (!Number.isFinite(value)) return NaN;
  return Math.floor((value + 5) / STEP) * STEP;
}

export function ceilTo10(value) {
  return Math.ceil(value / STEP) * STEP;
}

export function floorTo10(value) {
  return Math.floor(value / STEP) * STEP;
}

function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  let text = String(value ?? '').trim().replace(/\s/g, '');
  if (!text) return NaN;
  if (text.includes(',') && text.includes('.')) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) text = text.replace(/\./g, '').replace(',', '.');
    else text = text.replace(/,/g, '');
  } else if (text.includes(',')) {
    const parts = text.split(',');
    text = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : text.replace(/,/g, '');
  } else if (text.includes('.')) {
    const parts = text.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) text = text.replace(/\./g, '');
  }
  const valueNumber = Number(text);
  return Number.isFinite(valueNumber) ? valueNumber : NaN;
}

function findHeaderRow(rows) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 30); rowIndex += 1) {
    const values = rows[rowIndex].map(cleanText);
    const plateColumn = values.findIndex((v) => aliases.plate.some((a) => v.includes(cleanText(a))));
    const tripColumn = values.findIndex((v) => aliases.trips.some((a) => v.includes(cleanText(a))));
    if (plateColumn >= 0 && tripColumn >= 0) return { rowIndex, values };
  }
  throw new Error('Không tìm thấy dòng tiêu đề có cột Biển số xe và Số chuyến.');
}

function findColumn(values, names, fallback = -1) {
  return values.findIndex((value) => names.some((name) => value.includes(cleanText(name)))) >= 0
    ? values.findIndex((value) => names.some((name) => value.includes(cleanText(name))))
    : fallback;
}

function inferDate(workbook, fileName) {
  const sheet = workbook.SheetNames[0] || '';
  const titleRows = workbook.SheetNames.map((name) => XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, range: 0, raw: false, defval: '' }).slice(0, 8).flat().join(' ')).join(' ');
  const searchableTitle = cleanText(titleRows);
  const monthYear = searchableTitle.match(/thang\s*(\d{1,2}).{0,20}nam\s*(\d{4})/i);
  const dayMonth = sheet.match(/(\d{1,2})\D+(\d{1,2})/);
  if (monthYear && dayMonth) return `${monthYear[2]}-${monthYear[1].padStart(2, '0')}-${dayMonth[1].padStart(2, '0')}`;
  const iso = searchableTitle.match(/(20\d{2})[-/]([01]?\d)[-/]([0-3]?\d)/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  return new Date().toISOString().slice(0, 10);
}

export function parseInputWorkbook(arrayBuffer, fileName = '') {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false, raw: true });
  let selected;
  let header;
  let rows;
  for (const sheetName of workbook.SheetNames) {
    const candidateRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
    try {
      const candidateHeader = findHeaderRow(candidateRows);
      selected = sheetName;
      header = candidateHeader;
      rows = candidateRows;
      break;
    } catch {
      // Try the next sheet.
    }
  }
  if (!selected) throw new Error('Không tìm thấy sheet dữ liệu phù hợp trong file input.');

  const plateCol = findColumn(header.values, aliases.plate);
  const tripsCol = findColumn(header.values, aliases.trips);
  const totalVolumeCol = findColumn(header.values, aliases.totalVolume, -1);
  const volumePerTripCol = totalVolumeCol >= 0 ? findColumn(header.values, aliases.volumePerTrip, -1) : -1;
  const vehicles = [];
  const warnings = [];
  let emptyRows = 0;
  for (let index = header.rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const firstText = cleanText(row[0]);
    if (firstText.includes('tong cong')) break;
    const plate = normalizePlate(row[plateCol]);
    if (!plate) {
      emptyRows += 1;
      if (emptyRows >= 3) break;
      continue;
    }
    emptyRows = 0;
    const tripCount = parseNumber(row[tripsCol]);
    const totalVolumeM3 = totalVolumeCol >= 0 ? parseNumber(row[totalVolumeCol]) : NaN;
    const volumePerTripM3 = volumePerTripCol >= 0 ? parseNumber(row[volumePerTripCol]) : NaN;
    if (!Number.isInteger(tripCount) || tripCount <= 0) throw new Error(`Dòng ${index + 1}: số chuyến phải là số nguyên dương.`);
    if (!Number.isFinite(totalVolumeM3) && !Number.isFinite(volumePerTripM3)) throw new Error(`Dòng ${index + 1}: thiếu tổng thể tích.`);
    const resolvedTotal = Number.isFinite(totalVolumeM3) ? totalVolumeM3 : tripCount * volumePerTripM3;
    const resolvedPerTrip = Number.isFinite(volumePerTripM3) ? volumePerTripM3 : resolvedTotal / tripCount;
    if (Number.isFinite(volumePerTripM3) && Math.abs(tripCount * volumePerTripM3 - resolvedTotal) > 0.01) {
      warnings.push(`Dòng ${index + 1} (${plate}): số chuyến × m³/chuyến lệch tổng m³; dùng cột Tổng cộng (M3) làm chuẩn.`);
    }
    if (vehicles.some((item) => item.plate === plate)) throw new Error(`Dòng ${index + 1}: biển số ${plate} bị trùng.`);
    vehicles.push({ sourceRow: index + 1, plate, tripCount, volumePerTripM3: resolvedPerTrip, totalVolumeM3: resolvedTotal });
  }
  if (!vehicles.length) throw new Error('Không có dữ liệu xe hợp lệ.');
  const totalTrips = vehicles.reduce((sum, item) => sum + item.tripCount, 0);
  const totalVolumeM3 = vehicles.reduce((sum, item) => sum + item.totalVolumeM3, 0);
  return { fileName, sheetName: selected, date: inferDate(workbook, fileName), vehicles, totalTrips, totalVolumeM3, warnings, targetX: roundToNearest10(totalVolumeM3 * DENSITY_KG_PER_M3) };
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function shuffle(items, random) {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

function buildSequence(vehicles, seed) {
  const random = mulberry32(hashString(seed));
  const remaining = new Map(vehicles.map((item) => [item.plate, item.tripCount]));
  const output = [];
  let round = 0;
  while (output.length < vehicles.reduce((sum, item) => sum + item.tripCount, 0)) {
    const order = shuffle(vehicles, () => random() + (round * 0.000001));
    for (const vehicle of order) {
      if ((remaining.get(vehicle.plate) || 0) > 0) {
        output.push(vehicle.plate);
        remaining.set(vehicle.plate, remaining.get(vehicle.plate) - 1);
      }
    }
    round += 1;
  }
  return output;
}

function loadHistory() {
  try {
    if (typeof localStorage === 'undefined') return [];
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(entry) {
  try {
    if (typeof localStorage === 'undefined') return;
    const history = loadHistory().filter((item) => item.date !== entry.date);
    history.push(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-90)));
  } catch {
    // Generation should still succeed if browser storage is unavailable.
  }
}

function arrangeSequence(vehicles, date) {
  const history = loadHistory();
  const previous = [...history].filter((item) => item.date < date).sort((a, b) => b.date.localeCompare(a.date))[0];
  let chosen = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const seed = `${date}|${attempt}|${vehicles.map((item) => `${item.plate}:${item.tripCount}`).join(',')}`;
    const sequence = buildSequence(vehicles, seed);
    if (!previous || (sequence[0] !== previous.firstPlate && sequence.at(-1) !== previous.lastPlate)) {
      chosen = { seed, sequence, previous };
      break;
    }
  }
  if (!chosen) throw new Error('Không thể tạo thứ tự có xe đầu/cuối khác ngày trước.');
  return chosen;
}

function weightedValue(min, max, usage, random) {
  const values = [];
  let totalWeight = 0;
  for (let value = min; value <= max; value += STEP) {
    const weight = 1 / Math.pow((usage.get(value) || 0) + 1, 2);
    values.push({ value, weight });
    totalWeight += weight;
  }
  let point = random() * totalWeight;
  for (const item of values) {
    point -= item.weight;
    if (point <= 0) return item.value;
  }
  return values.at(-1)?.value ?? min;
}

function weightedCandidate(candidates, random) {
  const total = candidates.reduce((sum, item) => sum + item.capacity, 0);
  let point = random() * total;
  for (const candidate of candidates) {
    point -= candidate.capacity;
    if (point <= 0) return candidate;
  }
  return candidates.at(-1);
}

export function generateRecords(input, catalog) {
  const catalogMap = new Map(catalog.map((item) => [normalizePlate(item.plate), item]));
  const rules = new Map();
  for (const vehicle of input.vehicles) {
    const raw = catalogMap.get(vehicle.plate);
    if (!raw) throw new Error(`Không tìm thấy biển số ${vehicle.plate} trong danh mục giới hạn xe.`);
    const rule = {
      plate: vehicle.plate,
      minCar: ceilTo10(raw.minCarRaw),
      maxCar: floorTo10(raw.maxCarRaw),
      minCargo: ceilTo10(raw.minCargoRaw * 0.93),
      maxCargo: floorTo10(raw.maxCargoRaw),
    };
    if (rule.minCar > rule.maxCar || rule.minCargo > rule.maxCargo) throw new Error(`Khoảng tải không hợp lệ cho ${vehicle.plate}.`);
    rules.set(vehicle.plate, rule);
  }
  const arrangement = arrangeSequence(input.vehicles, input.date);
  const random = mulberry32(hashString(`${arrangement.seed}|weights`));
  const carUsage = new Map();
  const cargoUsage = new Map();
  const records = arrangement.sequence.map((plate, index) => {
    const rule = rules.get(plate);
    if (!carUsage.has(plate)) carUsage.set(plate, new Map());
    if (!cargoUsage.has(plate)) cargoUsage.set(plate, new Map());
    const carValue = weightedValue(rule.minCar, rule.maxCar, carUsage.get(plate), random);
    const cargoValue = weightedValue(rule.minCargo, rule.maxCargo, cargoUsage.get(plate), random);
    carUsage.get(plate).set(carValue, (carUsage.get(plate).get(carValue) || 0) + 1);
    cargoUsage.get(plate).set(cargoValue, (cargoUsage.get(plate).get(cargoValue) || 0) + 1);
    return { index, plate, rule, carWeight: carValue, cargoWeight: cargoValue, totalWeight: carValue + cargoValue };
  });

  const minTotal = records.reduce((sum, record) => sum + record.rule.minCargo, 0);
  const maxTotal = records.reduce((sum, record) => sum + record.rule.maxCargo, 0);
  if (input.targetX < minTotal || input.targetX > maxTotal) throw new Error(`Tổng KL hàng mục tiêu ngoài khoảng cho phép (${minTotal.toLocaleString()}–${maxTotal.toLocaleString()} kg).`);
  let current = records.reduce((sum, record) => sum + record.cargoWeight, 0);
  let difference = input.targetX - current;
  let guard = 0;
  while (difference !== 0) {
    guard += 1;
    if (guard > 1000000) throw new Error('Không thể cân chỉnh tổng KL hàng sau quá nhiều lần thử.');
    const increase = difference > 0;
    const candidates = records.map((record, index) => ({ recordIndex: index, capacity: increase ? record.rule.maxCargo - record.cargoWeight : record.cargoWeight - record.rule.minCargo })).filter((item) => item.capacity >= STEP);
    if (!candidates.length) throw new Error('Không còn chuyến có thể điều chỉnh để đạt tổng KL hàng mục tiêu.');
    const selected = weightedCandidate(candidates, random);
    const record = records[selected.recordIndex];
    record.cargoWeight += increase ? STEP : -STEP;
    record.totalWeight = record.carWeight + record.cargoWeight;
    difference += increase ? -STEP : STEP;
  }
  const countMap = new Map();
  for (const record of records) countMap.set(record.plate, (countMap.get(record.plate) || 0) + 1);
  for (const vehicle of input.vehicles) if (countMap.get(vehicle.plate) !== vehicle.tripCount) throw new Error(`Sai số lượt sau khi sinh dữ liệu cho ${vehicle.plate}.`);
  saveHistory({ date: input.date, firstPlate: records[0].plate, lastPlate: records.at(-1).plate, seed: arrangement.seed, inputHash: `${input.totalTrips}:${input.totalVolumeM3}` });
  return { records, seed: arrangement.seed, firstPlate: records[0].plate, lastPlate: records.at(-1).plate };
}

export async function loadCatalog(url = '/vehicle-catalog.xlsm') {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Không tải được danh mục giới hạn xe tích hợp.');
  const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array', raw: true });
  const sheet = workbook.Sheets['File che SL'] || workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const catalog = [];
  for (let index = 2; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const plate = normalizePlate(row[3]);
    if (!plate) continue;
    const values = [row[5], row[7], row[8], row[9]].map(parseNumber);
    if (values.every(Number.isFinite)) catalog.push({ plate, minCarRaw: values[0], maxCarRaw: values[1], minCargoRaw: values[2], maxCargoRaw: values[3] });
  }
  if (!catalog.length) throw new Error('Danh mục xe tích hợp không có dữ liệu.');
  return catalog;
}

function styleCell(cell, options = {}) {
  cell.font = { name: 'Arial', size: options.size || 10, bold: Boolean(options.bold), color: { argb: 'FF1F2937' } };
  cell.alignment = { vertical: 'middle', horizontal: options.center ? 'center' : 'left', wrapText: true };
  cell.border = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
}

export async function createOutputWorkbook(input, result) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Random Data Generator';
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = workbook.addWorksheet('Sheet1', { views: [{ state: 'frozen', ySplit: 6 }] });
  sheet.columns = [12, 14, 14, 20, 16, 14, 16, 14, 16, 16, 3, 16, 12, 12].map((width) => ({ width }));
  sheet.mergeCells('E1:J1'); sheet.mergeCells('E2:J2'); sheet.mergeCells('E3:J3'); sheet.mergeCells('A4:J4'); sheet.mergeCells('A5:J5');
  sheet.getCell('A1').value = 'CÔNG TY CỔ PHẦN KHOÁNG SẢN QUẢNG TRỊ';
  sheet.getCell('E1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
  sheet.getCell('A2').value = 'TRẠM CÂN ĐIỆN TỬ 60 TẤN';
  sheet.getCell('E2').value = 'ĐỘC LẬP - TỰ DO - HẠNH PHÚC';
  sheet.getCell('A3').value = 'Xã Vĩnh Linh, tỉnh Quảng Trị';
  sheet.getCell('E3').value = '--O-o-O-o-O--';
  sheet.getCell('A4').value = 'BẢNG THỐNG KÊ KHỐI LƯỢNG HÀNG QUA CÂN';
  sheet.getCell('A5').value = `Ngày: ${input.date}    Tổng chuyến: ${input.totalTrips.toLocaleString('vi-VN')}    X: ${input.targetX.toLocaleString('vi-VN')} kg`;
  const headers = ['STT', 'NGÀY CÂN', 'SỐ PHIẾU', 'CHỦ HÀNG', 'BIỂN SỐ XE', 'LOẠI HÀNG', 'KL TỔNG', 'KL XE', 'KL HÀNG', 'NGƯỜI CÂN'];
  headers.forEach((header, column) => { const cell = sheet.getCell(6, column + 1); cell.value = header; styleCell(cell, { bold: true, center: true }); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEFEA' } }; });
  sheet.getRow(6).height = 30;
  for (const [index, record] of result.records.entries()) {
    const rowNumber = index + 7;
    const row = sheet.getRow(rowNumber);
    row.values = [null, index + 1, '', '', 'Cát Vĩnh Tú', record.plate, 'Cát', { formula: `H${rowNumber}+I${rowNumber}`, result: record.totalWeight }, record.carWeight, record.cargoWeight, index === 0 ? 'A.Quy' : ''];
    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, col) => styleCell(cell, { center: [1, 2, 3, 5, 6, 7, 8, 9, 10].includes(col) }));
    [7, 8, 9].forEach((col) => { row.getCell(col).numFmt = '#,##0'; });
  }
  const totalRow = result.records.length + 7;
  sheet.getCell(totalRow, 1).value = 'Tổng cộng'; sheet.mergeCells(`A${totalRow}:B${totalRow}`);
  sheet.getCell(totalRow, 4).value = 'Cát Vĩnh Tú'; sheet.getCell(totalRow, 6).value = 'Cát';
  const carTotal = result.records.reduce((sum, item) => sum + item.carWeight, 0);
  const cargoTotal = result.records.reduce((sum, item) => sum + item.cargoWeight, 0);
  sheet.getCell(totalRow, 7).value = { formula: `H${totalRow}+I${totalRow}`, result: carTotal + cargoTotal };
  sheet.getCell(totalRow, 8).value = { formula: `SUM(H7:H${totalRow - 1})`, result: carTotal };
  sheet.getCell(totalRow, 9).value = { formula: `SUM(I7:I${totalRow - 1})`, result: cargoTotal };
  sheet.getCell(totalRow, 10).value = 'tổng';
  [1, 4, 6, 7, 8, 9, 10].forEach((col) => styleCell(sheet.getCell(totalRow, col), { bold: true, center: col !== 4 }));
  [7, 8, 9].forEach((col) => { sheet.getCell(totalRow, col).numFmt = '#,##0'; });
  sheet.getCell('L6').value = 'Biển số xe'; sheet.getCell('M6').value = 'Thực tế'; sheet.getCell('N6').value = 'Số chuyến';
  input.vehicles.forEach((vehicle, index) => { const row = index + 7; sheet.getCell(`L${row}`).value = vehicle.plate; sheet.getCell(`M${row}`).value = result.records.filter((record) => record.plate === vehicle.plate).length; sheet.getCell(`N${row}`).value = vehicle.tripCount; });
  const auditTotal = input.vehicles.length + 7; sheet.getCell(`M${auditTotal}`).value = input.totalTrips; sheet.getCell(`N${auditTotal}`).value = input.totalTrips;
  for (let row = 6; row <= auditTotal; row += 1) for (let col = 12; col <= 14; col += 1) styleCell(sheet.getCell(row, col), { center: true });
  sheet.getCell('L1').value = 'Metadata'; sheet.getCell('L2').value = 'Ngày'; sheet.getCell('M2').value = input.date; sheet.getCell('L3').value = 'Seed'; sheet.getCell('M3').value = result.seed; sheet.getCell('L4').value = 'Xe đầu'; sheet.getCell('M4').value = result.firstPlate; sheet.getCell('L5').value = 'Xe cuối'; sheet.getCell('M5').value = result.lastPlate;
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return workbook.xlsx.writeBuffer();
}

export function downloadBuffer(buffer, fileName) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = fileName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
