# Phân tích hệ thống web tạo dữ liệu từ Excel

## 1. Mục tiêu

Xây dựng một web React JS có quy trình tối giản:

1. Người dùng chọn hoặc kéo thả một file đầu vào `.xls`/`.xlsx`.
2. Web đọc, kiểm tra và hiển thị tóm tắt dữ liệu.
3. Người dùng bấm **Tạo file output**.
4. Web sinh và tải xuống một file `.xlsx` có cấu trúc tương đương `output.xlsx`.

Phương án khuyến nghị là xử lý hoàn toàn trong trình duyệt. File của người dùng không cần tải lên server.

### 1.1. Quy trình thủ công khách hàng đã xác nhận

Hiện tại khách hàng làm ba giai đoạn:

1. Copy danh sách biển số xe chạy trong ngày và số chuyến tương ứng từ file tổng hợp.
2. Copy/lặp danh sách biển số ra thành từng lượt chuyến, sau đó lọc và xóa bớt để số lần xuất hiện của từng xe khớp số chuyến thực tế. Các xe không có số lượt bằng nhau.
3. Copy toàn bộ danh sách chuyến đã chuẩn bị sang sheet đích của `genarate-data.xlsm`, nhập tổng KL hàng và bấm **Generate** để sinh KL xe, KL hàng, KL tổng.

Web phải tự động hóa trọn cả ba giai đoạn. Với người dùng cuối, thao tác còn lại chỉ là:

```text
Chọn file input → Bấm Tạo dữ liệu → Tải file output
```

## 2. Kết luận quan trọng

`genarate-data.xlsm` không phải một quy trình input → output hoàn chỉnh. File chỉ chứa phần thuật toán tạo ngẫu nhiên ba cột khối lượng trên một sheet đích đã được chuẩn bị sẵn.

Cụ thể:

- Đây không phải macro VBA chuẩn. Nút **Generate** gọi WPS JavaScript macro `[0]!main`; mã nguồn nằm trong `xl/JDEData.bin`.
- Macro không mở hoặc đọc `input.xls`.
- Macro không chuyển danh sách tổng hợp thành các dòng chuyến xe.
- Macro không tạo tiêu đề, định dạng, cột kiểm tra L–N hoặc dòng tổng cộng.
- Macro yêu cầu sheet đích đã có sẵn biển số tại cột E, từ dòng 7.
- Macro yêu cầu ô `L6` là tổng KL hàng mục tiêu `X`, trong khi `output.xlsx` đang dùng `L6` làm tiêu đề **Biển Số Xe**.
- Macro ghi giá trị vào G/H/I, trong khi `output.xlsx` giữ công thức `G = H + I` ở cột G.

Do đó web phải triển khai thêm toàn bộ bước tiền xử lý và xuất báo cáo. Không thể chỉ “chạy macro Excel trên web”.

Luồng nghiệp vụ đã được chốt như sau:

- Input quyết định danh sách biển số chạy trong ngày và số chuyến của từng xe.
- Web phải bung thành đúng tổng số dòng chuyến; xe nhiều lượt có nhiều dòng hơn xe ít lượt.
- Tổng số lần của từng biển số trong output phải bằng tuyệt đối số chuyến trong input.
- Tổng KL hàng của toàn bộ output phải giữ nguyên bằng X tính từ tổng hàng của input.
- Mỗi chuyến phải nằm trong giới hạn xe tương ứng trong danh mục của `genarate-data.xlsm`.
- Mọi KL xe, KL hàng và KL tổng phải là số nguyên chẵn chục, chia hết cho 10 kg; tuyệt đối không sinh số lẻ hoặc phần thập phân.
- Thứ tự chuyến phải được xáo trộn/cân bằng; xe đầu và xe cuối của ngày hiện tại phải khác ngày trước.

## 3. Các file đã phân tích

