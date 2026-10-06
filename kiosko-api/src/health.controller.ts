import { Controller, Get } from '@nestjs/common';

// Liveness only: SQL availability is checked by the authenticated configuration-status route.
@Controller('health')
export class HealthController {
  @Get() health() { return { ok: true, service: 'kiosko-api' }; }
}
