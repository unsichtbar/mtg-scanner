import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (this.config.get('DEV_MODE') === 'true') {
      const devUserId = process.env.DEV_USER_ID ?? 'dev';
      context.switchToHttp().getRequest().user = { id: devUserId, email: 'dev@local' };
      return true;
    }
    return super.canActivate(context);
  }
}