| File | Vai trò thực tế | Kết quả phân tích |
|---|---|---|
| `input.xls` | Bảng tổng hợp chuyến và thể tích theo xe | 1 sheet `22-7`, 55 xe, 2.502 chuyến, tổng 14.269,78 m³ |
| `genarate-data.xlsm` | Danh mục giới hạn xe + WPS JavaScript macro | 68 xe trong sheet `File che SL`; macro sinh KL xe, KL hàng và KL tổng |
| `output.xlsx` | Mẫu kết quả mong muốn | 2.502 dòng chuyến, 55 biển số, tổng KL hàng 18.265.320 kg |

### 3.1. Cấu trúc `input.xls`

Dữ liệu mẫu bắt đầu tại dòng 6:

| Cột | Nội dung | Ví dụ |
|---|---|---|
| A | STT | `1` |
| B | Biển số xe | `73H-04440` |
| C | Số lượng chuyến | `47` |
| D | Thể tích mỗi chuyến (m³) | `5,92` |
| E | Tổng thể tích (m³) | `278,24` |

Dòng `Tổng cộng` của file mẫu:

- Số chuyến: `2.502`.
- Tổng thể tích: `14.269,78 m³`.
- Số biển số khác nhau: `55`.

Không nên cố định sheet là `22-7` hoặc dòng dữ liệu là dòng 6. Web nên dò dòng tiêu đề dựa trên các nhãn `Biển số xe`, `Số lượng`, `Tổng cộng (M3)` và cho phép khác biệt viết hoa/thường, xuống dòng hoặc khoảng trắng.

Trong luồng đã xác nhận, cột tổng thể tích của từng xe được dùng để kiểm tra dữ liệu đầu vào và tính tổng chung. Thuật toán hiện tại không giữ một target KL hàng riêng cho từng biển số; nó giữ tổng KL hàng của toàn bộ ngày bằng X, đúng với cách macro đang hoạt động.

### 3.2. Danh mục xe trong `genarate-data.xlsm`

Sheet nguồn có tên cố định `File che SL`, dữ liệu từ dòng 3. Macro sử dụng:

| Ý nghĩa | Cột | Cách dùng |
|---|---:|---|
| Biển số | D | Khóa tra cứu |
| Bì đăng kiểm | F | Cận dưới KL xe |
| Bì đăng kiểm + 100 | H | Cận trên KL xe |
| CCCP | I | Cơ sở tính cận dưới KL hàng |
| CCCP + 8% | J | Cận trên KL hàng |

Các cột E và K trong sheet nguồn không được macro sử dụng.

Web chỉ nhận một file input nên danh mục 68 xe này phải được đóng gói sẵn trong ứng dụng, ví dụ `vehicle-catalog.json`. Khi danh mục thay đổi, cần có quy trình quản trị để cập nhật nó; không nên bắt người dùng nghiệp vụ tải thêm file thứ hai trong luồng chính.

### 3.3. Cấu trúc `output.xlsx`

Các dòng dữ liệu nằm từ dòng 7 đến dòng 2.508. Dòng 2.509 là tổng cộng.

| Cột | Nội dung | Quy tắc trong mẫu |
|---|---|---|
| A | STT | 1 → 2.502 |
| B | Ngày cân | Đang để trống |
| C | Số phiếu | Đang để trống |
| D | Chủ hàng | `Cát Vĩnh Tú` |
| E | Biển số xe | Mỗi biển số lặp đúng số chuyến từ input |
| F | Loại hàng | `Cát` |
| G | KL tổng | `H + I` |
| H | KL xe | Giá trị ngẫu nhiên hợp lệ, bước 10 kg |
| I | KL hàng | Giá trị ngẫu nhiên hợp lệ, bước 10 kg |
| J | Người cân | Mẫu chỉ có `A.Quy` tại dòng đầu; quy tắc chưa rõ |
| L | Danh sách biển số kiểm tra | 55 biển số từ input |
| M | Số dòng thực tế | `COUNTIF(E:E, Lx)` |
| N | Số chuyến yêu cầu | Giá trị cột C của input |

Đối chiếu tự động cho thấy:

