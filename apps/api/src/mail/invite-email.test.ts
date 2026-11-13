import { describe, expect, it } from 'vitest';
import { hqRoleLabel, inviteEmail, schoolRoleLabel } from './invite-email.js';

describe('invite email', () => {
  it('names the role in both languages and links to the sign-in page', () => {
    const message = inviteEmail({
      to: 'lan@example.com',
      invitedBy: 'Minh',
      role: schoolRoleLabel('TEACHER', 'Hoa Mai'),
      signInUrl: 'https://teacher.example.com',
    });
    expect(message.to).toBe('lan@example.com');
    expect(message.text).toContain('với vai trò Giáo viên trường Hoa Mai');
    expect(message.text).toContain('as Teacher at Hoa Mai');
    expect(message.html).toContain('href="https://teacher.example.com"');
  });

  it('escapes names typed by people', () => {
    const message = inviteEmail({
      to: 'lan@example.com',
      invitedBy: '<b>Minh</b>',
      role: hqRoleLabel(['AUTHOR', 'REVIEWER']),
      signInUrl: 'https://admin.example.com',
    });
    expect(message.html).not.toContain('<b>Minh</b>');
    expect(message.html).toContain('&#60;b&#62;Minh&#60;/b&#62;');
    expect(message.text).toContain('Content author, Content reviewer');
  });
});
