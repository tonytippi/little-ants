import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { z } from 'zod';
import {
  PARENT_TO_SCREEN_TYPES,
  SCREEN_MESSAGE_LIMIT,
  SCREEN_TO_TEACHER_TYPES,
  TEACHER_TO_SCREEN_TYPES,
  normalizeScreenCode,
  type NewScreen,
  type PairedScreen,
} from '@little-ants/shared';
import { CurrentUser, Public } from '../auth/decorators.js';
import type { StaffUser } from '../auth/staff-access.js';
import { ZodBody } from '../common/zod-body.js';
import { CurrentParent, ParentGuard, type SignedInParent } from '../parents/parent-session.js';
import {
  ScreensService,
  type RelayedMessage,
  type ScreenController,
  type StreamEvent,
} from './screens.service.js';

const pairInput = z.object({
  code: z.string().transform((value, context) => {
    const code = normalizeScreenCode(value);
    if (!code) context.addIssue({ code: 'custom', message: 'A code has 6 letters and digits' });
    return code ?? '';
  }),
});

/** Relayed messages are opaque to the API: a known type and a bounded size. */
function relayed(types: readonly string[]) {
  return z
    .looseObject({ type: z.enum(types as [string, ...string[]]) })
    .refine((message) => JSON.stringify(message).length <= SCREEN_MESSAGE_LIMIT, 'Message too large');
}
const teacherMessage = relayed(TEACHER_TO_SCREEN_TYPES);
const parentMessage = relayed(PARENT_TO_SCREEN_TYPES);
const screenMessage = relayed(SCREEN_TO_TEACHER_TYPES);

const staff = (user: StaffUser): ScreenController => ({ kind: 'staff', id: user.id, name: user.name });
// The TV shows "Connected to a phone": a parent's name is not needed on a screen anyone in the room can see.
const parent = (signedIn: SignedInParent): ScreenController => ({
  kind: 'parent',
  id: signedIn.parentId,
  name: '',
});

/**
 * A laptop plugged into the classroom TV opens a screen without signing in; the signed-in teacher pairs a tablet
 * with its code and drives the lesson. The laptop's side is authorised by its display token.
 */
@Controller('screens')
export class ScreensController {
  constructor(private readonly screens: ScreensService) {}

  @Public()
  @Post()
  create(): NewScreen {
    return this.screens.create();
  }

  @Public()
  @Sse(':id/display-events')
  displayEvents(@Param('id') id: string, @Query('token') token = ''): Observable<StreamEvent> {
    return this.screens.displayStream(id, token);
  }

  @Public()
  @Post(':id/display-messages')
  @HttpCode(204)
  displayMessage(
    @Param('id') id: string,
    @Headers('x-display-token') token = '',
    @Body(new ZodBody(screenMessage)) message: RelayedMessage,
  ): void {
    this.screens.toTeacher(id, token, message);
  }

  @Post('pair')
  pair(
    @CurrentUser() user: StaffUser,
    @Body(new ZodBody(pairInput)) body: z.infer<typeof pairInput>,
  ): PairedScreen {
    return this.screens.pair(staff(user), body.code);
  }

  @Sse(':id/events')
  events(@CurrentUser() user: StaffUser, @Param('id') id: string): Observable<StreamEvent> {
    return this.screens.teacherStream(staff(user), id);
  }

  @Post(':id/messages')
  @HttpCode(204)
  message(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(teacherMessage)) message: RelayedMessage,
  ): void {
    this.screens.toDisplay(staff(user), id, message);
  }

  @Delete(':id')
  @HttpCode(204)
  disconnect(@CurrentUser() user: StaffUser, @Param('id') id: string): void {
    this.screens.unpair(staff(user), id);
  }
}

/** At home: a signed-in parent pairs the TV's screen and plays Listening Time on it. */
@Public()
@UseGuards(ParentGuard)
@Controller('screens/parent')
export class ParentScreensController {
  constructor(private readonly screens: ScreensService) {}

  @Post('pair')
  pair(
    @CurrentParent() signedIn: SignedInParent,
    @Body(new ZodBody(pairInput)) body: z.infer<typeof pairInput>,
  ): PairedScreen {
    return this.screens.pair(parent(signedIn), body.code);
  }

  @Sse(':id/events')
  events(@CurrentParent() signedIn: SignedInParent, @Param('id') id: string): Observable<StreamEvent> {
    return this.screens.teacherStream(parent(signedIn), id);
  }

  @Post(':id/messages')
  @HttpCode(204)
  message(
    @CurrentParent() signedIn: SignedInParent,
    @Param('id') id: string,
    @Body(new ZodBody(parentMessage)) message: RelayedMessage,
  ): void {
    this.screens.toDisplay(parent(signedIn), id, message);
  }

  @Delete(':id')
  @HttpCode(204)
  disconnect(@CurrentParent() signedIn: SignedInParent, @Param('id') id: string): void {
    this.screens.unpair(parent(signedIn), id);
  }
}