- Số lần xuất hiện của cả 55 biển số trong output khớp hoàn toàn với input.
- Tất cả 2.502 dòng đều có `G = H + I`.
- Tất cả giá trị H và I chia hết cho 10 kg.
- Không có dòng nào vượt giới hạn xe trong danh mục nguồn.
- Tổng KL xe: `19.378.780 kg`.
- Tổng KL hàng: `18.265.320 kg`.
- Tổng KL tổng: `37.644.100 kg`.

Phần tiêu đề A1:J5 của output dùng một số chuỗi mã hóa kiểu VNI như `COÂNG TY...` và font `VNI-Times`, trong khi dữ liệu mới dùng Unicode. Cách an toàn nhất cho MVP là giữ nguyên phần header trong template. Nếu muốn chuyển toàn bộ sang Unicode, phải lập bảng chuyển mã và nghiệm thu lại giao diện in trên Excel/WPS.

## 4. Quy tắc nghiệp vụ đã bóc tách từ macro

### 4.1. Cấu hình gốc

```js
const CONFIG = {
  SOURCE_START_ROW: 3,
  TARGET_START_ROW: 7,
  STEP: 10,
  MAX_CARGO_LOSS_RATE: 0.07,
  MAX_SOURCE_ROW: 1000,
  MAX_TARGET_ROW: 10000,
  EMPTY_ROWS_TO_STOP: 3,
};
```

### 4.2. Chuẩn hóa biển số

```js
normalizePlate(value) = String(value)
  .trim()
  .toUpperCase()
  .replace(/\s+/g, "");
```

Macro chỉ xóa khoảng trắng. Nó không xóa dấu gạch ngang, dấu chấm hoặc tự sửa biển số.

### 4.3. Quy tắc làm tròn chẵn chục

Nếu giá trị khối lượng đọc từ file mẫu hoặc giá trị tính toán chưa chia hết cho 10 kg, làm tròn đến hàng chục gần nhất theo quy tắc **half-up**:

```text
Chữ số hàng đơn vị từ 0 đến 4 → làm xuống 0
Chữ số hàng đơn vị từ 5 đến 9 → làm lên chục kế tiếp
```

Ví dụ:

| Giá trị gốc | Kết quả |
|---:|---:|
| 6.741 | 6.740 |
| 6.744 | 6.740 |
| 6.745 | 6.750 |
| 6.749 | 6.750 |
| 18.265.318,4 | 18.265.320 |

Với dữ liệu không âm, có thể biểu diễn:

```js
function roundToNearest10(value) {
  return Math.floor((value + 5) / 10) * 10;
}
```

Quy tắc này áp dụng cho X và các giá trị khối lượng thông thường cần chuẩn hóa. Riêng cận an toàn không dùng làm tròn gần nhất:

- Cận dưới phải `ceil` lên chục kế tiếp.
- Cận trên phải `floor` xuống chục trước đó.

Lý do: làm tròn cận trên từ 6.855 lên 6.860 có thể tạo giá trị vượt mức cho phép. Sau khi chuẩn hóa cận, bộ sinh chỉ chọn các giá trị theo bước 10 kg nên output không thể có số lẻ.

### 4.4. Tính giới hạn theo từng xe

Với `step = 10 kg`:

```text
minCar   = ceil(BÌ_ĐK / 10) × 10
maxCar   = floor((BÌ_ĐK_PLUS_100) / 10) × 10
minCargo = ceil((CCCP × 0,93) / 10) × 10
maxCargo = floor((CCCP_PLUS_8_PERCENT) / 10) × 10
```

Ví dụ xe `73H-04446`:

```text
BÌ ĐK       = 6.745  → minCar   = 6.750
BÌ ĐK + 100 = 6.850  → maxCar   = 6.850
CCCP         = 9.060  → minCargo = 8.430
CCCP + 8%    = 9.780  → maxCargo = 9.780
```

### 4.5. Sinh giá trị ngẫu nhiên có trọng số

Macro sinh KL xe và KL hàng độc lập theo từng biển số. Mỗi giá trị nằm trong khoảng hợp lệ và cách nhau 10 kg.

