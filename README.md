# Random Data Generator

Ứng dụng React tạo dữ liệu cân từ file tổng hợp chuyến xe.

## Chạy local

```bash
npm install
npm run dev
```

Chọn file tổng hợp `.xls` hoặc `.xlsx`, kiểm tra số chuyến rồi bấm **Tạo file output**. Ứng dụng dùng danh mục tải trọng xe `DANH SÁCH khoi luong XE TÚ THÁI 2026 ( Mới nhất ).xlsx` làm data source mặc định. File này được đóng gói tại `public/vehicle-catalog.xlsx`.

Muốn dùng danh mục khác, bấm **Chọn data source khác** và chọn file `.xls`, `.xlsx` hoặc `.xlsm` có các cột **BSX MỚI**, **BÌ ĐK**, **BÌ ĐK+100**, **CCCP** và **CCCP+8%**. Với mẫu cũ, cột ngay sau **CCCP** được dùng làm giới hạn tải hàng cao nhất. Bấm **Dùng file mặc định** để khôi phục danh mục tích hợp. Nếu file có biển số trùng, ứng dụng giữ dòng xuất hiện trước và hiển thị cảnh báo.

File input được xử lý trên thiết bị. Ứng dụng bung đúng số chuyến, xáo thứ tự xe ở lượt đầu, giữ thứ tự đó ở các lượt sau và tạo file Excel có khối lượng chẵn chục trong giới hạn của danh mục đã chọn.

## Build

```bash
npm run test
npm run build
npm run package:win
```

Quy tắc nghiệp vụ chi tiết nằm trong [PHAN-TICH-WEB-TAO-DU-LIEU.md](./PHAN-TICH-WEB-TAO-DU-LIEU.md).
