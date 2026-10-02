/** Current user (SDK context → systemuserid), security roles and the assignee directory. */
import { getContext } from '@microsoft/power-apps/app';
import { RolesService } from '@/generated/services/RolesService';
import { SystemuserrolescollectionService } from '@/generated/services/SystemuserrolescollectionService';
import { SystemusersService } from '@/generated/services/SystemusersService';
import { WhoAmIService } from '@/generated/services/WhoAmIService';
import { unwrap, unwrapList } from '@/api/dataverseClient';
import { anyGuid, asRow, chunk, eqGuid, odataString, str } from '@/api/odata';
import { ROLE_NAMES } from '@/types/schema';
import type { CurrentUser, Ref } from '@/types/entities';

/** Never match users by name/email — always by systemuserid. */
async function currentUserId(): Promise<string> {
  try {
    const ctx = await getContext();
    if (ctx.user.systemUserId) return ctx.user.systemUserId;
  } catch {
    // fall through to WhoAmI (e.g. running outside the Power Apps host)
  }
  const who = asRow(await unwrap('WhoAmI', WhoAmIService.WhoAmI()));
  const id = str(who, 'UserId');
  if (!id) throw new Error('Could not determine the signed-in user.');
  return id;
}

async function roleNames(userId: string): Promise<string[]> {
  const links = await unwrapList('List user roles', SystemuserrolescollectionService.getAll({
    select: ['roleid', 'systemuserid'], filter: eqGuid('systemuserid', userId),
  }));
  const roleIds = [...new Set(links.map((l) => l.roleid).filter(Boolean))];
  if (roleIds.length === 0) return [];
  const roles = await unwrapList('List roles', RolesService.getAll({ select: ['roleid', 'name'], filter: anyGuid('roleid', roleIds) }));
  return [...new Set(roles.map((r) => r.name))].sort();
}

export const usersService = {
  async getCurrentUser(): Promise<CurrentUser> {
    const id = await currentUserId();
    const [user, roles] = await Promise.all([
      unwrap('Get user', SystemusersService.get(id, { select: ['systemuserid', 'fullname', 'internalemailaddress'] })),
      roleNames(id),
    ]);
    const row = asRow(user);
    return {
      id,
      name: str(row, 'fullname'),
      email: str(row, 'internalemailaddress'),
      roles,
      isManager: roles.includes(ROLE_NAMES.manager) || roles.includes(ROLE_NAMES.systemAdministrator),
    };
  },

  /**
   * People who can receive a task: enabled users holding EPM Manager, EPM Member or
   * System Administrator. Dataverse rejects assigning a record to a user whose roles
   * can't read that table, so anyone else would only produce a failed save.
   */
  async listAssignable(): Promise<Ref[]> {
    const names = [ROLE_NAMES.manager, ROLE_NAMES.member, ROLE_NAMES.systemAdministrator];
    const roles = await unwrapList('List roles', RolesService.getAll({
      select: ['roleid', 'name'],
      filter: names.map((n) => `name eq ${odataString(n)}`).join(' or '),
    }));
    const roleIds = roles.map((r) => r.roleid).filter(Boolean);
    if (roleIds.length === 0) return [];

    const links = (await Promise.all(chunk(roleIds).map((ids) => unwrapList('List role members', SystemuserrolescollectionService.getAll({
      select: ['roleid', 'systemuserid'], filter: anyGuid('roleid', ids),
    }))))).flat();
    const userIds = [...new Set(links.map((l) => l.systemuserid).filter(Boolean))];
    if (userIds.length === 0) return [];

    const users = (await Promise.all(chunk(userIds).map((ids) => unwrapList('List users', SystemusersService.getAll({
      select: ['systemuserid', 'fullname'],
      filter: `isdisabled eq false and accessmode eq 0 and ${anyGuid('systemuserid', ids)}`,
    }))))).flat();
    return users
      .map((r) => {
        const row = asRow(r);
        return { id: str(row, 'systemuserid'), name: str(row, 'fullname') };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
};