Giá trị đã xuất hiện ít lần có xác suất được chọn cao hơn:

```text
weight(value) = 1 / (usedCount(value) + 1)²
```

Ví dụ trọng số sau 0, 1, 2, 3 lần sử dụng lần lượt là `1`, `1/4`, `1/9`, `1/16`. Trước khi sinh, macro trộn thứ tự record bằng Fisher–Yates; sau đó sắp xếp lại theo dòng Excel.

### 4.6. Điều chỉnh tổng KL hàng bằng đúng X

Sau khi random ban đầu:

```text
currentTotal = tổng cargoValue
difference   = X - currentTotal
```

Macro tăng hoặc giảm từng bước `10 kg` cho đến khi `difference = 0`. Record còn nhiều dung lượng tăng/giảm có xác suất được chọn cao hơn.

Điều kiện X hợp lệ:

- Là số lớn hơn 0.
- Chia hết cho 10 kg.
- Nằm trong `[tổng minCargo, tổng maxCargo]` của toàn bộ record.

Với mẫu hiện tại:

```text
Tổng minCargo = 16.825.600 kg
X              = 18.265.320 kg
Tổng maxCargo = 19.525.710 kg
```

X nằm ở khoảng 53,32% miền khả thi.

### 4.7. Tính X từ file input

Phần này không tồn tại trong macro nhưng được suy ra chính xác từ cặp input/output:

```text
X thô = 14.269,78 m³ × 1.280 kg/m³
      = 18.265.318,4 kg

X sau làm tròn đến 10 kg = 18.265.320 kg
```

Web nên cấu hình `DENSITY_KG_PER_M3 = 1280` và `STEP = 10`. Vì đây là quy tắc suy luận từ một mẫu, cần chủ nghiệp vụ xác nhận trước khi coi là quy tắc cố định.

Để tránh sai số số thực JavaScript, nên tính thể tích bằng số nguyên phần trăm m³ hoặc dùng thư viện decimal, sau đó mới làm tròn X.

## 5. Quy tắc thứ tự chuyến giữa các ngày

Yêu cầu khách hàng đã xác nhận:

```text
firstPlate(today) != firstPlate(previousDay)
lastPlate(today)  != lastPlate(previousDay)
```

Danh sách chuyến vẫn phải bảo toàn số lượt của từng xe. Phương án đề xuất:

1. Lấy ngày dữ liệu từ input; nếu không đọc được thì yêu cầu người dùng chọn ngày.
2. Tạo danh sách theo round-robin từ số chuyến còn lại của từng xe.
3. Dùng seed có chứa ngày để xoay vị trí bắt đầu và xáo trộn thứ tự xe giữa các vòng.
4. Đọc `firstPlate` và `lastPlate` của ngày gần nhất từ lịch sử.
5. Nếu đầu hoặc cuối trùng ngày trước, xoay danh sách hoặc đổi hai record hợp lệ.
6. Kiểm tra lại số lượt từng xe sau khi đổi; tuyệt đối không được làm thay đổi trip count.
7. Lưu `{date, firstPlate, lastPlate, seed, inputHash}` sau khi tạo thành công.

MVP client-only có thể lưu lịch sử trong `localStorage` và ghi thêm vào sheet `Metadata` của output. Cách này chỉ bảo đảm trên cùng trình duyệt và khi người dùng không xóa dữ liệu. Nếu nhiều người/máy cùng tạo file và cần bảo đảm thứ tự trên toàn hệ thống, phải có backend lưu lịch sử chung hoặc yêu cầu tải output ngày trước để đối chiếu.

Seed theo ngày chỉ giúp kết quả khác nhau; tự nó không bảo đảm tuyệt đối xe đầu/cuối khác ngày trước. Bước so sánh và sửa thứ tự vẫn là bắt buộc.

## 6. Phần còn thiếu hoặc chưa xác định

Các điểm sau vẫn cần khách hàng xác nhận:

