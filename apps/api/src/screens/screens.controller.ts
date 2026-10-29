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
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { z } from 'zod';
import {
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
import { ScreensService, type RelayedMessage, type StreamEvent } from './screens.service.js';

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
const screenMessage = relayed(SCREEN_TO_TEACHER_TYPES);

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
    return this.screens.pair(user, body.code);
  }

  @Sse(':id/events')
  events(@CurrentUser() user: StaffUser, @Param('id') id: string): Observable<StreamEvent> {
    return this.screens.teacherStream(user, id);
  }

  @Post(':id/messages')
  @HttpCode(204)
  message(
    @CurrentUser() user: StaffUser,
    @Param('id') id: string,
    @Body(new ZodBody(teacherMessage)) message: RelayedMessage,
  ): void {
    this.screens.toDisplay(user, id, message);
  }

  @Delete(':id')
  @HttpCode(204)
  disconnect(@CurrentUser() user: StaffUser, @Param('id') id: string): void {
    this.screens.unpair(user, id);
  }
}
