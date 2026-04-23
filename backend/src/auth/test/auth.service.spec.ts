import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { User } from '../../entities/user.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockEm = {
  findOne: jest.fn(),
  persist: jest.fn(),
  flush: jest.fn(),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('signed-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockJwt.sign.mockReturnValue('signed-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: EntityManager, useValue: mockEm },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('should hash the password, persist a new user, and return an access token', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed-password');

      const result = await service.register('test@example.com', 'password123');

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockEm.persist).toHaveBeenCalledWith(expect.any(User));
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ accessToken: 'signed-token' });
    });

    it('should throw ConflictException when the email is already in use', async () => {
      mockEm.findOne.mockResolvedValueOnce(new User('test@example.com', 'existing-hash'));

      await expect(service.register('test@example.com', 'password')).rejects.toThrow(ConflictException);
    });

    it('should not call bcrypt.hash when an email conflict is detected', async () => {
      mockEm.findOne.mockResolvedValueOnce(new User('test@example.com', 'existing-hash'));

      await expect(service.register('test@example.com', 'password')).rejects.toThrow();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should return an access token for valid credentials', async () => {
      const user = new User('test@example.com', 'hashed-password');
      mockEm.findOne.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await service.login('test@example.com', 'password123');

      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(result).toEqual({ accessToken: 'signed-token' });
    });

    it('should call jwt.sign with the user id and email', async () => {
      const user = new User('test@example.com', 'hashed-password');
      mockEm.findOne.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      await service.login('test@example.com', 'password123');

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: user.id, email: 'test@example.com' }),
      );
    });

    it('should throw UnauthorizedException when the user is not found', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);

      await expect(service.login('nobody@example.com', 'password')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when the password does not match', async () => {
      const user = new User('test@example.com', 'hashed-password');
      mockEm.findOne.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.login('test@example.com', 'wrong-password')).rejects.toThrow(UnauthorizedException);
    });

    it('should not call bcrypt.compare when the user is not found', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);

      await expect(service.login('nobody@example.com', 'password')).rejects.toThrow();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });
});
