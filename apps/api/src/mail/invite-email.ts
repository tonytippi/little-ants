import type { Role, SchoolRole } from '@little-ants/db';
import type { MailMessage } from './mail.service.js';

/** A label in both languages of the email. */
export interface Bilingual {
  vi: string;
  en: string;
}

const HQ_ROLE: Record<Role, Bilingual> = {
  ADMIN: { vi: 'Quản trị viên', en: 'Admin' },
  AUTHOR: { vi: 'Biên soạn nội dung', en: 'Content author' },
  REVIEWER: { vi: 'Duyệt nội dung', en: 'Content reviewer' },
};

const SCHOOL_ROLE: Record<SchoolRole, Bilingual> = {
  SCHOOL_ADMIN: { vi: 'Quản lý trường', en: 'School admin at' },
  TEACHER: { vi: 'Giáo viên trường', en: 'Teacher at' },
};

export function hqRoleLabel(roles: Role[]): Bilingual {
  return {
    vi: roles.map((role) => HQ_ROLE[role].vi).join(', '),
    en: roles.map((role) => HQ_ROLE[role].en).join(', '),
  };
}

export function schoolRoleLabel(role: SchoolRole, schoolName: string): Bilingual {
  return { vi: `${SCHOOL_ROLE[role].vi} ${schoolName}`, en: `${SCHOOL_ROLE[role].en} ${schoolName}` };
}

export interface InviteEmail {
  to: string;
  invitedBy: string;
  /** What the person is invited as. */
  role: Bilingual;
  signInUrl: string;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** The invite email, in Vietnamese with an English copy: it tells the person which Google account to sign in with. */
export function inviteEmail({ to, invitedBy, role, signInUrl }: InviteEmail): MailMessage {
  const subject = 'Lời mời tham gia Little Ants English / Your Little Ants English invite';
  const text = [
    'Xin chào,',
    '',
    `${invitedBy} đã mời bạn tham gia Little Ants English với vai trò ${role.vi}.`,
    `Mở ${signInUrl} và chọn "Continue with Google" bằng đúng tài khoản Google ${to}.`,
    '',
    '---',
    '',
    'Hello,',
    '',
    `${invitedBy} has invited you to Little Ants English as ${role.en}.`,
    `Open ${signInUrl} and choose "Continue with Google" with the Google account ${to}.`,
    '',
    'Little Ants English',
  ].join('\n');

  const [name, roleVi, roleEn, email, url] = [invitedBy, role.vi, role.en, to, signInUrl].map(escapeHtml);
  const button = `<p style="margin:24px 0"><a href="${url}" style="background:#2f7d32;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Đăng nhập / Sign in</a></p>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#3b2f2a;max-width:560px">
<p>Xin chào,</p>
<p><strong>${name}</strong> đã mời bạn tham gia Little Ants English với vai trò <strong>${roleVi}</strong>.</p>
<p>Bấm nút bên dưới và chọn <em>Continue with Google</em> bằng đúng tài khoản Google <strong>${email}</strong>.</p>
${button}
<hr style="border:none;border-top:1px solid #e5ddd5;margin:24px 0">
<p>Hello,</p>
<p><strong>${name}</strong> has invited you to Little Ants English as <strong>${roleEn}</strong>.</p>
<p>Use the button above and choose <em>Continue with Google</em> with the Google account <strong>${email}</strong>.</p>
<p style="color:#8a7b70;font-size:13px">Nếu nút không hoạt động / If the button does not work: <a href="${url}">${url}</a></p>
</div>`;
  return { to, subject, text, html };
}