1. Hệ số `1.280 kg/m³` có luôn cố định cho mọi loại cát hay không.
2. Cách lấy `Từ ngày`, `Đến ngày` trong tiêu đề output. Input mẫu chỉ thể hiện sheet `22-7` và tiêu đề tháng 7/2026; output lại giữ ngày 29/01/26–31/01/26 từ template cũ.
3. Giá trị cột D `Cát Vĩnh Tú`, cột F `Cát` và cột J `A.Quy` là cố định hay phải lấy từ cấu hình.
4. Cột B ngày cân và cột C số phiếu có cần sinh dữ liệu trong phiên bản sau hay tiếp tục để trống.
5. Có cần giữ bảng kiểm tra L–N trong output chính thức hay chỉ dùng nội bộ.
6. Có yêu cầu tái tạo y hệt từng số ngẫu nhiên của file mẫu hay chỉ cần thỏa các ràng buộc. Do macro dùng `Math.random()`, không thể tái tạo byte-for-byte nếu không có seed.

Khuyến nghị MVP:

- Giữ các hằng số theo file mẫu.
- Sắp biển số theo round-robin cân bằng, không để một xe chiếm cả một đoạn liên tục; bắt buộc kiểm tra xe đầu/cuối với ngày trước.
- Dùng bộ sinh số ngẫu nhiên có seed và lưu seed vào metadata/audit sheet để có thể tái tạo kết quả.
- Hiển thị các hằng số trong một màn hình cấu hình quản trị, nhưng luồng người dùng thường chỉ cần tải input và bấm nút.

## 7. Kiến trúc web đề xuất

### 7.1. Công nghệ

- React JS, khuyến nghị dùng TypeScript để kiểm soát kiểu dữ liệu nghiệp vụ.
- Vite cho dự án SPA.
- SheetJS Community Edition để đọc cả `.xls` cũ và `.xlsx` từ `ArrayBuffer` trong trình duyệt.
- ExcelJS để tạo `.xlsx` có merge cell, độ rộng cột, border, font, alignment và công thức.
- Web Worker cho bước sinh hàng nghìn record nếu cần giữ giao diện luôn phản hồi.
- Vitest cho unit test; Playwright cho kiểm thử upload → download.

Không dùng Create React App vì đã bị React đánh dấu deprecated. Vite có template React chính thức và phù hợp với ứng dụng client-only này.

### 7.2. Luồng xử lý

```text
Chọn file input
      ↓
Đọc ArrayBuffer trong trình duyệt
      ↓
Parse .xls/.xlsx → mảng các dòng
      ↓
Dò tiêu đề và chuẩn hóa dữ liệu
      ↓
Kiểm tra input + đối chiếu vehicle-catalog.json
      ↓
Tính tổng chuyến, tổng m³ và X
      ↓
Mở rộng mỗi xe thành đúng N record chuyến
      ↓
Xếp thứ tự round-robin + đối chiếu xe đầu/cuối ngày trước
      ↓
Kiểm tra COUNT(output plate) = tripCount(input) cho mọi xe
      ↓
Sinh KL xe/KL hàng + cân chỉnh tổng hàng = X
      ↓
Kiểm tra toàn bộ invariant
      ↓
Ghi output-template.xlsx và tải xuống
```

### 7.3. Cấu trúc mã nguồn gợi ý

```text
src/
  components/
    FileDropzone.tsx
    InputPreview.tsx
    ValidationErrors.tsx
    GenerateButton.tsx
    ResultSummary.tsx
  domain/
    types.ts
    constants.ts
    normalizePlate.ts
    validateInput.ts
    expandTrips.ts
    arrangeDailyTrips.ts
    generationHistory.ts
    random.ts
    generateWeights.ts
    verifyResult.ts
  excel/
    readInputWorkbook.ts
    findInputTable.ts
    writeOutputWorkbook.ts
  workers/
    generate.worker.ts
  data/
    vehicle-catalog.json
  App.tsx
public/
  templates/
    output-template.xlsx
tests/
  fixtures/
    input.xls
    expected-summary.json
```

Tách logic nghiệp vụ khỏi React và Excel giúp test trực tiếp các hàm thuần, không phụ thuộc DOM hoặc định dạng workbook.

