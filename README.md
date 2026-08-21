# Random Data Generator

Web React tự động hóa quy trình tạo dữ liệu cân từ file tổng hợp chuyến xe.

## Chạy local

```bash
npm install
npm run dev
```

Mở URL Vite hiển thị trong terminal. Người dùng chỉ cần chọn file `.xls`/`.xlsx`, kiểm tra bản xem trước và bấm **Tạo file output**.

## Build production

```bash
npm run build
npm run preview
```

File `public/vehicle-catalog.xlsm` là catalog giới hạn xe được đóng gói nội bộ, nên người dùng không phải tải file generator thứ hai. Ứng dụng xử lý file input trong trình duyệt, tự bung đúng số chuyến, lưu lịch sử thứ tự ngày trong `localStorage`, sinh khối lượng chẵn chục và tải `.xlsx`.

Các quy tắc nghiệp vụ chi tiết nằm trong [PHAN-TICH-WEB-TAO-DU-LIEU.md](./PHAN-TICH-WEB-TAO-DU-LIEU.md).
