import { AppError } from "../../utils/core.js";
import { userRepository } from "./user.repository.js";

export class UserAccessService {
  async findByEmail(email, db) {
    return userRepository.findByEmail(email, db);
  }

  async findActiveByEmail(email, activeStatus, db) {
    return userRepository.findActiveByEmail(email, activeStatus, db);
  }

  async findById(id, db) {
    return userRepository.findById(id, db);
  }

  async requireByPublicId(publicId, db) {
    const user = await userRepository.findByPublicId(publicId, db);
    if (!user) throw new AppError(404, "User not found");
    return user;
  }

  async findAuthenticatedUser(id, publicId, db) {
    return userRepository.findAuthUser(id, publicId, db);
  }

  async create(data, db) {
    return userRepository.create(data, db);
  }

  async updateLastLogin(userId, db) {
    return userRepository.updateLastLogin(userId, db);
  }

  async updatePassword(userId, passwordHash, db) {
    return userRepository.updatePassword(userId, passwordHash, db);
  }
}

export const userAccessService = new UserAccessService();