## 8. Mô hình dữ liệu đề xuất

```ts
type InputVehicleRow = {
  sourceRow: number;
  plate: string;
  tripCount: number;
  volumePerTripM3: number;
  totalVolumeM3: number;
};

type VehicleRule = {
  plate: string;
  minCar: number;
  maxCar: number;
  minCargo: number;
  maxCargo: number;
};

type GeneratedRecord = {
  index: number;
  plate: string;
  carWeight: number;
  cargoWeight: number;
  totalWeight: number;
};

type GenerationSummary = {
  recordCount: number;
  distinctPlateCount: number;
  totalVolumeM3: number;
  targetCargoWeight: number;
  actualCarWeight: number;
  actualCargoWeight: number;
  actualTotalWeight: number;
  seed: string;
};

type DailyGenerationHistory = {
  date: string;
  firstPlate: string;
  lastPlate: string;
  seed: string;
  inputHash: string;
};
```

## 9. Thuật toán web đề xuất

### 9.1. Đọc và kiểm tra input

1. Chỉ nhận `.xls` và `.xlsx`; kiểm tra cả phần mở rộng lẫn chữ ký file.
2. Dò sheet chứa các cột biển số và số chuyến.
3. Chuẩn hóa tiêu đề: bỏ xuống dòng, thu gọn khoảng trắng, lowercase để so khớp alias.
4. Đọc đến dòng `Tổng cộng` hoặc đến ba dòng trống liên tiếp.
5. Chuẩn hóa biển số đúng như macro.
6. Kiểm tra số chuyến là số nguyên dương.
7. Kiểm tra thể tích là số hữu hạn, không âm.
8. Kiểm tra `tripCount × volumePerTripM3` xấp xỉ `totalVolumeM3` trong sai số 0,01 m³.
9. Không tự sửa lỗi âm thầm; trả về số dòng Excel và nguyên nhân.
10. Từ chối biển số trùng trong input hoặc không có trong danh mục xe.
11. Từ chối nếu tổng record vượt 10.000, tương đương giới hạn macro.

### 9.2. Mở rộng thành danh sách chuyến

Không nên tạo toàn bộ chuyến của xe A rồi mới đến xe B. Nên phân phối round-robin:

```js
while (còn xe có remainingTrips > 0) {
  for (const vehicle of orderedVehicles) {
    if (vehicle.remainingTrips > 0) {
      records.push({ plate: vehicle.plate });
      vehicle.remainingTrips--;
    }
  }
}
```

Phải xoay vị trí bắt đầu hoặc shuffle bằng seed theo ngày để thứ tự không lặp máy móc. Sau khi bung danh sách, tạo bảng đếm và chỉ cho phép tiếp tục khi mọi biển số đều thỏa:

```text
actualTripCount[plate] = inputTripCount[plate]
```

Tiếp theo áp dụng quy tắc ở mục 5 để bảo đảm xe đầu và xe cuối khác ngày trước. Mọi thao tác xoay/đổi chỉ thay vị trí, không được thêm hoặc xóa record.

### 9.3. Sinh khối lượng

Triển khai lại đúng công thức `weightedRandomValue` của macro. Sau random ban đầu, cân chỉnh tổng KL hàng về X trong giới hạn từng record.

Với dữ liệu lớn, không nên mỗi bước 10 kg lại quét toàn bộ 2.502 record như macro. Có thể dùng một cấu trúc chọn theo trọng số dung lượng, hoặc phân bổ theo lô bước, nhưng kết quả cuối phải giữ đủ các invariant:

```text
minCar ≤ carWeight ≤ maxCar
minCargo ≤ cargoWeight ≤ maxCargo
carWeight % 10 = 0
cargoWeight % 10 = 0
totalWeight = carWeight + cargoWeight
sum(cargoWeight) = X
carWeight, cargoWeight, totalWeight đều là số nguyên chia hết cho 10 kg
```

### 9.4. Tạo output

