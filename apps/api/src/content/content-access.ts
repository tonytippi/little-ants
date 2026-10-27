import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { canChangeStatus, type ContentStatus } from '@little-ants/db';
import { hasRole, type StaffUser } from '../auth/staff-access.js';

/** Authors edit and submit; only reviewers (or admins) approve. */
export function assertCanSetStatus(
  user: Pick<StaffUser, 'roles'>,
  from: ContentStatus,
  to: ContentStatus,
): void {
  if (!canChangeStatus(from, to)) {
    throw new BadRequestException(`Cannot change status from ${from} to ${to}`);
  }
  if (to === 'APPROVED' && !hasRole(user, 'ADMIN', 'REVIEWER')) {
    throw new ForbiddenException('Only reviewers can approve content');
  }
}

export const EDITOR_ROLES = ['AUTHOR', 'REVIEWER'] as const;
