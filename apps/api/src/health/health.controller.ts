import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../common/decorators/public.decorator';

// Health API được phép truy cập mà không cần đăng nhập
@Public()
@Controller('health')
export class HealthController {
  // Inject HealthService để xử lý logic kiểm tra trạng thái hệ thống
  constructor(private readonly healthService: HealthService) {}

  // Liveness không phụ thuộc database, dùng để biết process API còn hoạt động.
  @Get('live')
  live() {
    return this.healthService.live();
  }

  // Readiness chỉ thành công khi API có thể truy cập database.
  @Get('ready')
  ready() {
    return this.healthService.ready();
  }

  // GET /health - kiểm tra API và database có đang hoạt động không
  @Get()
  check() {
    return this.healthService.check();
  }
}
