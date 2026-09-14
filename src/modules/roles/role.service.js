import { AppError } from "../../utils/core.js";
import { roleRepository } from "./role.repository.js";

export class RoleService {
  async requireByCode(code, db) {
    const role = await roleRepository.findByCode(code, db);

    if (!role) {
      throw new AppError(422, `Role '${code}' does not exist`);
    }

    return role;
  }

  async requireConfiguredByCode(code, db) {
    const role = await roleRepository.findByCode(code, db);

    if (!role) {
      throw new AppError(500, `${code} role seed is missing`);
    }

    return role;
  }

  async getUserRoleCodes(userId, db) {
    return roleRepository.getUserRoleCodes(userId, db);
  }

  async assignUserRole(userId, roleId, assignedBy, db) {
    return roleRepository.assign(userId, roleId, assignedBy, db);
  }

  async replaceUserRoles(userId, roleCodes, assignedBy, db) {
    const uniqueRoleCodes = [...new Set(roleCodes)];
    const availableRoles = await roleRepository.list(db);

    const roleIdsByCode = new Map(
      availableRoles.map((role) => [role.code, role.id]),
    );

    const unknownCodes = uniqueRoleCodes.filter(
      (code) => !roleIdsByCode.has(code),
    );

    if (unknownCodes.length) {
      throw new AppError(
        422,
        `Unknown roles: ${unknownCodes.join(", ")}`,
      );
    }

    const roleIds = uniqueRoleCodes.map((code) =>
      roleIdsByCode.get(code),
    );

    await roleRepository.replaceUserRoles(
      userId,
      roleIds,
      assignedBy,
      db,
    );
  }
}

export const roleService = new RoleService();
