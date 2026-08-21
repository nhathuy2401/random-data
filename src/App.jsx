import React, { useEffect, useRef, useState } from 'react';
import {
  DENSITY_KG_PER_M3,
  createOutputWorkbook,
  downloadBuffer,
  generateRecords,
  loadCatalog,
  parseInputWorkbook,
} from './engine.js';

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: digits });
}

function Stat({ label, value, detail }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

function App() {
  const inputRef = useRef(null);
  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState('loading');
  const [file, setFile] = useState(null);
  const [input, setInput] = useState(null);
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    loadCatalog()
      .then((items) => { setCatalog(items); setCatalogState('ready'); })
      .catch((error) => { setCatalogState('error'); setMessage(error.message); });
  }, []);

  async function handleFile(nextFile) {
    if (!nextFile) return;
    if (!/\.(xls|xlsx)$/i.test(nextFile.name)) {
      setStatus('error'); setMessage('Chỉ nhận file .xls hoặc .xlsx.'); return;
    }
    setStatus('reading'); setMessage('Đang đọc file input…'); setFile(nextFile); setInput(null);
    try {
      const parsed = parseInputWorkbook(await nextFile.arrayBuffer(), nextFile.name);
      setInput(parsed); setDate(parsed.date); setStatus('ready'); setMessage(parsed.warnings.length ? `Đã đọc xong với ${parsed.warnings.length} cảnh báo; hệ thống vẫn dùng cột Tổng cộng (M3) làm chuẩn.` : 'Đã đọc xong. Có thể tạo file output.');
    } catch (error) {
      setStatus('error'); setMessage(error.message || 'Không đọc được file input.');
    }
  }

  async function handleGenerate() {
    if (!input || !catalog.length) return;
    setStatus('generating'); setMessage('Đang bung chuyến và sinh khối lượng…');
    try {
      const configuredInput = { ...input, date: date || input.date };
      const result = generateRecords(configuredInput, catalog);
      setMessage('Đang tạo file Excel output…');
      const buffer = await createOutputWorkbook(configuredInput, result);
      const safeDate = configuredInput.date.replace(/[^0-9-]/g, '') || 'output';
      downloadBuffer(buffer, `output-${safeDate}.xlsx`);
      setStatus('success');
      setMessage(`Đã tạo ${formatNumber(result.records.length)} chuyến. Xe đầu: ${result.firstPlate} · xe cuối: ${result.lastPlate}.`);
    } catch (error) {
      setStatus('error'); setMessage(error.message || 'Không thể tạo file output.');
    }
  }

  const ready = Boolean(input && catalog.length && status !== 'generating');

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">RD</div>
        <div><p className="eyebrow">AUTOMATED WORKBOOK</p><h1>Random Data Generator</h1></div>
        <div className="topbar-status"><i className={catalogState === 'ready' ? 'dot online' : 'dot'} />{catalogState === 'ready' ? 'Catalog sẵn sàng' : 'Đang tải catalog'}</div>
      </header>

      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">INPUT → OUTPUT</p><h2>Biến bảng chuyến xe thành dữ liệu cân hoàn chỉnh.</h2><p>Upload một file tổng hợp, hệ thống tự bung đủ lượt xe, xáo thứ tự theo ngày, sinh khối lượng chẵn chục và tải xuống Excel.</p></div>
        <div className="hero-rule"><span>10 kg</span><small>đơn vị chuẩn</small></div>
      </section>

      <section className="workspace">
        <div className="panel upload-panel">
          <div className="panel-heading"><div><p className="eyebrow">01 / INPUT</p><h3>Chọn file tổng hợp</h3></div><span className="step-badge">.XLS · .XLSX</span></div>
          <input ref={inputRef} type="file" accept=".xls,.xlsx" hidden onChange={(event) => handleFile(event.target.files?.[0])} />
          <button className={`dropzone ${dragging ? 'dragging' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files?.[0]); }}>
            <span className="upload-icon">↑</span><strong>{file ? file.name : 'Kéo file vào đây hoặc bấm để chọn'}</strong><small>Hệ thống tự tìm sheet và dòng tiêu đề phù hợp</small>
          </button>
          {file && <div className="file-line"><span className="file-type">XLS</span><span>{file.name}</span><button onClick={() => { setFile(null); setInput(null); setStatus('idle'); setMessage(''); }}>Xóa</button></div>}
        </div>

        <div className="panel rules-panel">
          <div className="panel-heading"><div><p className="eyebrow">02 / RULES</p><h3>Thông số tự động</h3></div><span className="lock">AUTO</span></div>
          <div className="rule-grid"><div><span>Mật độ hàng</span><strong>{formatNumber(DENSITY_KG_PER_M3)} kg/m³</strong></div><div><span>Bước khối lượng</span><strong>10 kg</strong></div><div><span>Thứ tự ngày</span><strong>Seed + lịch sử</strong></div><div><span>Giới hạn</span><strong>Catalog xe</strong></div></div>
          <label className="date-field">Ngày dữ liệu<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </div>
      </section>

      {input && <section className="summary-grid"><Stat label="Biển số" value={formatNumber(input.vehicles.length)} detail={input.sheetName} /><Stat label="Tổng chuyến" value={formatNumber(input.totalTrips)} detail="bung đúng số lượt" /><Stat label="Tổng thể tích" value={`${formatNumber(input.totalVolumeM3, 2)} m³`} detail="từ file input" /><Stat label="X mục tiêu" value={`${formatNumber(input.targetX)} kg`} detail="đã làm tròn chẵn chục" /></section>}

      {input?.warnings?.length > 0 && <section className="warning-box"><strong>Đã phát hiện {input.warnings.length} dòng lệch m³/chuyến</strong><span>{input.warnings.slice(0, 2).join(' · ')}{input.warnings.length > 2 ? ' · …' : ''}</span></section>}

      {input && <section className="panel preview-panel"><div className="panel-heading"><div><p className="eyebrow">03 / VERIFY</p><h3>Kiểm tra số lượt trước khi tạo</h3></div><span className="check-pill">✓ {formatNumber(input.totalTrips)} dòng cần sinh</span></div><div className="table-wrap"><table><thead><tr><th>Biển số</th><th>Số chuyến</th><th>Tổng m³</th><th>Trạng thái</th></tr></thead><tbody>{input.vehicles.slice(0, 8).map((vehicle) => <tr key={vehicle.plate}><td className="plate">{vehicle.plate}</td><td>{formatNumber(vehicle.tripCount)}</td><td>{formatNumber(vehicle.totalVolumeM3, 2)}</td><td><span className="valid">Sẵn sàng</span></td></tr>)}</tbody></table></div>{input.vehicles.length > 8 && <p className="table-note">Đang hiển thị 8/{formatNumber(input.vehicles.length)} xe. Tất cả xe sẽ được kiểm tra khi tạo.</p>}</section>}

      <section className="action-row"><div className={`message ${status}`}>{status === 'success' ? '✓ ' : status === 'error' ? '!' : ''}{message || 'Chưa có file input.'}</div><button className="generate-button" disabled={!ready} onClick={handleGenerate}><span>{status === 'generating' ? 'Đang xử lý…' : 'Tạo file output'}</span><b>→</b></button></section>
      <footer><span>Client-side processing · File không rời khỏi thiết bị</span><span>Chẵn chục · Không vượt tải · Đúng số lượt</span></footer>
    </main>
  );
}

export default App;
