import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ContainersService } from '../containers.service';
import { ScryfallService } from '../../scryfall/scryfall.service';
import { Container } from '../../entities/container.entity';
import { ContainerCard } from '../../entities/container-card.entity';
import { User } from '../../entities/user.entity';
import { Card } from '../../entities/card.entity';

const mockEm = {
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  find: jest.fn(),
  persist: jest.fn(),
  remove: jest.fn(),
  flush: jest.fn(),
  nativeDelete: jest.fn(),
};

const mockScryfall = {
  findById: jest.fn(),
};

function makeUser(): User {
  return Object.assign(new User('test@example.com', 'hash'), { id: 'user-1' });
}

function makeCard(overrides: Partial<Card> = {}): Card {
  const card = new Card('card-1', 'Lightning Bolt', 'https://scryfall.com', 1, 'Instant', 'common', 'lea', 'Alpha', [], {});
  return Object.assign(card, overrides);
}

function makeContainer(user?: User): Container {
  return Object.assign(new Container(user ?? makeUser(), 'My Box'), { id: 'container-1' });
}

function makeContainerCard(container?: Container, card?: Card, quantity = 1): ContainerCard {
  return Object.assign(
    new ContainerCard(container ?? makeContainer(), card ?? makeCard(), quantity),
    { id: 'cc-1' },
  );
}

describe('ContainersService', () => {
  let service: ContainersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContainersService,
        { provide: EntityManager, useValue: mockEm },
        { provide: ScryfallService, useValue: mockScryfall },
      ],
    }).compile();

    service = module.get(ContainersService);
  });

  describe('list', () => {
    it('should return containers ordered by createdAt asc', async () => {
      const containers = [makeContainer()];
      mockEm.find.mockResolvedValueOnce(containers);

      const result = await service.list('user-1');

      expect(result).toBe(containers);
      expect(mockEm.find).toHaveBeenCalledWith(
        Container,
        { user: 'user-1' },
        { orderBy: { createdAt: 'asc' } },
      );
    });
  });

  describe('get', () => {
    it('should return a populated container when found', async () => {
      const container = makeContainer();
      mockEm.findOne.mockResolvedValueOnce(container);

      const result = await service.get('user-1', 'container-1');

      expect(result).toBe(container);
      expect(mockEm.findOne).toHaveBeenCalledWith(
        Container,
        { id: 'container-1', user: 'user-1' },
        { populate: ['cards', 'cards.card'] },
      );
    });

    it('should throw NotFoundException when the container does not exist', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);

      await expect(service.get('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should persist a new container and return it', async () => {
      const user = makeUser();
      mockEm.findOneOrFail.mockResolvedValueOnce(user);

      const result = await service.create('user-1', 'Binder 1');

      expect(mockEm.persist).toHaveBeenCalledWith(expect.any(Container));
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(Container);
      expect(result.name).toBe('Binder 1');
    });
  });

  describe('rename', () => {
    it('should update the container name and flush', async () => {
      const container = makeContainer();
      mockEm.findOne.mockResolvedValueOnce(container);

      const result = await service.rename('user-1', 'container-1', 'Trade Pile');

      expect(result.name).toBe('Trade Pile');
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when the container is not owned by the user', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);

      await expect(service.rename('user-1', 'other', 'New Name')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete all container cards then the container itself', async () => {
      const container = makeContainer();
      mockEm.findOne.mockResolvedValueOnce(container);

      await service.delete('user-1', 'container-1');

      expect(mockEm.nativeDelete).toHaveBeenCalledWith(ContainerCard, { container: 'container-1' });
      expect(mockEm.remove).toHaveBeenCalledWith(container);
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when the container is not found', async () => {
      mockEm.findOne.mockResolvedValueOnce(null);

      await expect(service.delete('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addCard', () => {
    it('should create a new ContainerCard when the card is not yet in the container', async () => {
      const container = makeContainer();
      const card = makeCard();
      mockEm.findOne
        .mockResolvedValueOnce(container)  // ensureOwner
        .mockResolvedValueOnce(null);       // no existing ContainerCard
      mockScryfall.findById.mockResolvedValueOnce(card);

      const result = await service.addCard('user-1', 'container-1', 'card-1', 1);

      expect(mockEm.persist).toHaveBeenCalledWith(expect.any(ContainerCard));
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(ContainerCard);
      expect(result.quantity).toBe(1);
    });

    it('should increment the quantity when the card already exists in the container', async () => {
      const container = makeContainer();
      const card = makeCard();
      const existing = makeContainerCard(container, card, 2);
      mockEm.findOne
        .mockResolvedValueOnce(container)
        .mockResolvedValueOnce(existing);
      mockScryfall.findById.mockResolvedValueOnce(card);

      const result = await service.addCard('user-1', 'container-1', 'card-1', 3);

      expect(result.quantity).toBe(5);
      expect(mockEm.persist).not.toHaveBeenCalled();
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should call scryfall.findById with the provided cardId', async () => {
      const container = makeContainer();
      mockEm.findOne
        .mockResolvedValueOnce(container)
        .mockResolvedValueOnce(null);
      mockScryfall.findById.mockResolvedValueOnce(makeCard());

      await service.addCard('user-1', 'container-1', 'card-1', 1);

      expect(mockScryfall.findById).toHaveBeenCalledWith('card-1');
    });
  });

  describe('setCardQuantity', () => {
    it('should update the quantity and return the ContainerCard', async () => {
      const container = makeContainer();
      const cc = makeContainerCard(container, makeCard(), 2);
      mockEm.findOne
        .mockResolvedValueOnce(container)
        .mockResolvedValueOnce(cc);

      const result = await service.setCardQuantity('user-1', 'container-1', 'card-1', 5);

      expect(result!.quantity).toBe(5);
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should remove the ContainerCard and return null when quantity is 0', async () => {
      const container = makeContainer();
      const cc = makeContainerCard(container, makeCard(), 1);
      mockEm.findOne
        .mockResolvedValueOnce(container)
        .mockResolvedValueOnce(cc);

      const result = await service.setCardQuantity('user-1', 'container-1', 'card-1', 0);

      expect(result).toBeNull();
      expect(mockEm.remove).toHaveBeenCalledWith(cc);
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when the card is not in the container', async () => {
      const container = makeContainer();
      mockEm.findOne
        .mockResolvedValueOnce(container)
        .mockResolvedValueOnce(null);

      await expect(service.setCardQuantity('user-1', 'container-1', 'card-1', 3))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('removeCard', () => {
    it('should remove the ContainerCard and flush', async () => {
      const container = makeContainer();
      const cc = makeContainerCard(container, makeCard());
      mockEm.findOne
        .mockResolvedValueOnce(container)
        .mockResolvedValueOnce(cc);

      await service.removeCard('user-1', 'container-1', 'card-1');

      expect(mockEm.remove).toHaveBeenCalledWith(cc);
      expect(mockEm.flush).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when the card is not in the container', async () => {
      const container = makeContainer();
      mockEm.findOne
        .mockResolvedValueOnce(container)
        .mockResolvedValueOnce(null);

      await expect(service.removeCard('user-1', 'container-1', 'card-1'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
