import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@little-ants/db';
import type { Response } from 'express';

const STATUS: Record<string, { status: number; message: string }> = {
  P2025: { status: 404, message: 'Not found' },
  P2002: { status: 409, message: 'This already exists' },
  P2003: { status: 409, message: 'This item is still used elsewhere' },
};

/** Turn known database errors into clear HTTP answers instead of 500s. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = STATUS[error.code];
    if (!mapped) {
      response.status(500).json({ statusCode: 500, message: 'Internal server error' });
      return;
    }
    response.status(mapped.status).json({ statusCode: mapped.status, message: mapped.message });
  }
}
