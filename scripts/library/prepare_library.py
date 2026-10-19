#!/usr/bin/env python3
"""Build editable bilingual lesson sidecars and bounded JPEG seek sprites.

Requires ffprobe/ffmpeg for preparation only; the desktop runtime needs neither.
Existing editorial sidecars and images are preserved. No subtitle translations
are fabricated. Course media stays in files/ and is never bundled into the app.
"""
import concurrent.futures
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ['https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/',
           'https://aws.amazon.com/vi/certification/certified-cloud-practitioner/']
# Starting lesson number, chapter, contextual EN/VI overview.
CHAPTERS = [
 (1, 'Bắt đầu với AWS', 'Get oriented, prepare your account and build a sustainable study routine.', 'Làm quen lộ trình học, chuẩn bị tài khoản và xây dựng thói quen học chủ động.'),
 (7, 'Cloud fundamentals', 'Understand cloud delivery models, global infrastructure and shared responsibility.', 'Hiểu mô hình điện toán đám mây, hạ tầng toàn cầu và trách nhiệm của AWS cùng khách hàng.'),
 (15, 'IAM · Danh tính & truy cập', 'Connect users, groups, roles and policies with least privilege, MFA and secure credentials.', 'Phân biệt user, group, role và policy; áp dụng đặc quyền tối thiểu, MFA và quản lý thông tin xác thực.'),
 (36, 'EC2 · Máy chủ đám mây', 'Choose compute capacity, secure instance access and compare EC2 purchase models.', 'Nhận diện các loại máy chủ EC2, bảo vệ kết nối và so sánh các hình thức mua tài nguyên tính toán.'),
 (53, 'Lưu trữ cho EC2', 'Compare block, file and instance storage; understand snapshots and machine images.', 'So sánh lưu trữ khối, tệp và lưu trữ cục bộ; tìm hiểu snapshot và ảnh máy chủ AMI.'),
 (68, 'Co giãn & cân bằng tải', 'Connect elasticity, high availability, load balancing and automatic scaling.', 'Liên hệ tính co giãn, độ sẵn sàng cao, cân bằng tải và tự động điều chỉnh số lượng máy chủ.'),
 (77, 'S3 · Lưu trữ đối tượng', 'Understand object storage, bucket access, lifecycle choices, replication and hybrid storage.', 'Hiểu lưu trữ đối tượng, quyền truy cập bucket, lớp lưu trữ, sao chép dữ liệu và lưu trữ lai.'),
 (99, 'Cơ sở dữ liệu & phân tích', 'Distinguish relational, NoSQL and analytical services by workload and management model.', 'Phân biệt cơ sở dữ liệu quan hệ, NoSQL và dịch vụ phân tích theo nhu cầu dữ liệu và mô hình quản lý.'),
 (119, 'Containers & serverless', 'Compare containers, serverless functions, APIs and managed compute options.', 'So sánh container, hàm serverless, API và các lựa chọn tính toán được quản lý.'),
 (131, 'Triển khai & công cụ phát triển', 'Recognize infrastructure as code, CI/CD services and operational configuration tools.', 'Nhận diện hạ tầng dưới dạng mã, dịch vụ CI/CD và công cụ cấu hình vận hành.'),
 (147, 'Ứng dụng toàn cầu', 'Choose DNS, content delivery and edge services for global application delivery.', 'Lựa chọn DNS, phân phối nội dung và dịch vụ biên cho ứng dụng phục vụ người dùng toàn cầu.'),
 (160, 'Tích hợp ứng dụng', 'Understand messaging, event streams and decoupled application communication.', 'Hiểu hàng đợi, luồng sự kiện và cách các ứng dụng trao đổi thông tin mà không phụ thuộc chặt chẽ.'),
 (169, 'Giám sát & vận hành', 'Separate metrics, logs, audit events and tracing when investigating system behavior.', 'Phân biệt chỉ số, nhật ký, sự kiện kiểm toán và truy vết khi theo dõi hoạt động hệ thống.'),
 (183, 'VPC · Mạng trên AWS', 'Trace connectivity through subnets, gateways, private endpoints and network controls.', 'Theo dõi kết nối qua subnet, gateway, endpoint riêng và các lớp kiểm soát mạng.'),
 (196, 'Bảo mật & tuân thủ', 'Match protection, encryption, detection and compliance services to security needs.', 'Ghép dịch vụ bảo vệ, mã hóa, phát hiện và tuân thủ với nhu cầu bảo mật phù hợp.'),
 (217, 'AI & Machine Learning', 'Recognize managed AI services for vision, language, speech and recommendation workloads.', 'Nhận diện dịch vụ AI được quản lý cho hình ảnh, ngôn ngữ, giọng nói và gợi ý nội dung.'),
 (229, 'Quản trị, chi phí & hỗ trợ', 'Compare account governance, pricing, cost visibility, optimization and support options.', 'So sánh quản trị tài khoản, mô hình giá, theo dõi chi phí, tối ưu tài nguyên và lựa chọn hỗ trợ.'),
 (251, 'Quản lý danh tính nâng cao', 'Distinguish temporary credentials, customer identity, directories and workforce access.', 'Phân biệt thông tin xác thực tạm thời, danh tính khách hàng, thư mục và truy cập cho nhân viên.'),
 (257, 'Dịch vụ khác & di chuyển', 'Explore managed applications, migration, backup, recovery and workflow orchestration.', 'Khám phá ứng dụng được quản lý, di chuyển lên cloud, sao lưu, khôi phục và điều phối quy trình.'),
 (278, 'Kiến trúc & best practices', 'Review the Well-Architected pillars, cloud adoption and resource optimization.', 'Ôn tập các trụ cột Well-Architected, khung chuyển đổi lên cloud và tối ưu tài nguyên.'),
 (294, 'Ôn tập & chuẩn bị kỳ thi', 'Consolidate knowledge, reason through sample questions and prepare your exam approach.', 'Hệ thống hóa kiến thức, phân tích câu hỏi mẫu và chuẩn bị chiến lược làm bài thi.'),
]
PHRASES = {
 'Course Introduction':'Giới thiệu khóa học', 'Creating an AWS Account':'Tạo tài khoản AWS', 'Important Message':'Thông tin quan trọng', 'About your instructor':'Giới thiệu giảng viên',
 'Traditional IT Overview':'Tổng quan hạ tầng CNTT truyền thống', 'What is Cloud Computing':'Điện toán đám mây là gì?', 'The Different Types of Cloud Computing':'Các mô hình điện toán đám mây',
 'AWS Cloud Overview':'Tổng quan AWS Cloud', 'Important AWS Console UI Update':'Cập nhật giao diện AWS Console', 'Tour of the Console Services in AWS':'Khám phá dịch vụ trong AWS Console',
 'Shared Responsibility Model':'Mô hình trách nhiệm chung', 'AWS Acceptable Policy':'Chính sách sử dụng AWS',
 'Introduction Users Groups Policies':'Giới thiệu user, group và policy', 'Users Groups':'Người dùng và nhóm', 'Console Simultaneous Sign in':'Đăng nhập đồng thời vào Console',
 'Access Keys CLI and SDK':'Khóa truy cập, CLI và SDK', 'CLI Setup on Windows':'Cài AWS CLI trên Windows', 'CLI Setup on Mac':'Cài AWS CLI trên macOS', 'CLI Setup on Linux':'Cài AWS CLI trên Linux',
 'Roles for AWS Services':'Role cho dịch vụ AWS', 'Security Tools':'Công cụ bảo mật', 'Best Practices':'Thực hành tốt nhất', 'Budget Setup':'Thiết lập ngân sách',
 'Create an EC2 Instance with EC2 User Data to have a Website':'Tạo website bằng EC2 và User Data', 'Instance Types Basics':'Các loại EC2 instance cơ bản',
 'Security Groups Classic Ports':'Security Group và các cổng phổ biến', 'How to SSH using':'Kết nối SSH bằng',
 'Instance Purchasing Options':'Các hình thức mua EC2 instance', 'Snapshots':'Snapshot', 'Image Builder':'Image Builder', 'Instance Storage':'Lưu trữ cho instance',
 'High Availability Scalability Elasticity':'Độ sẵn sàng cao, mở rộng và co giãn', 'Elastic Load Balancing':'Cân bằng tải', 'Auto Scaling Groups':'Nhóm tự động mở rộng',
 'Application Load Balancer':'Cân bằng tải ứng dụng', 'Section Cleanup':'Dọn dẹp tài nguyên thực hành', 'Security Bucket Policy':'Bảo mật và chính sách bucket',
 'Storage Classes':'Các lớp lưu trữ', 'Transfer Acceleration':'Tăng tốc truyền dữ liệu', 'Global Tables':'Bảng toàn cầu', 'Databases Analytics':'Cơ sở dữ liệu và phân tích',
 'Databases Introduction':'Giới thiệu cơ sở dữ liệu', 'Deployments Options':'Các lựa chọn triển khai', 'What is Docker':'Docker là gì?', 'Serverless Introduction':'Giới thiệu serverless',
 'IMPORTANT CodeCommit Discontinuation':'Lưu ý thay đổi dịch vụ CodeCommit', 'Why Global Applications':'Vì sao cần ứng dụng toàn cầu?', 'Global Applications Architecture':'Kiến trúc ứng dụng toàn cầu',
 'Leveraging the AWS Global Infrastructure':'Ứng dụng hạ tầng toàn cầu AWS', 'Cloud Integrations':'Tích hợp ứng dụng cloud', 'Cloud Monitoring':'Giám sát cloud',
 'IP Addresses in AWS':'Địa chỉ IP trong AWS', 'Interface Gateway':'Interface và Gateway', 'Security Compliance':'Bảo mật và tuân thủ',
 'Root User Privileges':'Đặc quyền của root user', 'Penetration Testing':'Kiểm thử xâm nhập', 'Machine Learning':'Học máy', 'Consolidated Billing':'Thanh toán hợp nhất',
 'Pricing Models of the Cloud':'Mô hình giá trên cloud', 'Billing Costing Tools':'Công cụ thanh toán và chi phí', 'Estimating Costs in the Cloud Pricing Calculator':'Ước tính chi phí bằng Pricing Calculator',
 'Tracking Costs in the Cloud Billing Dashboard Cost Allocation Tags Reports':'Theo dõi chi phí: Dashboard, tag và báo cáo', 'Monitoring Costs in the Cloud Billing Alarms AWS Budgets':'Giám sát chi phí: Billing Alarm và AWS Budgets',
 'Support Plans for AWS':'Các gói hỗ trợ AWS', 'Advanced Identity':'Quản lý danh tính nâng cao', 'Other Services Section Intro':'Giới thiệu các dịch vụ khác',
 'Disaster Recovery Strategies':'Chiến lược khôi phục thảm họa', 'Cloud Migration Strategies The 7Rs':'Chiến lược di chuyển cloud: 7Rs',
 'Pillar 1 Operational Excellence':'Trụ cột 1: Vận hành xuất sắc', 'Pillar 2 Security':'Trụ cột 2: Bảo mật', 'Pillar 3 Reliability':'Trụ cột 3: Độ tin cậy',
 'Pillar 4 Performance Efficiency':'Trụ cột 4: Hiệu quả hiệu năng', 'Pillar 5 Cost Optimization':'Trụ cột 5: Tối ưu chi phí', 'Pillar 6 Sustainability':'Trụ cột 6: Phát triển bền vững',
 'Right Sizing':'Lựa chọn tài nguyên phù hợp', 'AWS Ecosystem':'Hệ sinh thái AWS', 'Words on Other Services':'Tổng kết các dịch vụ khác',
 'State of Learning Checkpoint AWS Certified Cloud Practitioner':'Kiểm tra tiến độ học AWS Cloud Practitioner', 'Exam Sample Question Walkthrough':'Phân tích câu hỏi thi mẫu',
 'Exam Tips AWS Certified Cloud Practitioner':'Mẹo làm bài thi Cloud Practitioner', 'Exam Walkthrough and Signup':'Hướng dẫn đăng ký và quy trình thi',
 'Save 50 on your AWS Exam Cost':'Tìm hiểu ưu đãi lệ phí thi AWS', 'Get an Extra 30 Minutes on your AWS Exam Non Native English Speakers only':'Thời gian thi bổ sung cho người không dùng tiếng Anh bản ngữ',
 'AWS Certification Paths':'Lộ trình chứng chỉ AWS', 'Congratulations':'Chúc mừng hoàn thành khóa học',
 'Hands On':'Thực hành', 'Overview':'Tổng quan', 'Introduction':'Giới thiệu', 'Summary':'Tổng kết', 'Basics':'Cơ bản', 'Best Practices':'Thực hành tốt nhất',
 'Policies':'Chính sách', 'Roles':'Vai trò', 'Security':'Bảo mật', 'Strategies':'Chiến lược', 'Reminders Examples':'Ôn tập và ví dụ', 'Encryption with':'Mã hóa với',
 'Encryption':'Mã hóa', 'Versioning':'Quản lý phiên bản', 'Replication':'Sao chép', 'Website':'Website', 'for':'cho', 'on':'trên', 'using':'sử dụng',
}

