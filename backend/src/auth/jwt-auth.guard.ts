import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

const DEV_USER = { id: 'dev', email: 'dev@local' };

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (this.config.get('DEV_MODE') === 'true') {
      context.switchToHttp().getRequest().user = DEV_USER;
      return true;
    }
    return super.canActivate(context);
  }
}
