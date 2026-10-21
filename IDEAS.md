# Ý tưởng

Tôi muốn phát triển một chương trình giống GrapeSeed, là một application giúp dạy tiếng anh cho trẻ em mầm non.
Toàn bộ chương trình, hình ảnh, video sẽ được tạo từ đầu để tránh bản quyền. Bạn có thể xem các tài liệu đã tạo trong docs.

# Chức năng mong muốn
- web admin để giáo viên có thể biên soạn bài giảng và quản lý users.
- teacher app để giáo viên dạy học sinh trên lớp
- student app để học sinh tự học ở nhà.
- có thể có AI Agents để hướng dẫn học sinh tự học.

# Technical
- các app đều là PWA, app mobile native để sau.
- tôi đã có một AI Gateway để tạo prompt (dùng gpt-6-luna), một AI Gateway khác để sinh ảnh (dùng gpt-image-2.5).
- data về bài giảng có thể lưu trên Cloudflare R2.
- giai đoạn đầu thử nghiệm thì dùng Cloudflare Tunnel trỏ vào một VPS chạy docker compose.
- staff login bằng google.
- học sinh login bằng username/password (hoặc email/password).