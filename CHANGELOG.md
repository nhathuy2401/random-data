# Lịch sử thay đổi

## Bản cập nhật đóng gói desktop

### Sửa lỗi giao diện React

- Bổ sung import `React` trong `src/App.jsx` để JSX không còn phát sinh lỗi `React is not defined` khi chạy production build.

### Sửa lỗi file Excel output

- Sửa mapping `row.values` của ExcelJS. Dữ liệu trước đây bị lệch một cột vì có phần tử `null` ở đầu mảng; biển số xe bị ghi sang cột F thay vì cột E.
- Bảo đảm bảng chính có đúng các cột `STT`, `CHỦ HÀNG`, `BIỂN SỐ XE`, `LOẠI HÀNG`, `KL TỔNG`, `KL XE`, `KL HÀNG` và `NGƯỜI CÂN`.
- Bổ sung và định dạng bảng đối soát `Biển số xe / Thực tế / Số chuyến`, kèm dòng tổng.
- File mẫu đã tạo lại với 2.502 dòng chuyến, 55 biển số và số chuyến đối soát khớp hoàn toàn.

### Cải thiện định dạng biểu mẫu

- Căn giữa hai khối thông tin công ty và quốc hiệu.
- Định dạng tiêu đề theo bố cục văn bản hành chính Việt Nam.
- Chuyển font file output sang Times New Roman.
- Hiển thị ngày theo dạng `dd/mm/yyyy`.
- Thiết lập khổ A4 ngang, lề in, vùng in và footer số trang.
- Chuyển metadata kỹ thuật như seed và xe đầu/cuối sang sheet `Metadata` ẩn.

### Đóng gói ứng dụng Windows

- Thêm Electron launcher tại `electron/main.cjs`.
- Launcher chạy server nội bộ để giao diện tải được `vehicle-catalog.xlsm` khi chạy độc lập.
- Thêm cấu hình `electron-builder` cho ứng dụng Windows x64 dạng portable.
- Thêm các lệnh:

```powershell
npm run desktop:dev
npm run package:win
```

- File portable đã build:
  `release/Random Data Generator 0.1.0.exe`

### Kiểm tra

- `npm run build` hoàn tất thành công.
- Đã mở thử file portable `.exe` và xác nhận ứng dụng khởi động được.
- Catalog xe được đóng gói bên trong ứng dụng.