Khuyến nghị tạo một `output-template.xlsx` sạch từ mẫu hiện tại, chỉ giữ:

- Header và merge cells A1:J5.
- Dòng tiêu đề A6:J6.
- Style mẫu cho dòng dữ liệu và dòng tổng cộng.
- Độ rộng cột, chiều cao dòng, border, font và page setup.

Khi xuất:

1. Clone style dòng dữ liệu cho đúng số record.
2. Ghi A, D, E, F, H, I.
3. Ghi G bằng công thức `Hn+In` hoặc bằng số; khuyến nghị công thức kèm cached result nếu thư viện hỗ trợ.
4. Tạo dòng tổng: `SUM(H7:Hlast)`, `SUM(I7:Ilast)` và `Gtotal = Htotal + Itotal`.
5. Tạo bảng audit L–N và so sánh expected/actual trip count.
6. Ghi seed, hệ số khối lượng riêng và thời điểm tạo vào một sheet `Metadata` có thể ẩn.
7. Tải file với tên như `output-22-7-20260821.xlsx`.

Không nên dùng chính `output.xlsx` có 2.502 dòng làm template runtime vì nó chứa dữ liệu thật và rất nhiều style/formula thừa. Hãy tạo template sạch một lần và đưa vào source control.

## 10. Giao diện người dùng

Màn hình chính chỉ cần một luồng:

1. Vùng kéo thả/chọn file.
2. Thẻ tóm tắt sau khi đọc thành công:
   - Tên sheet.
   - Số xe.
   - Tổng chuyến.
   - Tổng m³.
   - X dự kiến.
3. Nút **Tạo file output**.
4. Thanh tiến trình với các trạng thái `Đang đọc`, `Đang kiểm tra`, `Đang sinh dữ liệu`, `Đang tạo Excel`.
5. Kết quả cuối và nút **Tải lại file** nếu trình duyệt chặn download tự động.

Nếu input lỗi, hiển thị bảng gồm `Dòng`, `Cột`, `Giá trị`, `Lỗi`, thay vì chỉ một alert dài như macro.

## 11. Kiểm thử và tiêu chí nghiệm thu

### 11.1. Unit test

- Chuẩn hóa biển số có khoảng trắng và chữ thường.
- Parse số có dấu phẩy phân cách hàng nghìn.
- Làm tròn gần nhất đúng tại biên: đuôi 0–4 xuống và đuôi 5–9 lên.
- Kiểm tra các mẫu `6.744 → 6.740`, `6.745 → 6.750` và `18.265.318,4 → 18.265.320`.
- Làm tròn lên/xuống theo bước 10 kg.
- Không dùng làm tròn gần nhất cho cận trên nếu kết quả có thể vượt tải.
- Tính đúng bốn giới hạn của từng xe.
- Random luôn nằm trong giới hạn.
- Điều chỉnh tổng tăng và giảm đều đạt X.
- Phát hiện X ngoài miền khả thi.
- Phát hiện biển số thiếu hoặc trùng.
- Cùng input + cùng seed tạo cùng kết quả.
- Bung đúng số lượt khi các xe có trip count không đều nhau.
- Không làm thay đổi trip count sau khi xoay/đổi thứ tự.
- Xe đầu và xe cuối khác kết quả ngày trước.
- Phát hiện thiếu lịch sử khi chế độ bắt buộc đối chiếu ngày trước được bật.

### 11.2. Integration test với bộ file mẫu

Với `input.xls`, kết quả phải có:

```text
Số xe                 = 55
Số record             = 2.502
Tổng thể tích         = 14.269,78 m³
X                     = 18.265.320 kg
Tổng số lần theo biển = khớp input
Tổng KL hàng          = 18.265.320 kg
Số dòng vi phạm range = 0
Số dòng sai bước 10   = 0
Số dòng G != H + I    = 0
Số ô KL có số lẻ      = 0
Số giá trị làm tròn sai quy tắc 4/5 = 0
```

Không so sánh từng giá trị H/I với `output.xlsx` nếu chạy random không seed. Thay vào đó kiểm tra các invariant và tổng. Nếu cần golden file cố định, dùng một seed cố định trong test.