def translate(title):
    terms = {**PHRASES,
        'AWS CLI Setup on Windows':'Cài AWS CLI trên Windows',
        'AWS CLI Setup on Mac':'Cài AWS CLI trên macOS',
        'AWS CLI Setup on Linux':'Cài AWS CLI trên Linux',
        'Security Groups Classic Ports':'Nhóm bảo mật và các cổng phổ biến',
        'Security Groups':'Nhóm bảo mật (Security Group)',
        'Security Hub':'Security Hub',
        'Security Token Service STS':'Dịch vụ token bảo mật STS',
        'Linux or Mac':'Linux hoặc macOS',
        'EC2 Instance Roles Demo':'Minh họa IAM role cho EC2 instance',
        'EC2 Instance Purchasing Options':'Các hình thức mua EC2 instance',
        'EC2 Instance Types Basics':'Các loại EC2 instance cơ bản',
        'IAM Best Practices':'Thực hành tốt nhất với IAM',
        'IAM Policies':'Chính sách IAM',
        'IAM Users Groups':'Người dùng và nhóm trong IAM',
    }
    lookup = {key.lower():value for key,value in terms.items()}
    pattern = r'(?<!\w)(?:' + '|'.join(re.escape(key) for key in sorted(terms,key=len,reverse=True)) + r')(?!\w)'
    title = re.sub(pattern, lambda match: lookup[match[0].lower()], title, flags=re.I)
    # Vietnamese topic headings conventionally put Overview/Practice first.
    for suffix in ['Tổng quan', 'Thực hành', 'Tổng kết', 'Cơ bản']:
        if title.endswith(' ' + suffix): title = suffix + ': ' + title[:-len(suffix)].strip()
    return title

