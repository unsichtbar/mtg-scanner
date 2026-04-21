import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EntityManager } from '@mikro-orm/core';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string) {
    const existing = await this.em.findOne(User, { email });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User(email, passwordHash);
    this.em.persist(user);
    await this.em.flush();

    return this.sign(user.id, user.email);
  }

  async login(email: string, password: string) {
    const user = await this.em.findOne(User, { email });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.sign(user.id, user.email);
  }

  private sign(userId: string, email: string) {
    return { accessToken: this.jwt.sign({ sub: userId, email }) };
  }
}
