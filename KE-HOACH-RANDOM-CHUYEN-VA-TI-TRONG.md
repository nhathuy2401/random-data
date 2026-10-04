# Kế hoạch random vị trí chuyến và nhập tỉ trọng

## 1. Mục tiêu

Thực hiện hai thay đổi nghiệp vụ:

1. Khi số chuyến của một biển số nhỏ hơn số vòng tối đa, các lượt bị loại phải nằm ở vị trí ngẫu nhiên trong toàn bộ dải chuyến, không bị loại liên tục từ dưới lên.
2. Cho phép người dùng nhập tỉ trọng trên giao diện để tính lại `X mục tiêu`, vì tỉ trọng có thể thay đổi theo từng lần tạo dữ liệu.

File dùng để kiểm thử:

`SỐ CHUYẾN VTU 14.15.19.20.21.23.THANG 4 ĐỢT 2 LÔ 32.587,79.xls`

Thông tin đọc được từ file:

- Sheet: `14.15.19.20.21.22.23`.
- Ngày suy ra: `14/04/2026`.
- Số biển số: 65.
- Tổng số chuyến: 5.690.
- Tổng thể tích: 32.587,79 m³.
- Số chuyến nhỏ nhất/lớn nhất của một xe: 23/91.

## 2. Hiện trạng thuật toán số chuyến

Hàm `buildSequence` hiện chạy theo vòng `round-robin`:

```text
Vòng 1: lấy tất cả xe còn chuyến
Vòng 2: lấy tất cả xe còn chuyến
...
Vòng N: xe nào hết số chuyến thì không lấy nữa
```

Thứ tự xe bên trong mỗi vòng có được shuffle, nhưng vòng xuất hiện của từng xe không random.

Ví dụ số vòng tối đa là 91 và xe A có 57 chuyến:

```text
Hiện tại: xe A xuất hiện ở vòng 1 đến 57
          xe A bị thiếu hoàn toàn ở vòng 58 đến 91
```

Hiệu ứng này tương đương với việc tạo đủ 91 lượt rồi xóa 34 lượt từ dưới lên.

## 3. Thuật toán random vị trí chuyến đề xuất

Không cần tạo dữ liệu thừa rồi xóa vật lý. Có thể chọn ngẫu nhiên trước các vòng mà mỗi xe được phép xuất hiện:

1. Lấy `maxTrips` là số chuyến lớn nhất trong danh sách xe.
2. Shuffle danh sách xe đúng một lần để chốt thứ tự của vòng đầu.
3. Vòng đầu luôn chọn đủ tất cả xe; không được lược bỏ xe ở vòng này.
4. Với từng biển số, tạo danh sách vòng từ `1` đến `maxTrips - 1`, shuffle bằng bộ random có seed rồi chọn thêm đúng `tripCount - 1` vòng.
5. Duyệt lần lượt tất cả vòng theo thứ tự xe đã chốt ở vòng đầu; ở mỗi vòng chỉ lọc ra các xe được chọn xuất hiện.
6. Không shuffle lại từng vòng. Vì vậy xe chỉ bị lược bỏ ngẫu nhiên ở các vòng sau, còn thứ tự tương đối luôn giống vòng đầu.
7. Kiểm tra lại số lần xuất hiện của từng biển số phải bằng tuyệt đối số chuyến trong input.

Ví dụ xe A có 57 chuyến trên tổng 91 vòng:

```text
Chọn random đúng 57 vị trí trong 91 vị trí.
34 vị trí còn lại được phân tán ngẫu nhiên từ đầu đến cuối.
```

Yêu cầu đối với seed:

- Cùng ngày, cùng input và cùng seed phải sinh lại đúng một thứ tự.
- Ngày hoặc input khác phải cho phân bố khác.
- Mỗi `attempt` trong logic kiểm tra xe đầu/cuối phải tạo một tập vòng khác.
- Random vị trí không được làm thay đổi tổng số chuyến của bất kỳ xe nào.

Pseudocode:

```js
maxTrips = max(vehicles.tripCount)

fixedVehicleOrder = shuffle(vehicles, seededRandom)

for each vehicle:
  laterRounds = [1, 2, ..., maxTrips - 1]
  selectedRounds[vehicle.plate] = new Set([
    0,
    ...shuffle(laterRounds, seededRandom).slice(0, vehicle.tripCount - 1)
  ])

for round from 0 to maxTrips - 1:
  activeVehicles = fixedVehicleOrder where selectedRounds[plate] contains round
  output.push(...activeVehicles)
```

## 4. Công thức `X mục tiêu` hiện tại

Code hiện tại dùng tỉ trọng cố định:

```text
DENSITY_KG_PER_M3 = 1.280 kg/m³
STEP = 10 kg
```

Công thức:

```text
Tổng thể tích = tổng cột "Tổng cộng (M3)" của tất cả xe
X thô = Tổng thể tích × Tỉ trọng
X mục tiêu = làm tròn X thô đến 10 kg gần nhất
```

Hàm làm tròn hiện tại:

```js
Math.floor((value + 5) / 10) * 10
```

Với file kiểm thử mới:

```text
X thô = 32.587,79 × 1.280
      = 41.712.371,2 kg

X mục tiêu = 41.712.370 kg
```