### 11.3. Kiểm thử file output

- Mở được bằng Microsoft Excel và WPS mà không có cảnh báo repair.
- Công thức tổng đúng sau khi Excel recalculation.
- Không mất tiếng Việt ở các cột do web sinh.
- Merge cell, border và kích thước cột đúng template.
- Số record thực tế ở bảng audit bằng số chuyến yêu cầu.
- Tổng số record bằng tổng cột số chuyến của input, kể cả khi số lượt giữa các xe không đều.
- Metadata lưu đúng ngày, seed, xe đầu và xe cuối.

## 12. Bảo mật và vận hành

- Xử lý client-side để dữ liệu không rời máy người dùng.
- Không thực thi macro từ file upload.
- Giới hạn kích thước file và số dòng để tránh treo trình duyệt.
- Không tin MIME type do trình duyệt gửi; kiểm tra chữ ký file.
- Bắt lỗi workbook hỏng, file có mật khẩu hoặc định dạng không hỗ trợ.
- Cố định phiên bản dependency trong lockfile và kiểm tra license trước khi triển khai thương mại.
- Nếu sau này cần lưu lịch sử hoặc phân quyền, mới bổ sung API/backend; MVP không cần backend.

## 13. Kế hoạch triển khai

### Giai đoạn 1 — Chốt nghiệp vụ

- Xác nhận hệ số 1.280 kg/m³.
- Xác nhận nguồn lấy ngày, cơ chế lưu lịch sử dùng chung hay theo trình duyệt, số phiếu, người cân và các giá trị cố định.
- Chuyển 68 xe từ sheet nguồn sang `vehicle-catalog.json` và duyệt dữ liệu.
- Tạo `output-template.xlsx` sạch.

### Giai đoạn 2 — Core engine

- Parser input `.xls/.xlsx`.
- Validation và mô hình dữ liệu.
- Mở rộng chuyến round-robin.
- Đối chiếu số lượt từng xe và ràng buộc xe đầu/cuối khác ngày trước.
- Port thuật toán random/cân chỉnh từ macro.
- Seeded PRNG và bộ unit test.

### Giai đoạn 3 — React UI và export

- Upload/preview/error UI.
- Web Worker nếu cần.
- Tạo workbook và download.
- Integration test với ba file mẫu.

### Giai đoạn 4 — Nghiệm thu

- So sánh số chuyến theo từng biển số.
- Mở file trên Excel và WPS.
- Kiểm thử nhiều input thật, không chỉ `input.xls` mẫu.
- Chốt tài liệu vận hành và cách cập nhật danh mục xe.

## 14. Tài liệu công nghệ tham khảo

- [React: Installation](https://react.dev/learn/installation)
- [React: Creating a React App](https://react.dev/learn/creating-a-react-app)
- [Vite: Getting Started](https://vite.dev/guide/)
- [SheetJS: Import Tutorial với file XLS](https://docs.sheetjs.com/docs/getting-started/examples/import/)
- [SheetJS: Reading Files](https://docs.sheetjs.com/docs/api/parse-options/)
- [ExcelJS: đọc/ghi XLSX và style](https://github.com/exceljs/exceljs)

## 15. Đề xuất chốt cho MVP

MVP nên là một React SPA nhận một file `.xls/.xlsx`, tự đọc biển số và số chuyến, bung đúng số lượt, sắp thứ tự khác ngày trước, dùng danh mục xe đóng gói sẵn, tự tính X, port toàn bộ logic Generate và tải xuống `.xlsx` theo template. Không cố chạy WPS macro trong trình duyệt; port logic thành các hàm TypeScript có test.

Trước khi bắt đầu code production, cần xác nhận hệ số 1.280, nguồn lấy ngày, phạm vi lưu lịch sử, dữ liệu số phiếu và người cân. Quy trình ba giai đoạn, số lượt không đều, kiểm tra xe đầu/cuối và các quy tắc khối lượng đã được đưa thành yêu cầu chính thức.