def prepare(video):
    stem = video.stem
    number = int(stem.split('-')[0])
    title = '-'.join(stem.split('-')[1:-2])
    chapter = next(c for c in reversed(CHAPTERS) if number >= c[0])
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height', '-of', 'json', str(video)]))
    duration = float(probe['format']['duration'])
    sidecar = video.with_suffix('.lesson.json')
    if not sidecar.exists():
        vi = translate(title)
        hands = 'Hands On' in title
        en = f'{title}. {chapter[2]}\n\n' + ('Follow the demonstration, then recreate the steps in your own environment. Note which resources need cleanup.' if hands else 'Before watching: what problem does this topic solve? After watching: write one use case and explain the key distinction from a similar AWS service.')
        desc = f'{vi}. {chapter[3]}\n\n' + ('Theo dõi phần minh họa, sau đó tự thực hiện lại. Ghi chú tài nguyên cần dọn dẹp sau khi thực hành.' if hands else 'Trước khi xem: chủ đề này giải quyết vấn đề gì? Sau khi xem: ghi một tình huống sử dụng và điểm khác biệt so với dịch vụ AWS tương tự.')
        sidecar.write_text(json.dumps({'duration':duration, 'chapter':chapter[1], 'texts':{'en':{'title':title,'description':en},'vi':{'title':vi,'description':desc}}, 'editorial':{'kind':'Original study prompts; Vietnamese titles retain service names', 'sources':SOURCES}},ensure_ascii=False,indent=2))
    preview = video.with_suffix('.preview.jpg')
    if not preview.exists():
        subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-ss',str(min(10,duration/4)),'-i',str(video),'-frames:v','1','-vf','scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2','-q:v','5',str(preview)],check=True)
    sprite = video.with_suffix('.sprite.jpg')
    if not sprite.exists():
        # Seek before decode, keeping preparation fast even for large source videos.
        frames = []
        for i in range(12):
            frame = video.with_suffix(f'.thumb-{i}.jpg'); frames.append(frame)
            subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-ss',str((i+.1)/12*duration),'-i',str(video),'-frames:v','1','-vf','scale=160:90:force_original_aspect_ratio=decrease,pad=160:90:(ow-iw)/2:(oh-ih)/2','-q:v','6','-y',str(frame)],check=True)
        subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-framerate','1','-i',str(video.with_suffix('.thumb-%d.jpg')),'-vf','tile=4x3','-frames:v','1','-q:v','5',str(sprite)],check=True)
        for frame in frames: frame.unlink()
    return {'lesson':number,'duration':duration,'streams':probe.get('streams',[])}

if __name__ == '__main__':
    videos = sorted((ROOT/'files').rglob('*.mp4'))
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(prepare,videos):
            results.append(result)
            if len(results) % 10 == 0: print(f'Prepared {len(results)}/{len(videos)}',flush=True)
    (ROOT/'docs/media-report.json').write_text(json.dumps({'count':len(results),'seconds':sum(r['duration'] for r in results),'videos':results},indent=2))
    print(f'Prepared {len(results)} lessons',flush=True)