## 5. Thêm field tỉ trọng trên UI

### Thiết kế field

- Tên field: `Tỉ trọng hàng`.
- Đơn vị hiển thị rõ: `kg/m³`.
- Giá trị mặc định: `1280`.
- Kiểu nhập: số dương; cho phép thay đổi trước khi tạo output.
- Không cho tạo file nếu tỉ trọng rỗng, bằng 0, âm hoặc không phải số hợp lệ.

Đơn vị cần thống nhất là `kg/m³`. Nếu nghiệp vụ muốn nhập theo `tấn/m³`, giao diện phải ghi rõ và quy đổi sang `kg/m³` bằng cách nhân 1.000 trước khi tính.

### Luồng tính mới

1. Đọc file input và lấy `totalVolumeM3`.
2. Hiển thị tỉ trọng mặc định `1280 kg/m³`.
3. Khi người dùng sửa tỉ trọng, tính lại `X mục tiêu` ngay trên UI.
4. Khi bấm tạo file, truyền cả `densityKgPerM3` và `targetX` vào engine.
5. Ghi tỉ trọng đã dùng vào metadata của output để có thể kiểm tra lại.
6. Nên hiển thị tỉ trọng trong dòng thông tin đầu file Excel cùng ngày, tổng chuyến và X.

Công thức sau thay đổi:

```js
targetX = roundToNearest10(totalVolumeM3 * densityKgPerM3)
```

## 6. Các file dự kiến thay đổi

### `src/engine.js`

- Đổi `DENSITY_KG_PER_M3` thành `DEFAULT_DENSITY_KG_PER_M3`.
- Tách hàm `calculateTargetX(totalVolumeM3, densityKgPerM3)`.
- Không khóa `targetX` theo tỉ trọng cố định ngay khi parse file.
- Thay `buildSequence` bằng thuật toán chọn random vòng xuất hiện cho từng biển số.
- Đưa tỉ trọng vào seed của phần sinh khối lượng nếu cần kết quả khối lượng thay đổi theo tỉ trọng.
- Ghi tỉ trọng vào sheet metadata và phần đầu file output.

### `src/App.jsx`

- Thêm state `densityKgPerM3`, mặc định là 1280.
- Thêm input số `Tỉ trọng hàng`.
- Tính lại `X mục tiêu` theo tỉ trọng hiện tại.
- Validate tỉ trọng trước khi gọi `generateRecords`.
- Truyền `densityKgPerM3` và `targetX` vào input cấu hình.

### `src/styles.css`

- Thêm style cho field tỉ trọng và phần đơn vị `kg/m³`.
- Bảo đảm hiển thị tốt trên desktop và mobile.

### Tài liệu

- Cập nhật `README.md` và `CHANGELOG.md` về field tỉ trọng và quy tắc random vị trí chuyến.

## 7. Kiểm thử cần thực hiện

### Random số chuyến

- Mỗi biển số xuất hiện đúng `tripCount` lần.
- Tổng số record bằng tổng số chuyến input.
- Xe có số chuyến thấp hơn `maxTrips` có khoảng trống phân tán trong toàn dải, không chỉ thiếu ở cuối.
- Cùng seed cho kết quả giống nhau.
- Seed khác cho vị trí thiếu khác nhau.
- Xe đầu/cuối vẫn tuân thủ quy tắc khác ngày trước.

### Tỉ trọng và X

- `32.587,79 m³ × 1.280 kg/m³` cho `X = 41.712.370 kg`.
- Thay tỉ trọng trên UI làm `X mục tiêu` cập nhật ngay.
- Tỉ trọng không hợp lệ bị chặn với thông báo rõ ràng.
- Tổng `KL HÀNG` trong output phải bằng đúng `X mục tiêu` mới.
- Nếu X mới vượt ngoài tổng tải tối thiểu/tối đa của catalog, giữ lỗi nghiệp vụ hiện tại và hiển thị khoảng hợp lệ.
- Output ghi đúng tỉ trọng đã sử dụng.

## 8. Tiêu chí nghiệm thu

- Không còn hiện tượng xe ít chuyến chỉ xuất hiện ở phần đầu và bị thiếu toàn bộ ở cuối.
- Các lượt bị loại của từng xe được phân bố ngẫu nhiên xuyên suốt output.
- Số chuyến từng xe và tổng số chuyến khớp input tuyệt đối.
- Người dùng nhập được tỉ trọng và nhìn thấy X thay đổi trước khi tạo file.
- Tổng khối lượng hàng trong Excel bằng X tính từ tỉ trọng đã nhập.
- File kiểm thử 65 xe/5.690 chuyến tạo thành công và qua toàn bộ kiểm tra đối soát.

## 9. Thứ tự thực hiện

1. Tách hàm tính X và bổ sung tỉ trọng động trong engine.
2. Thêm field tỉ trọng và validation trên UI.
3. Thay thuật toán chọn vòng chuyến bằng random có seed.
4. Cập nhật metadata/header Excel.
5. Thêm test cho count, phân bố vị trí, seed và công thức X.
6. Chạy thử với file tháng 4 và đối chiếu output.
7. Build lại web và Electron portable sau khi nghiệm thu logic.
