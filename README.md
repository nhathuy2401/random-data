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

File `public/vehicle-catalog.xlsm` là catalog giới hạn xe được đóng gói nội bộ, nên người dùng không phải tải file generator thứ hai. Ứng dụng xử lý file input trong trình duyệt, tự bung đúng số chuyến, chỉ xáo thứ tự xe ở lượt đầu và giữ thứ tự đó cho các lượt sau. Những xe có ít chuyến hơn vẫn được lược bỏ ngẫu nhiên từ lượt 2 trở đi. Ứng dụng cũng lưu lịch sử thứ tự ngày trong `localStorage`, sinh khối lượng chẵn chục và tải `.xlsx`.

Các quy tắc nghiệp vụ chi tiết nằm trong [PHAN-TICH-WEB-TAO-DU-LIEU.md](./PHAN-TICH-WEB-TAO-DU-LIEU.md).
